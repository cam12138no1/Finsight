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
  financial_metrics: Record<string, any>
  segment_revenue?: { segments: Record<string, string> }
  geographic_revenue?: { regions: Record<string, string> }
  financial_ratios?: Record<string, any>
  growth_metrics?: Record<string, any>
  key_metrics?: Record<string, any>
  analyst_estimates?: any
  earnings_surprise?: any
  s3_url: string | null
  created_at: string
}

function formatDollar(raw: any): string {
  if (!raw && raw !== 0) return ''
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
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

function formatEps(raw: any): string {
  if (!raw && raw !== 0) return ''
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  if (isNaN(num)) return ''
  return `$${raw}`
}

function formatGrowthPct(raw: any): string {
  if (raw === null || raw === undefined) return ''
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  if (isNaN(num)) return ''
  const pct = num * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function formatRatioPct(raw: any): string {
  if (raw === null || raw === undefined) return ''
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  if (isNaN(num)) return ''
  return `${(num * 100).toFixed(2)}%`
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
        console.log(`[Cron] ${company.symbol}: fetching...`)
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
            const g = report.growth_metrics
            const r = report.financial_ratios

            // Use API-provided growth metrics if available, otherwise leave empty
            const revenueYoY = g?.revenue_growth != null ? formatGrowthPct(g.revenue_growth) : ''
            const netIncomeYoY = g?.net_income_growth != null ? formatGrowthPct(g.net_income_growth) : ''
            const epsYoY = g?.eps_growth != null ? formatGrowthPct(g.eps_growth) : ''

            const opMargin = r?.operating_profit_margin != null ? formatRatioPct(r.operating_profit_margin) : ''
            const grossMargin = r?.gross_profit_margin != null ? formatRatioPct(r.gross_profit_margin) : ''

            // Store the ENTIRE API response as JSON for detail page and AI analysis
            const fullReportJson = JSON.stringify({
              financial_metrics: m,
              segment_revenue: report.segment_revenue,
              geographic_revenue: report.geographic_revenue,
              financial_ratios: report.financial_ratios,
              growth_metrics: report.growth_metrics,
              key_metrics: report.key_metrics,
              analyst_estimates: report.analyst_estimates,
              earnings_surprise: report.earnings_surprise,
            }, null, 2)

            await upsertFetchedFinancial({
              symbol: company.symbol,
              company_name: company.name,
              category,
              fiscal_year: report.fiscal_year,
              fiscal_quarter: report.fiscal_quarter,
              period: `${report.fiscal_year} Q${report.fiscal_quarter}`,
              revenue: formatDollar(m.revenue),
              revenue_yoy: revenueYoY,
              net_income: formatDollar(m.net_income),
              net_income_yoy: netIncomeYoY,
              eps: formatEps(m.eps),
              eps_yoy: epsYoY,
              operating_margin: opMargin,
              gross_margin: grossMargin,
              report_text: fullReportJson,
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
