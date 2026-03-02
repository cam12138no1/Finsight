// lib/financial-api.ts - Financial data API service layer
// Fetches quarterly and annual financial reports from the data team's API

import { Company, CompanyCategory, getAllCompanies, getCompanyCategoryBySymbol } from './companies'

export interface QuarterlyMetrics {
  revenue: string        // e.g. "$42.31B"
  revenueYoY: string     // e.g. "+18.00%"
  netIncome: string      // e.g. "$15.02B"
  netIncomeYoY: string   // e.g. "+25.00%"
  eps: string            // e.g. "$2.82"
  epsYoY: string         // e.g. "+31.16%"
  operatingMargin: string // e.g. "35.20%"
  grossMargin: string    // e.g. "78.50%"
}

export interface QuarterData {
  fiscalYear: number
  fiscalQuarter: number
  period: string          // e.g. "2025 Q4"
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

// Core metrics displayed on homepage table
export interface CoreMetric {
  label: string
  key: keyof QuarterlyMetrics
}

export const CORE_METRICS: CoreMetric[] = [
  { label: 'Net Income', key: 'netIncome' },
  { label: 'Revenue', key: 'revenue' },
  { label: 'EPS', key: 'eps' },
]

// API base URL - will be provided by data team
const FINANCIAL_API_BASE = process.env.FINANCIAL_API_BASE_URL || ''

/**
 * Fetch financial data for a specific company
 * The data team's API provides quarterly and annual reports, updated daily
 */
export async function fetchCompanyFinancials(symbol: string): Promise<CompanyFinancialData | null> {
  if (!FINANCIAL_API_BASE) {
    // When API is not configured, return null (will use local data)
    return null
  }

  try {
    const response = await fetch(`${FINANCIAL_API_BASE}/api/financials/${symbol}`, {
      next: { revalidate: 86400 }, // Cache for 24 hours (daily update)
    })
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error(`[Financial API] Failed to fetch ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch financial data for all companies in a category
 */
export async function fetchCategoryFinancials(category: CompanyCategory): Promise<CompanyFinancialData[]> {
  if (!FINANCIAL_API_BASE) {
    return []
  }

  try {
    const response = await fetch(`${FINANCIAL_API_BASE}/api/financials/category/${category}`, {
      next: { revalidate: 86400 },
    })
    if (!response.ok) return []
    return await response.json()
  } catch (error) {
    console.error(`[Financial API] Failed to fetch category ${category}:`, error)
    return []
  }
}

/**
 * Fetch financial report content for a specific quarter
 * Returns the raw financial report text for AI analysis
 */
export async function fetchQuarterReport(symbol: string, year: number, quarter: number): Promise<string | null> {
  if (!FINANCIAL_API_BASE) {
    return null
  }

  try {
    const response = await fetch(`${FINANCIAL_API_BASE}/api/reports/${symbol}/${year}/Q${quarter}`, {
      next: { revalidate: 86400 },
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.reportText || null
  } catch (error) {
    console.error(`[Financial API] Failed to fetch report for ${symbol} ${year} Q${quarter}:`, error)
    return null
  }
}

/**
 * Fetch the S3 download link for a company's financial report
 * The data team's API returns AWS S3 download links for each report
 */
export async function fetchReportDownloadUrl(symbol: string, year: number, quarter: number): Promise<string | null> {
  if (!FINANCIAL_API_BASE) {
    return null
  }

  try {
    const response = await fetch(`${FINANCIAL_API_BASE}/api/reports/${symbol}/${year}/Q${quarter}/download`, {
      next: { revalidate: 86400 },
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.downloadUrl || data.s3Url || null
  } catch (error) {
    console.error(`[Financial API] Failed to fetch download URL for ${symbol} ${year} Q${quarter}:`, error)
    return null
  }
}

/**
 * Download and extract text from an S3 report URL
 * Used when processing reports from the data team's API
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

    // Extract metrics from results table
    const metrics: QuarterlyMetrics = {
      revenue: '',
      revenueYoY: '',
      netIncome: '',
      netIncomeYoY: '',
      eps: '',
      epsYoY: '',
      operatingMargin: '',
      grossMargin: '',
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

    // Use comparison_snapshot as fallback
    if (!metrics.revenue && analysis.comparison_snapshot?.core_revenue) {
      metrics.revenue = analysis.comparison_snapshot.core_revenue
    }
    if (!metrics.netIncome && analysis.comparison_snapshot?.core_profit) {
      metrics.netIncome = analysis.comparison_snapshot.core_profit
    }

    const fiscalYear = analysis.fiscal_year || parseInt(analysis.period?.match(/(\d{4})/)?.[1] || '0')
    const fiscalQuarter = analysis.fiscal_quarter || parseInt(analysis.period?.match(/Q(\d)/)?.[1] || '0')

    if (fiscalYear && fiscalQuarter) {
      // Avoid duplicate quarters
      const exists = company.quarters.some(
        q => q.fiscalYear === fiscalYear && q.fiscalQuarter === fiscalQuarter
      )
      if (!exists) {
        company.quarters.push({
          fiscalYear,
          fiscalQuarter,
          period: `${fiscalYear} Q${fiscalQuarter}`,
          metrics,
          reportAvailable: true,
        })
      }
    }
  }

  // Sort quarters from newest to oldest within each company
  for (const company of companyMap.values()) {
    company.quarters.sort((a, b) => {
      if (b.fiscalYear !== a.fiscalYear) return b.fiscalYear - a.fiscalYear
      return b.fiscalQuarter - a.fiscalQuarter
    })
  }

  return Array.from(companyMap.values())
}
