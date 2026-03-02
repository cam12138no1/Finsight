import { sql } from '@vercel/postgres'

export interface FetchedFinancial {
  id: number
  symbol: string
  company_name: string
  category: string
  fiscal_year: number
  fiscal_quarter: number
  period: string
  revenue: string | null
  revenue_yoy: string | null
  net_income: string | null
  net_income_yoy: string | null
  eps: string | null
  eps_yoy: string | null
  operating_margin: string | null
  gross_margin: string | null
  report_text: string | null
  report_url: string | null
  filing_date: string | null
  analysis_result: any | null
  analyzed_at: Date | null
  fetched_at: Date
  updated_at: Date
}

export async function ensureFetchedFinancialsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS fetched_financials (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(20) NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      fiscal_year INTEGER NOT NULL,
      fiscal_quarter INTEGER NOT NULL,
      period VARCHAR(20) NOT NULL,
      revenue VARCHAR(50),
      revenue_yoy VARCHAR(50),
      net_income VARCHAR(50),
      net_income_yoy VARCHAR(50),
      eps VARCHAR(50),
      eps_yoy VARCHAR(50),
      operating_margin VARCHAR(50),
      gross_margin VARCHAR(50),
      report_text TEXT,
      report_url VARCHAR(500),
      filing_date VARCHAR(50),
      analysis_result JSONB,
      analyzed_at TIMESTAMP,
      fetched_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(symbol, fiscal_year, fiscal_quarter)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_fetched_financials_symbol ON fetched_financials(symbol)`
  await sql`CREATE INDEX IF NOT EXISTS idx_fetched_financials_category ON fetched_financials(category)`

  await sql`
    CREATE TABLE IF NOT EXISTS cron_job_log (
      id SERIAL PRIMARY KEY,
      job_name VARCHAR(100) NOT NULL,
      started_at TIMESTAMP DEFAULT NOW(),
      finished_at TIMESTAMP,
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      companies_checked INTEGER DEFAULT 0,
      new_reports_found INTEGER DEFAULT 0,
      errors TEXT,
      details JSONB
    )
  `
}

/**
 * Upsert a fetched financial record.
 * If the same (symbol, fiscal_year, fiscal_quarter) exists, update metrics.
 */
export async function upsertFetchedFinancial(data: {
  symbol: string
  company_name: string
  category: string
  fiscal_year: number
  fiscal_quarter: number
  period: string
  revenue?: string | null
  revenue_yoy?: string | null
  net_income?: string | null
  net_income_yoy?: string | null
  eps?: string | null
  eps_yoy?: string | null
  operating_margin?: string | null
  gross_margin?: string | null
  report_text?: string | null
  report_url?: string | null
  filing_date?: string | null
}): Promise<FetchedFinancial> {
  const result = await sql`
    INSERT INTO fetched_financials (
      symbol, company_name, category, fiscal_year, fiscal_quarter, period,
      revenue, revenue_yoy, net_income, net_income_yoy, eps, eps_yoy,
      operating_margin, gross_margin, report_text, report_url, filing_date
    ) VALUES (
      ${data.symbol}, ${data.company_name}, ${data.category},
      ${data.fiscal_year}, ${data.fiscal_quarter}, ${data.period},
      ${data.revenue || null}, ${data.revenue_yoy || null},
      ${data.net_income || null}, ${data.net_income_yoy || null},
      ${data.eps || null}, ${data.eps_yoy || null},
      ${data.operating_margin || null}, ${data.gross_margin || null},
      ${data.report_text || null}, ${data.report_url || null},
      ${data.filing_date || null}
    )
    ON CONFLICT (symbol, fiscal_year, fiscal_quarter)
    DO UPDATE SET
      revenue = COALESCE(EXCLUDED.revenue, fetched_financials.revenue),
      revenue_yoy = COALESCE(EXCLUDED.revenue_yoy, fetched_financials.revenue_yoy),
      net_income = COALESCE(EXCLUDED.net_income, fetched_financials.net_income),
      net_income_yoy = COALESCE(EXCLUDED.net_income_yoy, fetched_financials.net_income_yoy),
      eps = COALESCE(EXCLUDED.eps, fetched_financials.eps),
      eps_yoy = COALESCE(EXCLUDED.eps_yoy, fetched_financials.eps_yoy),
      operating_margin = COALESCE(EXCLUDED.operating_margin, fetched_financials.operating_margin),
      gross_margin = COALESCE(EXCLUDED.gross_margin, fetched_financials.gross_margin),
      report_text = COALESCE(EXCLUDED.report_text, fetched_financials.report_text),
      report_url = COALESCE(EXCLUDED.report_url, fetched_financials.report_url),
      filing_date = COALESCE(EXCLUDED.filing_date, fetched_financials.filing_date),
      updated_at = NOW()
    RETURNING *
  `
  return result.rows[0] as FetchedFinancial
}

/**
 * Save AI analysis result for a fetched financial record
 */
export async function saveAnalysisResult(
  symbol: string,
  fiscalYear: number,
  fiscalQuarter: number,
  analysisResult: any
): Promise<void> {
  await sql`
    UPDATE fetched_financials
    SET analysis_result = ${JSON.stringify(analysisResult)}::jsonb,
        analyzed_at = NOW(),
        updated_at = NOW()
    WHERE symbol = ${symbol}
      AND fiscal_year = ${fiscalYear}
      AND fiscal_quarter = ${fiscalQuarter}
  `
}

/**
 * Get all fetched financials for a company, sorted newest first
 */
export async function getFetchedFinancialsBySymbol(symbol: string): Promise<FetchedFinancial[]> {
  const result = await sql`
    SELECT * FROM fetched_financials
    WHERE symbol = ${symbol}
    ORDER BY fiscal_year DESC, fiscal_quarter DESC
  `
  return result.rows as FetchedFinancial[]
}

/**
 * Get all fetched financials for a category
 */
export async function getFetchedFinancialsByCategory(category: string): Promise<FetchedFinancial[]> {
  const result = await sql`
    SELECT * FROM fetched_financials
    WHERE category = ${category}
    ORDER BY symbol ASC, fiscal_year DESC, fiscal_quarter DESC
  `
  return result.rows as FetchedFinancial[]
}

/**
 * Get all fetched financials (all companies)
 */
export async function getAllFetchedFinancials(): Promise<FetchedFinancial[]> {
  const result = await sql`
    SELECT * FROM fetched_financials
    ORDER BY symbol ASC, fiscal_year DESC, fiscal_quarter DESC
  `
  return result.rows as FetchedFinancial[]
}

/**
 * Get a specific quarter's data for a company
 */
export async function getFetchedQuarter(
  symbol: string,
  fiscalYear: number,
  fiscalQuarter: number
): Promise<FetchedFinancial | null> {
  const result = await sql`
    SELECT * FROM fetched_financials
    WHERE symbol = ${symbol}
      AND fiscal_year = ${fiscalYear}
      AND fiscal_quarter = ${fiscalQuarter}
  `
  return (result.rows[0] as FetchedFinancial) || null
}

/**
 * Get records that have report_text but no analysis_result yet
 */
export async function getUnanalyzedRecords(): Promise<FetchedFinancial[]> {
  const result = await sql`
    SELECT * FROM fetched_financials
    WHERE report_text IS NOT NULL
      AND report_text != ''
      AND analysis_result IS NULL
    ORDER BY fetched_at DESC
  `
  return result.rows as FetchedFinancial[]
}

/**
 * Log cron job execution
 */
export async function logCronJobStart(jobName: string): Promise<number> {
  const result = await sql`
    INSERT INTO cron_job_log (job_name, status)
    VALUES (${jobName}, 'running')
    RETURNING id
  `
  return result.rows[0].id
}

export async function logCronJobEnd(
  logId: number,
  status: 'success' | 'error',
  companiesChecked: number,
  newReportsFound: number,
  errors?: string,
  details?: any
): Promise<void> {
  await sql`
    UPDATE cron_job_log
    SET finished_at = NOW(),
        status = ${status},
        companies_checked = ${companiesChecked},
        new_reports_found = ${newReportsFound},
        errors = ${errors || null},
        details = ${details ? JSON.stringify(details) : null}::jsonb
    WHERE id = ${logId}
  `
}

/**
 * Get distinct symbols stored in fetched_financials
 */
export async function getStoredSymbols(): Promise<string[]> {
  const result = await sql`
    SELECT DISTINCT symbol FROM fetched_financials ORDER BY symbol
  `
  return result.rows.map(r => r.symbol)
}
