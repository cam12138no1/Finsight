// lib/financial-api.ts - Financial data API service layer
// Adapts the data team's API response format to our internal data model

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
// Raw API response types (from colleague's API)
// ============================================================

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

// ============================================================
// Number formatting helpers
// ============================================================

function formatDollarBillions(raw: string | number | null | undefined): string {
  if (!raw) return ''
  const num = typeof raw === 'string' ? parseFloat(raw) : raw
  if (isNaN(num)) return ''
  const billions = num / 1e9
  if (Math.abs(billions) >= 1) {
    return `$${billions.toFixed(2)}B`
  }
  const millions = num / 1e6
  return `$${millions.toFixed(2)}M`
}

function formatEps(raw: string | number | null | undefined): string {
  if (!raw) return ''
  const num = typeof raw === 'string' ? parseFloat(raw) : raw
  if (isNaN(num)) return ''
  return `$${num.toFixed(2)}`
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return ''
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function calcYoY(current: string | null | undefined, previous: string | null | undefined): string {
  if (!current || !previous) return ''
  const cur = parseFloat(current)
  const prev = parseFloat(previous)
  if (isNaN(cur) || isNaN(prev) || prev === 0) return ''
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  return formatPercent(pct)
}

function calcMargin(part: string | null | undefined, whole: string | null | undefined): string {
  if (!part || !whole) return ''
  const p = parseFloat(part)
  const w = parseFloat(whole)
  if (isNaN(p) || isNaN(w) || w === 0) return ''
  return `${((p / w) * 100).toFixed(2)}%`
}

// ============================================================
// Transform raw API response → our data model
// ============================================================

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

  const quarters: QuarterData[] = sorted.map((report, idx) => {
    const m = report.financial_metrics

    // Find same quarter from previous year for YoY calculation
    const prevYearReport = sorted.find(
      r => r.fiscal_year === report.fiscal_year - 1 && r.fiscal_quarter === report.fiscal_quarter
    )
    const pm = prevYearReport?.financial_metrics

    return {
      fiscalYear: report.fiscal_year,
      fiscalQuarter: report.fiscal_quarter,
      period: `${report.fiscal_year} Q${report.fiscal_quarter}`,
      filingDate: report.report_date,
      reportAvailable: !!report.s3_url,
      metrics: {
        revenue: formatDollarBillions(m.revenue),
        revenueYoY: calcYoY(m.revenue, pm?.revenue),
        netIncome: formatDollarBillions(m.net_income),
        netIncomeYoY: calcYoY(m.net_income, pm?.net_income),
        eps: formatEps(m.eps),
        epsYoY: calcYoY(m.eps, pm?.eps),
        operatingMargin: calcMargin(m.operating_income, m.revenue),
        grossMargin: calcMargin(m.gross_profit, m.revenue),
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
 * Fetch financial data for a specific company from the data team's API
 * Endpoint: GET /api/v1/reports/companies/{ticker}/reports?limit=8
 */
export async function fetchCompanyFinancials(symbol: string): Promise<CompanyFinancialData | null> {
  if (!FINANCIAL_API_BASE) return null

  try {
    const url = `${FINANCIAL_API_BASE}/api/v1/reports/companies/${encodeURIComponent(symbol)}/reports?limit=8`
    console.log(`[Financial API] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: { 'accept': 'application/json' },
      next: { revalidate: 86400 },
    })
    if (!response.ok) {
      console.log(`[Financial API] ${symbol}: HTTP ${response.status}`)
      return null
    }

    const rawData: RawQuarterReport[] = await response.json()
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return null

    const { getCompanyBySymbol } = await import('./companies')
    const company = getCompanyBySymbol(symbol)
    const category = getCompanyCategoryBySymbol(symbol) || 'AI_APPLICATION'

    return transformRawReports(
      rawData,
      company?.name || symbol,
      company?.nameZh || symbol,
      category
    )
  } catch (error) {
    console.error(`[Financial API] Failed to fetch ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch financial data for all companies in a category
 * Calls fetchCompanyFinancials for each company in the category
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
    } catch {
      console.error(`[Financial API] Failed to fetch ${company.symbol} in category ${category}`)
    }
  }

  return results
}

/**
 * Fetch the raw financial metrics JSON for a specific quarter
 * Used for AI analysis input
 */
export async function fetchQuarterReport(symbol: string, year: number, quarter: number): Promise<string | null> {
  if (!FINANCIAL_API_BASE) return null

  try {
    const url = `${FINANCIAL_API_BASE}/api/v1/reports/companies/${encodeURIComponent(symbol)}/reports?limit=12`
    const response = await fetch(url, {
      headers: { 'accept': 'application/json' },
      next: { revalidate: 86400 },
    })
    if (!response.ok) return null

    const rawData: RawQuarterReport[] = await response.json()
    if (!rawData || !Array.isArray(rawData)) return null

    const target = rawData.find(r => r.fiscal_year === year && r.fiscal_quarter === quarter)
    if (!target) return null

    // Return the financial_metrics as structured text for AI to parse
    return JSON.stringify(target.financial_metrics, null, 2)
  } catch (error) {
    console.error(`[Financial API] Failed to fetch report for ${symbol} ${year} Q${quarter}:`, error)
    return null
  }
}

/**
 * Fetch the S3 download link for a company's financial report PDF
 */
export async function fetchReportDownloadUrl(symbol: string, year: number, quarter: number): Promise<string | null> {
  if (!FINANCIAL_API_BASE) return null

  try {
    const url = `${FINANCIAL_API_BASE}/api/v1/reports/companies/${encodeURIComponent(symbol)}/reports?limit=12`
    const response = await fetch(url, {
      headers: { 'accept': 'application/json' },
      next: { revalidate: 86400 },
    })
    if (!response.ok) return null

    const rawData: RawQuarterReport[] = await response.json()
    if (!rawData || !Array.isArray(rawData)) return null

    const target = rawData.find(r => r.fiscal_year === year && r.fiscal_quarter === quarter)
    return target?.s3_url || null
  } catch (error) {
    console.error(`[Financial API] Failed to fetch download URL:`, error)
    return null
  }
}

/**
 * Download and extract text from an S3 report URL
 */
export async function downloadAndExtractReport(s3Url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(s3Url)
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error(`[Financial API] Failed to download from S3:`, error)
    return null
  }
}

/**
 * Build company financial data from local analysis store
 * Used as fallback when the external API is not configured
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
    results_table?: Array<{
      metric: string
      actual: string
      consensus: string
      delta: string
      assessment: string
    }>
    comparison_snapshot?: {
      core_revenue?: string
      core_profit?: string
    }
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
        symbol,
        name: analysis.company_name,
        nameZh: analysis.company_name,
        category,
        quarters: [],
        lastUpdated: analysis.created_at,
      })
    }

    const company = companyMap.get(symbol)!
    const metrics: QuarterlyMetrics = {
      revenue: '', revenueYoY: '', netIncome: '', netIncomeYoY: '',
      eps: '', epsYoY: '', operatingMargin: '', grossMargin: '',
    }

    if (analysis.results_table) {
      for (const row of analysis.results_table) {
        const metricLower = row.metric.toLowerCase()
        if (metricLower.includes('revenue') && !metricLower.includes('指引') && !metricLower.includes('guidance')) {
          metrics.revenue = row.actual || ''
          metrics.revenueYoY = row.delta || ''
        }
        if (metricLower.includes('net income') || metricLower.includes('净利润') || metricLower.includes('operating income')) {
          metrics.netIncome = row.actual || ''
          metrics.netIncomeYoY = row.delta || ''
        }
        if (metricLower.includes('eps')) {
          metrics.eps = row.actual || ''
          metrics.epsYoY = row.delta || ''
        }
        if (metricLower.includes('operating margin') || metricLower.includes('营业利润率')) {
          metrics.operatingMargin = row.actual || ''
        }
        if (metricLower.includes('gross margin') || metricLower.includes('毛利率')) {
          metrics.grossMargin = row.actual || ''
        }
      }
    }

    if (!metrics.revenue && analysis.comparison_snapshot?.core_revenue) {
      metrics.revenue = analysis.comparison_snapshot.core_revenue
    }
    if (!metrics.netIncome && analysis.comparison_snapshot?.core_profit) {
      metrics.netIncome = analysis.comparison_snapshot.core_profit
    }

    const fiscalYear = analysis.fiscal_year || parseInt(analysis.period?.match(/(\d{4})/)?.[1] || '0')
    const fiscalQuarter = analysis.fiscal_quarter || parseInt(analysis.period?.match(/Q(\d)/)?.[1] || '0')

    if (fiscalYear && fiscalQuarter) {
      const exists = company.quarters.some(
        q => q.fiscalYear === fiscalYear && q.fiscalQuarter === fiscalQuarter
      )
      if (!exists) {
        company.quarters.push({
          fiscalYear, fiscalQuarter,
          period: `${fiscalYear} Q${fiscalQuarter}`,
          metrics,
          reportAvailable: true,
        })
      }
    }
  }

  for (const company of companyMap.values()) {
    company.quarters.sort((a, b) => {
      if (b.fiscalYear !== a.fiscalYear) return b.fiscalYear - a.fiscalYear
      return b.fiscalQuarter - a.fiscalQuarter
    })
  }

  return Array.from(companyMap.values())
}
