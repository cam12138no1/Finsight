import { NextRequest, NextResponse } from 'next/server'
import { getAllCompanies, getCompanyCategoryBySymbol } from '@/lib/companies'
import {
  ensureFetchedFinancialsTable,
  upsertFetchedFinancial,
  logCronJobStart,
  logCronJobEnd,
} from '@/lib/db/financial-queries'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const FINANCIAL_API_BASE = process.env.FINANCIAL_API_BASE_URL || ''

interface RawQuarterReport {
  id: string
  company_id: string
  ticker: string
  fiscal_year: number
  fiscal_quarter: number
  report_date: string
  financial_metrics: Record<string, string>
  s3_url: string | null
  created_at: string
}

// Full-precision dollar formatting: 113896000000 → "$113.896B"
function formatDollar(raw: string | null): string {
  if (!raw) return ''
  const num = parseFloat(raw)
  if (isNaN(num) || num === 0) return '$0'
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${strip(abs / 1e9)}B`
  if (abs >= 1e6) return `${sign}$${strip(abs / 1e6)}M`
  return `${sign}$${strip(abs)}`
}

function strip(n: number): string {
  return n.toFixed(6).replace(/\.?0+$/, '') || '0'
}

function formatEps(raw: string | null): string {
  if (!raw) return ''
  const num = parseFloat(raw)
  if (isNaN(num)) return ''
  return `$${raw}`
}

function calcYoY(cur: string | null, prev: string | null): string {
  if (!cur || !prev) return ''
  const c = parseFloat(cur), p = parseFloat(prev)
  if (isNaN(c) || isNaN(p) || p === 0) return ''
  const pct = ((c - p) / Math.abs(p)) * 100
  // Verify
  const recon = p * (1 + pct / 100)
  if (Math.abs(recon - c) > Math.abs(c) * 0.0001 && Math.abs(c) > 0) {
    console.warn(`[YoY Verify] cur=${c}, prev=${p}, pct=${pct.toFixed(4)}%, recon=${recon}`)
  }
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function calcMargin(part: string | null, whole: string | null): string {
  if (!part || !whole) return ''
  const p = parseFloat(part), w = parseFloat(whole)
  if (isNaN(p) || isNaN(w) || w === 0) return ''
  const pct = (p / w) * 100
  const recon = w * (pct / 100)
  if (Math.abs(recon - p) > Math.abs(p) * 0.0001 && Math.abs(p) > 0) {
    console.warn(`[Margin Verify] part=${p}, whole=${w}, pct=${pct.toFixed(4)}%`)
  }
  return `${pct.toFixed(2)}%`
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!FINANCIAL_API_BASE) {
    return NextResponse.json({ error: 'FINANCIAL_API_BASE_URL not configured' }, { status: 500 })
  }

  const startTime = Date.now()
  let logId: number | null = null

  try {
    await ensureFetchedFinancialsTable()
    logId = await logCronJobStart('fetch-reports')
    console.log(`[Cron] Starting daily fetch from ${FINANCIAL_API_BASE}`)

    const companies = getAllCompanies()
    let companiesChecked = 0, newReportsFound = 0
    const errors: string[] = []
    const details: Record<string, any> = {}

    for (const company of companies) {
      try {
        companiesChecked++
        const category = getCompanyCategoryBySymbol(company.symbol)
        if (!category) continue

        const url = `${FINANCIAL_API_BASE}/api/v1/reports/companies/${encodeURIComponent(company.symbol)}/reports?limit=8`
        console.log(`[Cron] ${company.symbol}: ${url}`)
        const response = await fetch(url, { headers: { accept: 'application/json' } })

        if (!response.ok) {
          details[company.symbol] = { status: 'http_error', code: response.status }
          continue
        }

        const rawReports: RawQuarterReport[] = await response.json()
        if (!rawReports || !Array.isArray(rawReports) || rawReports.length === 0) {
          details[company.symbol] = { status: 'empty' }
          continue
        }

        let count = 0
        for (const report of rawReports) {
          try {
            const m = report.financial_metrics
            const prev = rawReports.find(
              r => r.fiscal_year === report.fiscal_year - 1 && r.fiscal_quarter === report.fiscal_quarter
            )
            const pm = prev?.financial_metrics

            await upsertFetchedFinancial({
              symbol: company.symbol,
              company_name: company.name,
              category,
              fiscal_year: report.fiscal_year,
              fiscal_quarter: report.fiscal_quarter,
              period: `${report.fiscal_year} Q${report.fiscal_quarter}`,
              revenue: formatDollar(m.revenue),
              revenue_yoy: calcYoY(m.revenue, pm?.revenue || null),
              net_income: formatDollar(m.net_income),
              net_income_yoy: calcYoY(m.net_income, pm?.net_income || null),
              eps: formatEps(m.eps),
              eps_yoy: calcYoY(m.eps, pm?.eps || null),
              operating_margin: calcMargin(m.operating_income, m.revenue),
              gross_margin: calcMargin(m.gross_profit, m.revenue),
              // Store the full JSON metrics for AI analysis / research comparison
              report_text: JSON.stringify(m, null, 2),
              filing_date: report.report_date,
            })
            count++
          } catch (err: any) {
            errors.push(`${company.symbol} ${report.fiscal_year}Q${report.fiscal_quarter}: ${err.message}`)
          }
        }

        newReportsFound += count
        details[company.symbol] = { status: 'ok', quarters: count, total: rawReports.length }
        console.log(`[Cron] ${company.symbol}: ${count} quarters stored`)
      } catch (err: any) {
        errors.push(`${company.symbol}: ${err.message}`)
        details[company.symbol] = { status: 'error', error: err.message }
      }
    }

    const elapsed = Date.now() - startTime
    if (logId) await logCronJobEnd(logId, errors.length > 0 ? 'error' : 'success', companiesChecked, newReportsFound, errors.length > 0 ? errors.join('; ') : undefined, details)

    console.log(`[Cron] Done in ${elapsed}ms. Companies: ${companiesChecked}, Stored: ${newReportsFound}, Errors: ${errors.length}`)

    return NextResponse.json({ success: true, elapsed_ms: elapsed, companies_checked: companiesChecked, reports_upserted: newReportsFound, errors: errors.length > 0 ? errors : undefined, details })
  } catch (error: any) {
    console.error('[Cron] Fatal:', error)
    if (logId) { try { await logCronJobEnd(logId, 'error', 0, 0, error.message) } catch {} }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
