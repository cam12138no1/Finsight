/**
 * One-time migration: copy analysis records from Vercel Blob → Postgres uploaded_analyses table.
 *
 * Usage:
 *   npx tsx scripts/migrate-blob-to-pg.ts
 *
 * Required env vars: BLOB_READ_WRITE_TOKEN, DATABASE_URL (or POSTGRES_URL)
 */

import { list } from '@vercel/blob'
import { sql } from '@vercel/postgres'

const BLOB_PREFIX = 'analyses/'

const ANALYSIS_JSON_FIELDS = [
  'one_line_conclusion', 'results_summary', 'results_table', 'results_explanation',
  'drivers_summary', 'drivers', 'investment_roi', 'sustainability_risks',
  'comparison_snapshot', 'research_comparison', 'model_impact', 'final_judgment',
  'investment_committee_summary', 'metadata',
]

async function main() {
  console.log('=== Blob → Postgres migration ===')

  // 1. Ensure target table
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
  console.log('Table ensured.')

  // 2. List all blobs
  const { blobs } = await list({ prefix: BLOB_PREFIX })
  console.log(`Found ${blobs.length} blobs`)

  // Dedupe by pathname (keep latest upload)
  const latestMap = new Map<string, typeof blobs[0]>()
  for (const blob of blobs) {
    if (blob.pathname.endsWith('_index.json')) continue
    const existing = latestMap.get(blob.pathname)
    if (!existing || new Date(blob.uploadedAt) > new Date(existing.uploadedAt)) {
      latestMap.set(blob.pathname, blob)
    }
  }
  const uniqueBlobs = Array.from(latestMap.values())
  console.log(`${uniqueBlobs.length} unique blobs to migrate`)

  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const blob of uniqueBlobs) {
    try {
      // Fetch blob content (use downloadUrl for private blobs)
      const fetchUrl = (blob as any).downloadUrl || blob.url
      const token = process.env.BLOB_READ_WRITE_TOKEN
      const response = await fetch(fetchUrl === blob.url && token
        ? blob.url
        : fetchUrl, fetchUrl === blob.url && token
        ? { headers: { authorization: `Bearer ${token}` } }
        : undefined
      )

      if (!response.ok) {
        console.error(`  SKIP ${blob.pathname}: HTTP ${response.status}`)
        failed++
        continue
      }

      const data = await response.json()

      // Extract analysis JSON fields
      const analysisData: Record<string, any> = {}
      for (const field of ANALYSIS_JSON_FIELDS) {
        if (data[field] !== undefined) {
          analysisData[field] = data[field]
        }
      }

      const id = data.id || blob.pathname.split('/').pop()?.replace('.json', '') || `blob_${Date.now()}`
      const userId = data.user_id || '1'
      const requestId = data.request_id || id.replace('req_', '')

      // Upsert into Postgres
      await sql`
        INSERT INTO uploaded_analyses (
          id, user_id, request_id, company_name, company_symbol, report_type,
          fiscal_year, fiscal_quarter, period, category, filing_date,
          processed, processing, error, has_research_report, analysis_data, created_at
        ) VALUES (
          ${id}, ${userId}, ${requestId},
          ${data.company_name || 'Unknown'}, ${data.company_symbol || 'UNKNOWN'},
          ${data.report_type || '10-Q'},
          ${data.fiscal_year || 2025}, ${data.fiscal_quarter ?? null},
          ${data.period ?? null}, ${data.category ?? null},
          ${data.filing_date || new Date().toISOString().split('T')[0]},
          ${data.processed ?? false}, ${false},
          ${data.error ?? null}, ${data.has_research_report ?? false},
          ${JSON.stringify(analysisData)}::jsonb,
          ${data.created_at || new Date().toISOString()}
        )
        ON CONFLICT (id) DO NOTHING
      `
      migrated++
      console.log(`  OK ${blob.pathname} → ${id}`)
    } catch (err: any) {
      console.error(`  FAIL ${blob.pathname}: ${err.message}`)
      failed++
    }
  }

  console.log(`\n=== Migration complete ===`)
  console.log(`Migrated: ${migrated}`)
  console.log(`Skipped/Failed: ${failed}`)
  console.log(`Total blobs: ${uniqueBlobs.length}`)

  // Verify
  const count = await sql`SELECT COUNT(*) as cnt FROM uploaded_analyses`
  console.log(`Rows in uploaded_analyses: ${count.rows[0].cnt}`)
}

main().catch(console.error)
