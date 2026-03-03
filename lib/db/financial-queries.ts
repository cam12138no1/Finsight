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

export interface TranscriptConclusion {
  summary: string
  speaker: string
  category: 'guidance' | 'strategy' | 'risk' | 'investment' | 'performance' | 'other'
  original_quote: string
}

export interface FetchedTranscript {
  id: number
  symbol: string
  fiscal_year: number
  fiscal_quarter: number
  transcript_date: string
  transcript_api_id: string
  content: string
  content_length: number
  word_count: number
  speakers: string[]
  key_conclusions: TranscriptConclusion[] | null
  fetched_at: Date
}

export async function ensureFetchedFinancialsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS fetched_transcripts (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(20) NOT NULL,
      fiscal_year INTEGER NOT NULL,
      fiscal_quarter INTEGER NOT NULL,
      transcript_date VARCHAR(50),
      transcript_api_id VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      content_length INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      speakers TEXT[] DEFAULT ARRAY[]::TEXT[],
      key_conclusions JSONB,
      fetched_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(symbol, fiscal_year, fiscal_quarter)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_fetched_transcripts_symbol ON fetched_transcripts(symbol)`

  try {
    await sql`ALTER TABLE fetched_transcripts ADD COLUMN IF NOT EXISTS key_conclusions JSONB`
  } catch { /* column may already exist */ }

  await sql`
    CREATE TABLE IF NOT EXISTS research_reports (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      symbol VARCHAR(20) NOT NULL,
      fiscal_year INTEGER NOT NULL,
      fiscal_quarter INTEGER NOT NULL,
      research_text TEXT NOT NULL,
      file_name VARCHAR(255),
      analysis_result JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

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

// ============================================================
// Transcript queries
// ============================================================

/**
 * Upsert a transcript record
 */
export async function upsertTranscript(data: {
  symbol: string
  fiscal_year: number
  fiscal_quarter: number
  transcript_date: string
  transcript_api_id: string
  content: string
  content_length: number
  word_count: number
  speakers: string[]
}): Promise<void> {
  await sql`
    INSERT INTO fetched_transcripts (
      symbol, fiscal_year, fiscal_quarter, transcript_date,
      transcript_api_id, content, content_length, word_count, speakers
    ) VALUES (
      ${data.symbol}, ${data.fiscal_year}, ${data.fiscal_quarter},
      ${data.transcript_date}, ${data.transcript_api_id},
      ${data.content}, ${data.content_length}, ${data.word_count},
      ${data.speakers as any}
    )
    ON CONFLICT (symbol, fiscal_year, fiscal_quarter)
    DO UPDATE SET
      content = EXCLUDED.content,
      content_length = EXCLUDED.content_length,
      word_count = EXCLUDED.word_count,
      speakers = EXCLUDED.speakers,
      transcript_date = EXCLUDED.transcript_date,
      fetched_at = NOW()
  `
}

/**
 * Get transcript for a specific quarter
 */
export async function getTranscript(
  symbol: string,
  fiscalYear: number,
  fiscalQuarter: number
): Promise<FetchedTranscript | null> {
  const result = await sql`
    SELECT * FROM fetched_transcripts
    WHERE symbol = ${symbol}
      AND fiscal_year = ${fiscalYear}
      AND fiscal_quarter = ${fiscalQuarter}
  `
  return (result.rows[0] as FetchedTranscript) || null
}

/**
 * Get all transcripts for a company
 */
export async function getTranscriptsBySymbol(symbol: string): Promise<FetchedTranscript[]> {
  const result = await sql`
    SELECT * FROM fetched_transcripts
    WHERE symbol = ${symbol}
    ORDER BY fiscal_year DESC, fiscal_quarter DESC
  `
  return result.rows as FetchedTranscript[]
}

/**
 * Save AI-extracted key conclusions for a transcript
 */
export async function saveTranscriptConclusions(
  symbol: string,
  fiscalYear: number,
  fiscalQuarter: number,
  conclusions: TranscriptConclusion[]
): Promise<void> {
  await sql`
    UPDATE fetched_transcripts
    SET key_conclusions = ${JSON.stringify(conclusions)}::jsonb
    WHERE symbol = ${symbol}
      AND fiscal_year = ${fiscalYear}
      AND fiscal_quarter = ${fiscalQuarter}
  `
}

/**
 * Get transcripts that have content but no key_conclusions yet
 */
export async function getTranscriptsWithoutConclusions(): Promise<FetchedTranscript[]> {
  const result = await sql`
    SELECT * FROM fetched_transcripts
    WHERE content IS NOT NULL
      AND content != ''
      AND key_conclusions IS NULL
    ORDER BY fetched_at DESC
  `
  return result.rows as FetchedTranscript[]
}

// ============================================================
// Research report queries
// ============================================================

export async function saveResearchReport(data: {
  userId: string
  symbol: string
  fiscalYear: number
  fiscalQuarter: number
  researchText: string
  fileName: string
}): Promise<number> {
  const result = await sql`
    INSERT INTO research_reports (user_id, symbol, fiscal_year, fiscal_quarter, research_text, file_name)
    VALUES (${data.userId}, ${data.symbol}, ${data.fiscalYear}, ${data.fiscalQuarter}, ${data.researchText}, ${data.fileName})
    RETURNING id
  `
  return result.rows[0].id
}

export async function updateResearchAnalysis(id: number, analysisResult: any): Promise<void> {
  await sql`
    UPDATE research_reports
    SET analysis_result = ${JSON.stringify(analysisResult)}::jsonb
    WHERE id = ${id}
  `
}

export async function getResearchReport(
  userId: string, symbol: string, fiscalYear: number, fiscalQuarter: number
): Promise<{ id: number; research_text: string; analysis_result: any } | null> {
  const result = await sql`
    SELECT id, research_text, analysis_result FROM research_reports
    WHERE user_id = ${userId} AND symbol = ${symbol}
      AND fiscal_year = ${fiscalYear} AND fiscal_quarter = ${fiscalQuarter}
    ORDER BY created_at DESC LIMIT 1
  `
  return (result.rows[0] as any) || null
}

export async function getResearchReportsByUser(userId: string): Promise<Array<{
  id: number; symbol: string; fiscal_year: number; fiscal_quarter: number;
  file_name: string; analysis_result: any; created_at: string;
}>> {
  const result = await sql`
    SELECT id, symbol, fiscal_year, fiscal_quarter, file_name, analysis_result, created_at
    FROM research_reports
    WHERE user_id = ${userId} AND analysis_result IS NOT NULL
    ORDER BY created_at DESC
  `
  return result.rows as any[]
}

export async function deleteResearchReport(id: number, userId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM research_reports
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `
  return (result.rowCount || 0) > 0
}

/**
 * Reset all key_conclusions to null (for re-extraction with updated prompt)
 */
export async function resetAllConclusions(): Promise<number> {
  const result = await sql`
    UPDATE fetched_transcripts
    SET key_conclusions = NULL
    WHERE key_conclusions IS NOT NULL
    RETURNING id
  `
  return result.rowCount || 0
}
