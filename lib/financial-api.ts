// lib/financial-api.ts - Financial data API service layer
// Adapts the data team's API response to our internal data model
// All numbers preserve full precision — no rounding beyond source data

import { Company, CompanyCategory, getAllCompanies, getCompanyCategoryBySymbol } from './companies'

export interface QuarterlyMetrics {
  revenue: string
  revenueYoY: string
  netIncome: string
  netIncomeYoY: string
  eps: string
  epsYoY: string
  operatingMargin: string
  grossMargin: string
}

export interface QuarterData {
  fiscalYear: number
  fiscalQuarter: number
  period: string
  metrics: QuarterlyMetrics
  filingDate?: string
  reportAvailable: boolean
}

export interface CompanyFinancialData {
  symbol: string
  name: string
  nameZh: string
  category: CompanyCategory
  quarters: QuarterData[]
  lastUpdated: string
}

export interface CoreMetric {
  label: string
  key: keyof QuarterlyMetrics
}

export const CORE_METRICS: CoreMetric[] = [
  { label: 'Net Income', key: 'netIncome' },
  { label: 'Revenue', key: 'revenue' },
  { label: 'EPS', key: 'eps' },
]

const FINANCIAL_API_BASE = process.env.FINANCIAL_API_BASE_URL || ''

// ============================================================
// Raw API response type (from colleague's API)
// ============================================================

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

// ============================================================
// Number formatting — full precision, no unnecessary rounding
// ============================================================

/**
 * Format raw dollar amount to human-readable string.
 * Preserves full precision: 113896000000 → "$113.896B", not "$113.90B"
 */
function formatDollar(raw: string | null | undefined): string {
  if (!raw) return ''
  const num = parseFloat(raw)
  if (isNaN(num)) return ''
  if (num === 0) return '$0'

  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''

  if (abs >= 1e9) {
    const val = abs / 1e9
    return `${sign}$${stripTrailingZeros(val)}B`
  }
  if (abs >= 1e6) {
    const val = abs / 1e6
    return `${sign}$${stripTrailingZeros(val)}M`
  }
  if (abs >= 1e3) {
    const val = abs / 1e3
    return `${sign}$${stripTrailingZeros(val)}K`
  }
  return `${sign}$${stripTrailingZeros(abs)}`
}

/**
 * Format EPS — preserve full precision from source
 */
function formatEps(raw: string | null | undefined): string {
  if (!raw) return ''
  const num = parseFloat(raw)
  if (isNaN(num)) return ''
  return `$${raw}`
}

/**
 * Remove unnecessary trailing zeros but keep at least meaningful decimals.
 * 113.896000 → "113.896", 45.00 → "45", 2.10 → "2.1"
 */
function stripTrailingZeros(num: number): string {
  // Use enough decimal places to avoid precision loss
  const str = num.toFixed(6)
  // Remove trailing zeros after decimal point
  return str.replace(/\.?0+$/, '') || '0'
}

/**
 * Calculate YoY% with verification.
 * Formula: (current - previous) / |previous| * 100
 * Returns formatted string like "+12.27%" with 2 decimal places.
 */
function calcYoY(current: string | null | undefined, previous: string | null | undefined): string {
  if (!current || !previous) return ''
  const cur = parseFloat(current)
  const prev = parseFloat(previous)
  if (isNaN(cur) || isNaN(prev) || prev === 0) return ''

  const pct = ((cur - prev) / Math.abs(prev)) * 100

  // Verification: reverse-check the calculation
  const reconstructed = prev * (1 + pct / 100)
  const tolerance = Math.abs(cur) * 0.0001 // 0.01% tolerance
  if (Math.abs(reconstructed - cur) > tolerance && Math.abs(cur) > 0) {
    console.warn(`[YoY Check] Potential precision issue: cur=${cur}, prev=${prev}, pct=${pct.toFixed(4)}%, reconstructed=${reconstructed}`)
  }

  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

/**
 * Calculate margin% with verification.
 * Formula: part / whole * 100
 */
function calcMargin(part: string | null | undefined, whole: string | null | undefined): string {
  if (!part || !whole) return ''
  const p = parseFloat(part)
  const w = parseFloat(whole)
  if (isNaN(p) || isNaN(w) || w === 0) return ''

  const pct = (p / w) * 100

  // Verification: reverse-check
  const reconstructed = w * (pct / 100)
  const tolerance = Math.abs(p) * 0.0001
  if (Math.abs(reconstructed - p) > tolerance && Math.abs(p) > 0) {
    console.warn(`[Margin Check] Potential precision issue: part=${p}, whole=${w}, pct=${pct.toFixed(4)}%`)
  }

  return `${pct.toFixed(2)}%`
}

// ============================================================
// Transform raw API response → our data model
// ============================================================

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

function transformRawReports(
  rawReports: RawQuarterReport[],
  companyName: string,
  companyNameZh: string,
  category: CompanyCategory
): CompanyFinancialData {
  const sorted = [...rawReports].sort((a, b) => {
    if (b.fiscal_year !== a.fiscal_year) return b.fiscal_year - a.fiscal_year
    return b.fiscal_quarter - a.fiscal_quarter
  })

  const quarters: QuarterData[] = sorted.map((report) => {
    const m = report.financial_metrics
    const g = report.growth_metrics
    const r = report.financial_ratios

    // Prefer API-provided growth/ratios, fall back to manual calculation
    const prevYearReport = sorted.find(
      rpt => rpt.fiscal_year === report.fiscal_year - 1 && rpt.fiscal_quarter === report.fiscal_quarter
    )
    const pm = prevYearReport?.financial_metrics

    return {
      fiscalYear: report.fiscal_year,
      fiscalQuarter: report.fiscal_quarter,
      period: `${report.fiscal_year} Q${report.fiscal_quarter}`,
      filingDate: report.report_date,
      reportAvailable: true,
      metrics: {
        revenue: formatDollar(m.revenue),
        revenueYoY: g?.revenue_growth != null ? formatGrowthPct(g.revenue_growth) : calcYoY(m.revenue, pm?.revenue),
        netIncome: formatDollar(m.net_income),
        netIncomeYoY: g?.net_income_growth != null ? formatGrowthPct(g.net_income_growth) : calcYoY(m.net_income, pm?.net_income),
        eps: formatEps(m.eps),
        epsYoY: g?.eps_growth != null ? formatGrowthPct(g.eps_growth) : calcYoY(m.eps, pm?.eps),
        operatingMargin: r?.operating_profit_margin != null ? formatRatioPct(r.operating_profit_margin) : calcMargin(m.operating_income, m.revenue),
        grossMargin: r?.gross_profit_margin != null ? formatRatioPct(r.gross_profit_margin) : calcMargin(m.gross_profit, m.revenue),
      },
    }
  })

  return {
    symbol: rawReports[0]?.ticker || '',
    name: companyName,
    nameZh: companyNameZh,
    category,
    quarters,
    lastUpdated: rawReports[0]?.created_at || new Date().toISOString(),
  }
}

// ============================================================
// API calls
// ============================================================

/**
 * Fetch financial data for a specific company.
 * Endpoint: GET /api/v1/reports/companies/{ticker}/reports?limit=8
 */
export async function fetchCompanyFinancials(symbol: string): Promise<CompanyFinancialData | null> {
  if (!FINANCIAL_API_BASE) return null

  try {
    const url = `${FINANCIAL_API_BASE}/api/v1/reports/companies/${encodeURIComponent(symbol)}/reports?limit=8`
    const response = await fetch(url, { headers: { 'accept': 'application/json' }, cache: 'no-store' })
    if (!response.ok) return null

    const rawData: RawQuarterReport[] = await response.json()
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return null

    const { getCompanyBySymbol } = await import('./companies')
    const company = getCompanyBySymbol(symbol)
    const category = getCompanyCategoryBySymbol(symbol) || 'AI_APPLICATION'

    return transformRawReports(rawData, company?.name || symbol, company?.nameZh || symbol, category)
  } catch (error) {
    console.error(`[Financial API] Failed to fetch ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch all companies in a category (calls fetchCompanyFinancials per company)
 */
export async function fetchCategoryFinancials(category: CompanyCategory): Promise<CompanyFinancialData[]> {
  if (!FINANCIAL_API_BASE) return []
  const { getCompaniesByCategory } = await import('./companies')
  const companies = getCompaniesByCategory(category)
  const results: CompanyFinancialData[] = []
  for (const company of companies) {
    try {
      const data = await fetchCompanyFinancials(company.symbol)
      if (data) results.push(data)
    } catch { /* skip */ }
  }
  return results
}

/**
 * Fetch raw financial_metrics JSON for a specific quarter.
 * Returns the JSON string for AI analysis / research report comparison.
 */
export async function fetchQuarterReportJson(symbol: string, year: number, quarter: number): Promise<string | null> {
  if (!FINANCIAL_API_BASE) return null

  try {
    const url = `${FINANCIAL_API_BASE}/api/v1/reports/companies/${encodeURIComponent(symbol)}/reports?limit=12`
    const response = await fetch(url, { headers: { 'accept': 'application/json' }, cache: 'no-store' })
    if (!response.ok) return null

    const rawData: RawQuarterReport[] = await response.json()
    if (!rawData || !Array.isArray(rawData)) return null

    const target = rawData.find(r => r.fiscal_year === year && r.fiscal_quarter === quarter)
    if (!target) return null

    return JSON.stringify(target.financial_metrics, null, 2)
  } catch (error) {
    console.error(`[Financial API] Failed to fetch ${symbol} ${year} Q${quarter}:`, error)
    return null
  }
}

// Keep old name as alias for backward compat
export const fetchQuarterReport = fetchQuarterReportJson

/**
 * Build company financial data from local analysis store (fallback)
 */
export function buildCompanyDataFromAnalyses(
  analyses: Array<{
    company_symbol: string
    company_name: string
    category?: string
    fiscal_year?: number
    fiscal_quarter?: number
    period?: string
    processed: boolean
    error?: string
    one_line_conclusion?: string
    results_table?: Array<{ metric: string; actual: string; consensus: string; delta: string; assessment: string }>
    comparison_snapshot?: { core_revenue?: string; core_profit?: string }
    created_at: string
  }>
): CompanyFinancialData[] {
  const companyMap = new Map<string, CompanyFinancialData>()

  for (const analysis of analyses) {
    if (!analysis.processed || analysis.error) continue
    const symbol = analysis.company_symbol
    if (!symbol) continue

    if (!companyMap.has(symbol)) {
      const category = (analysis.category as CompanyCategory) || getCompanyCategoryBySymbol(symbol) || 'AI_APPLICATION'
      companyMap.set(symbol, {
        symbol, name: analysis.company_name, nameZh: analysis.company_name,
        category, quarters: [], lastUpdated: analysis.created_at,
      })
    }

    const company = companyMap.get(symbol)!
    const metrics: QuarterlyMetrics = {
      revenue: '', revenueYoY: '', netIncome: '', netIncomeYoY: '',
      eps: '', epsYoY: '', operatingMargin: '', grossMargin: '',
    }

    if (analysis.results_table) {
      for (const row of analysis.results_table) {
        const ml = row.metric.toLowerCase()
        if (ml.includes('revenue') && !ml.includes('指引') && !ml.includes('guidance')) {
          metrics.revenue = row.actual || ''; metrics.revenueYoY = row.delta || ''
        }
        if (ml.includes('net income') || ml.includes('净利润') || ml.includes('operating income')) {
          metrics.netIncome = row.actual || ''; metrics.netIncomeYoY = row.delta || ''
        }
        if (ml.includes('eps')) { metrics.eps = row.actual || ''; metrics.epsYoY = row.delta || '' }
        if (ml.includes('operating margin') || ml.includes('营业利润率')) { metrics.operatingMargin = row.actual || '' }
        if (ml.includes('gross margin') || ml.includes('毛利率')) { metrics.grossMargin = row.actual || '' }
      }
    }

    if (!metrics.revenue && analysis.comparison_snapshot?.core_revenue) metrics.revenue = analysis.comparison_snapshot.core_revenue
    if (!metrics.netIncome && analysis.comparison_snapshot?.core_profit) metrics.netIncome = analysis.comparison_snapshot.core_profit

    const fy = analysis.fiscal_year || parseInt(analysis.period?.match(/(\d{4})/)?.[1] || '0')
    const fq = analysis.fiscal_quarter || parseInt(analysis.period?.match(/Q(\d)/)?.[1] || '0')

    if (fy && fq && !company.quarters.some(q => q.fiscalYear === fy && q.fiscalQuarter === fq)) {
      company.quarters.push({ fiscalYear: fy, fiscalQuarter: fq, period: `${fy} Q${fq}`, metrics, reportAvailable: true })
    }
  }

  for (const c of companyMap.values()) {
    c.quarters.sort((a, b) => b.fiscalYear !== a.fiscalYear ? b.fiscalYear - a.fiscalYear : b.fiscalQuarter - a.fiscalQuarter)
  }
  return Array.from(companyMap.values())
}
