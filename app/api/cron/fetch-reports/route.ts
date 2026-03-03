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
  financial_metrics: {
    revenue: string
    gross_profit: string
    operating_income: string
    net_income: string
    eps: string
    eps_diluted: string
    total_assets: string
    total_liabilities: string
    total_equity: string
    cash_and_equivalents: string
    total_debt: string
    operating_cash_flow: string
    free_cash_flow: string
  }
  s3_url: string | null
  created_at: string
}

function formatDollarBillions(raw: string | null): string {
  if (!raw) return ''
  const num = parseFloat(raw)
  if (isNaN(num)) return ''
  const b = num / 1e9
  if (Math.abs(b) >= 1) return `$${b.toFixed(2)}B`
  return `$${(num / 1e6).toFixed(2)}M`
}

function formatEps(raw: string | null): string {
  if (!raw) return ''
  const num = parseFloat(raw)
  if (isNaN(num)) return ''
  return `$${num.toFixed(2)}`
}

function calcYoY(cur: string | null, prev: string | null): string {
  if (!cur || !prev) return ''
  const c = parseFloat(cur), p = parseFloat(prev)
  if (isNaN(c) || isNaN(p) || p === 0) return ''
  const pct = ((c - p) / Math.abs(p)) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function calcMargin(part: string | null, whole: string | null): string {
  if (!part || !whole) return ''
  const p = parseFloat(part), w = parseFloat(whole)
  if (isNaN(p) || isNaN(w) || w === 0) return ''
  return `${((p / w) * 100).toFixed(2)}%`
}

/**
 * GET /api/cron/fetch-reports
 *
 * Vercel Cron calls this daily at 06:00 UTC.
 * Calls the data team API for each tracked company, transforms the raw
 * financial_metrics JSON, and upserts into Postgres.
 */
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
    let companiesChecked = 0
    let newReportsFound = 0
    const errors: string[] = []
    const details: Record<string, any> = {}

    for (const company of companies) {
      try {
        companiesChecked++
        const category = getCompanyCategoryBySymbol(company.symbol)
        if (!category) continue

        console.log(`[Cron] Fetching ${company.symbol}...`)
        const url = `${FINANCIAL_API_BASE}/api/v1/reports/companies/${encodeURIComponent(company.symbol)}/reports?limit=8`
        const response = await fetch(url, {
          headers: { 'accept': 'application/json' },
        })

        if (!response.ok) {
          console.log(`[Cron] ${company.symbol}: HTTP ${response.status}`)
          details[company.symbol] = { status: 'http_error', code: response.status }
          continue
        }

        const rawReports: RawQuarterReport[] = await response.json()
        if (!rawReports || !Array.isArray(rawReports) || rawReports.length === 0) {
          details[company.symbol] = { status: 'no_data' }
          continue
        }

        let companyNewCount = 0

        for (const report of rawReports) {
          try {
            const m = report.financial_metrics

            // Find same quarter previous year for YoY
            const prevYear = rawReports.find(
              r => r.fiscal_year === report.fiscal_year - 1 && r.fiscal_quarter === report.fiscal_quarter
            )
            const pm = prevYear?.financial_metrics

            await upsertFetchedFinancial({
              symbol: company.symbol,
              company_name: company.name,
              category,
              fiscal_year: report.fiscal_year,
              fiscal_quarter: report.fiscal_quarter,
              period: `${report.fiscal_year} Q${report.fiscal_quarter}`,
              revenue: formatDollarBillions(m.revenue),
              revenue_yoy: calcYoY(m.revenue, pm?.revenue || null),
              net_income: formatDollarBillions(m.net_income),
              net_income_yoy: calcYoY(m.net_income, pm?.net_income || null),
              eps: formatEps(m.eps),
              eps_yoy: calcYoY(m.eps, pm?.eps || null),
              operating_margin: calcMargin(m.operating_income, m.revenue),
              gross_margin: calcMargin(m.gross_profit, m.revenue),
              report_text: JSON.stringify(m, null, 2),
              report_url: report.s3_url,
              filing_date: report.report_date,
            })
            companyNewCount++
          } catch (err: any) {
            errors.push(`${company.symbol} ${report.fiscal_year}Q${report.fiscal_quarter}: ${err.message}`)
          }
        }

        newReportsFound += companyNewCount
        details[company.symbol] = { status: 'ok', quarters: companyNewCount, total: rawReports.length }
        console.log(`[Cron] ${company.symbol}: ${companyNewCount} quarters upserted`)
      } catch (err: any) {
        errors.push(`${company.symbol}: ${err.message}`)
        details[company.symbol] = { status: 'error', error: err.message }
      }
    }

    const elapsed = Date.now() - startTime
    if (logId) {
      await logCronJobEnd(logId, errors.length > 0 ? 'error' : 'success', companiesChecked, newReportsFound, errors.length > 0 ? errors.join('; ') : undefined, details)
    }

    console.log(`[Cron] Done in ${elapsed}ms. Companies: ${companiesChecked}, Upserted: ${newReportsFound}, Errors: ${errors.length}`)

    return NextResponse.json({
      success: true,
      elapsed_ms: elapsed,
      companies_checked: companiesChecked,
      reports_upserted: newReportsFound,
      errors: errors.length > 0 ? errors : undefined,
      details,
    })
  } catch (error: any) {
    console.error('[Cron] Fatal:', error)
    if (logId) { try { await logCronJobEnd(logId, 'error', 0, 0, error.message) } catch {} }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
