// lib/store.ts - 用户隔离的数据存储 (Postgres-backed)
import { sql } from '@vercel/postgres'
import { AnalysisResult, ResultsTableRow, DriverDetail } from './ai/analyzer'

export interface StoredAnalysis {
  id: string
  user_id: string
  company_name: string
  company_symbol: string
  report_type: string
  fiscal_year: number
  fiscal_quarter?: number
  period?: string
  category?: string
  request_id?: string
  filing_date: string
  created_at: string
  processed: boolean
  processing?: boolean
  error?: string
  has_research_report?: boolean
  
  one_line_conclusion?: string
  results_summary?: string
  results_table?: ResultsTableRow[]
  results_explanation?: string
  drivers_summary?: string
  drivers?: {
    demand: DriverDetail
    monetization: DriverDetail
    efficiency: DriverDetail
  }
  investment_roi?: {
    capex_change: string
    opex_change: string
    investment_direction: string
    roi_evidence: string[]
    management_commitment: string
  }
  sustainability_risks?: {
    sustainable_drivers: string[]
    main_risks: string[]
    checkpoints: string[]
  }
  comparison_snapshot?: {
    core_revenue: string
    core_profit: string
    guidance: string
    core_driver_quantified: string
    main_risk_quantified: string
    beat_miss?: string
    recommendation?: string
    position_action?: string
    next_quarter_focus?: string
  }
  research_comparison?: {
    consensus_source: string
    key_differences: string[]
    analyst_blind_spots: string
    beat_miss_summary?: string
  }
  model_impact?: {
    upgrade_factors: string[]
    downgrade_factors: string[]
    logic_chain: string
  }
  final_judgment?: {
    confidence: string
    concerns: string
    watch_list: string
    net_impact: string
    long_term_narrative: string
    recommendation: string
  }
  investment_committee_summary?: string
  metadata?: {
    company_category: string
    analysis_timestamp: string
    prompt_version: string
    has_research_report?: boolean
  }
}

// Analysis fields that go into the JSONB analysis_data column
const ANALYSIS_JSON_FIELDS = [
  'one_line_conclusion', 'results_summary', 'results_table', 'results_explanation',
  'drivers_summary', 'drivers', 'investment_roi', 'sustainability_risks',
  'comparison_snapshot', 'research_comparison', 'model_impact', 'final_judgment',
  'investment_committee_summary', 'metadata',
] as const

function rowToStoredAnalysis(row: any): StoredAnalysis {
  const analysis: StoredAnalysis = {
    id: row.id,
    user_id: row.user_id,
    company_name: row.company_name,
    company_symbol: row.company_symbol,
    report_type: row.report_type,
    fiscal_year: row.fiscal_year,
    fiscal_quarter: row.fiscal_quarter ?? undefined,
    period: row.period ?? undefined,
    category: row.category ?? undefined,
    request_id: row.request_id ?? undefined,
    filing_date: row.filing_date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    processed: row.processed ?? false,
    processing: row.processing ?? false,
    error: row.error ?? undefined,
    has_research_report: row.has_research_report ?? false,
  }

  // Merge analysis_data JSONB into the flat object
  if (row.analysis_data && typeof row.analysis_data === 'object') {
    Object.assign(analysis, row.analysis_data)
  }

  return analysis
}

function extractAnalysisData(input: Partial<StoredAnalysis>): Record<string, any> {
  const data: Record<string, any> = {}
  for (const field of ANALYSIS_JSON_FIELDS) {
    if (input[field] !== undefined) {
      data[field] = input[field]
    }
  }
  return data
}

class AnalysisStore {
  private initialized = false

  private async ensureTable(): Promise<void> {
    if (this.initialized) return
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS uploaded_analyses (
          id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(50) NOT NULL,
          request_id VARCHAR(100),
          company_name VARCHAR(255) NOT NULL,
          company_symbol VARCHAR(20) NOT NULL,
          report_type VARCHAR(50) NOT NULL,
          fiscal_year INTEGER NOT NULL,
          fiscal_quarter INTEGER,
          period VARCHAR(20),
          category VARCHAR(50),
          filing_date VARCHAR(50) NOT NULL,
          processed BOOLEAN DEFAULT FALSE,
          processing BOOLEAN DEFAULT FALSE,
          error TEXT,
          has_research_report BOOLEAN DEFAULT FALSE,
          analysis_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_uploaded_analyses_user_id ON uploaded_analyses(user_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_uploaded_analyses_symbol ON uploaded_analyses(company_symbol)`
      await sql`CREATE INDEX IF NOT EXISTS idx_uploaded_analyses_request ON uploaded_analyses(user_id, request_id)`
      this.initialized = true
    } catch (error) {
      console.error('[Store] Failed to ensure table:', error)
      throw error
    }
  }

  async addWithRequestId(
    userId: string,
    requestId: string,
    analysis: Omit<StoredAnalysis, 'id' | 'user_id'>
  ): Promise<StoredAnalysis> {
    if (!userId || !requestId) {
      throw new Error('[Store] userId and requestId are required')
    }
    await this.ensureTable()

    const id = `req_${requestId}`
    const analysisData = extractAnalysisData(analysis)

    const result = await sql`
      INSERT INTO uploaded_analyses (
        id, user_id, request_id, company_name, company_symbol, report_type,
        fiscal_year, fiscal_quarter, period, category, filing_date,
        processed, processing, error, has_research_report, analysis_data, created_at
      ) VALUES (
        ${id}, ${userId}, ${requestId},
        ${analysis.company_name}, ${analysis.company_symbol}, ${analysis.report_type},
        ${analysis.fiscal_year}, ${analysis.fiscal_quarter ?? null},
        ${analysis.period ?? null}, ${analysis.category ?? null},
        ${analysis.filing_date},
        ${analysis.processed ?? false}, ${analysis.processing ?? false},
        ${analysis.error ?? null}, ${analysis.has_research_report ?? false},
        ${JSON.stringify(analysisData)}::jsonb,
        ${analysis.created_at ?? new Date().toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET
        processed = EXCLUDED.processed,
        processing = EXCLUDED.processing,
        error = EXCLUDED.error,
        analysis_data = EXCLUDED.analysis_data,
        updated_at = NOW()
      RETURNING *
    `

    console.log(`[Store] Added: user=${userId}, request=${requestId}`)
    return rowToStoredAnalysis(result.rows[0])
  }

  async getAll(userId: string): Promise<StoredAnalysis[]> {
    if (!userId) {
      console.warn('[Store] getAll called without userId, returning empty array')
      return []
    }
    await this.ensureTable()

    const result = await sql`
      SELECT * FROM uploaded_analyses
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `

    console.log(`[Store] User ${userId}: returning ${result.rows.length} records`)
    return result.rows.map(rowToStoredAnalysis)
  }

  async getAllLegacy(): Promise<StoredAnalysis[]> {
    await this.ensureTable()
    const result = await sql`
      SELECT * FROM uploaded_analyses
      ORDER BY created_at DESC
    `
    return result.rows.map(rowToStoredAnalysis)
  }

  async update(
    userId: string,
    id: string,
    updates: Partial<StoredAnalysis>
  ): Promise<StoredAnalysis | undefined> {
    if (!userId) {
      console.warn('[Store] update called without userId')
      return undefined
    }
    await this.ensureTable()

    const existing = await this.get(userId, id)
    if (!existing) {
      console.warn(`[Store] Update failed: record not found user=${userId}, id=${id}`)
      return undefined
    }

    const existingData = extractAnalysisData(existing)
    const newData = extractAnalysisData(updates)
    const mergedData = { ...existingData, ...newData }

    // When 'error' key is explicitly present (even as undefined), clear it
    const errorValue = 'error' in updates ? (updates.error ?? null) : (existing.error ?? null)

    const result = await sql`
      UPDATE uploaded_analyses SET
        processed = ${updates.processed ?? existing.processed},
        processing = ${updates.processing ?? existing.processing ?? false},
        error = ${errorValue},
        has_research_report = ${updates.has_research_report ?? existing.has_research_report ?? false},
        company_name = ${updates.company_name ?? existing.company_name},
        company_symbol = ${updates.company_symbol ?? existing.company_symbol},
        analysis_data = ${JSON.stringify(mergedData)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `

    if (result.rows.length === 0) return undefined
    console.log(`[Store] Updated: user=${userId}, id=${id}`)
    return rowToStoredAnalysis(result.rows[0])
  }

  async get(userId: string, id: string): Promise<StoredAnalysis | undefined> {
    if (!userId) {
      console.warn('[Store] get called without userId')
      return undefined
    }
    await this.ensureTable()

    const result = await sql`
      SELECT * FROM uploaded_analyses
      WHERE id = ${id} AND user_id = ${userId}
    `

    if (result.rows.length === 0) return undefined
    return rowToStoredAnalysis(result.rows[0])
  }

  async getByRequestId(userId: string, requestId: string): Promise<StoredAnalysis | undefined> {
    if (!userId || !requestId) return undefined
    return this.get(userId, `req_${requestId}`)
  }

  async delete(userId: string, id: string): Promise<boolean> {
    if (!userId) {
      console.warn('[Store] delete called without userId')
      return false
    }
    await this.ensureTable()

    const result = await sql`
      DELETE FROM uploaded_analyses
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `

    const deleted = (result.rowCount || 0) > 0
    if (deleted) console.log(`[Store] Deleted: user=${userId}, id=${id}`)
    return deleted
  }

  async deleteStale(userId: string, maxAgeMinutes: number = 30): Promise<number> {
    await this.ensureTable()
    const result = await sql`
      DELETE FROM uploaded_analyses
      WHERE user_id = ${userId}
        AND processing = true
        AND created_at < NOW() - INTERVAL '1 minute' * ${maxAgeMinutes}
      RETURNING id
    `
    const count = result.rowCount || 0
    if (count > 0) console.log(`[Store] Deleted ${count} stale records for user ${userId}`)
    return count
  }

  async getUserStats(userId: string): Promise<{
    total: number
    processing: number
    completed: number
    failed: number
  }> {
    await this.ensureTable()
    const result = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE processing = true)::int AS processing,
        COUNT(*) FILTER (WHERE processed = true AND error IS NULL)::int AS completed,
        COUNT(*) FILTER (WHERE error IS NOT NULL)::int AS failed
      FROM uploaded_analyses
      WHERE user_id = ${userId}
    `
    const row = result.rows[0]
    return {
      total: row.total || 0,
      processing: row.processing || 0,
      completed: row.completed || 0,
      failed: row.failed || 0,
    }
  }

  async clearUser(userId: string): Promise<number> {
    if (!userId) return 0
    await this.ensureTable()

    const result = await sql`
      DELETE FROM uploaded_analyses
      WHERE user_id = ${userId}
      RETURNING id
    `
    const count = result.rowCount || 0
    console.log(`[Store] Cleared ${count} records for user ${userId}`)
    return count
  }
}

// Singleton instance
export const analysisStore = new AnalysisStore()
