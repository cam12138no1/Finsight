import { NextRequest, NextResponse } from 'next/server'
import { getAllCompanies, getCompanyCategoryBySymbol } from '@/lib/companies'
import {
  fetchCompanyFinancials,
  fetchQuarterReport,
} from '@/lib/financial-api'
import {
  ensureFetchedFinancialsTable,
  upsertFetchedFinancial,
  logCronJobStart,
  logCronJobEnd,
} from '@/lib/db/financial-queries'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/fetch-reports
 *
 * Vercel Cron calls this endpoint daily.
 * It iterates over all tracked companies, calls the data team's API,
 * and upserts new quarterly financial data into Postgres.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  let logId: number | null = null

  try {
    // Ensure database table exists
    await ensureFetchedFinancialsTable()

    logId = await logCronJobStart('fetch-reports')
    console.log(`[Cron] Starting daily financial report fetch...`)

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

        console.log(`[Cron] Fetching ${company.symbol} (${company.name})...`)

        const financialData = await fetchCompanyFinancials(company.symbol)

        if (!financialData || !financialData.quarters || financialData.quarters.length === 0) {
          console.log(`[Cron] No data returned for ${company.symbol}`)
          details[company.symbol] = { status: 'no_data' }
          continue
        }

        let companyNewCount = 0

        for (const quarter of financialData.quarters) {
          try {
            // Try to get the full report text for this quarter
            let reportText: string | null = null
            try {
              reportText = await fetchQuarterReport(
                company.symbol,
                quarter.fiscalYear,
                quarter.fiscalQuarter
              )
            } catch {
              // Report text not available yet, that's OK
            }

            await upsertFetchedFinancial({
              symbol: company.symbol,
              company_name: company.name,
              category,
              fiscal_year: quarter.fiscalYear,
              fiscal_quarter: quarter.fiscalQuarter,
              period: quarter.period || `${quarter.fiscalYear} Q${quarter.fiscalQuarter}`,
              revenue: quarter.metrics?.revenue || null,
              revenue_yoy: quarter.metrics?.revenueYoY || null,
              net_income: quarter.metrics?.netIncome || null,
              net_income_yoy: quarter.metrics?.netIncomeYoY || null,
              eps: quarter.metrics?.eps || null,
              eps_yoy: quarter.metrics?.epsYoY || null,
              operating_margin: quarter.metrics?.operatingMargin || null,
              gross_margin: quarter.metrics?.grossMargin || null,
              report_text: reportText,
              filing_date: quarter.filingDate || null,
            })

            companyNewCount++
          } catch (err: any) {
            const msg = `${company.symbol} ${quarter.period}: ${err.message}`
            console.error(`[Cron] Error upserting: ${msg}`)
            errors.push(msg)
          }
        }

        newReportsFound += companyNewCount
        details[company.symbol] = {
          status: 'ok',
          quarters_upserted: companyNewCount,
          total_quarters: financialData.quarters.length,
        }

        console.log(`[Cron] ${company.symbol}: upserted ${companyNewCount} quarters`)
      } catch (err: any) {
        const msg = `${company.symbol}: ${err.message}`
        console.error(`[Cron] Error fetching company: ${msg}`)
        errors.push(msg)
        details[company.symbol] = { status: 'error', error: err.message }
      }
    }

    const elapsed = Date.now() - startTime

    if (logId) {
      await logCronJobEnd(
        logId,
        errors.length > 0 ? 'error' : 'success',
        companiesChecked,
        newReportsFound,
        errors.length > 0 ? errors.join('; ') : undefined,
        details
      )
    }

    console.log(`[Cron] Completed in ${elapsed}ms. Checked: ${companiesChecked}, New/Updated: ${newReportsFound}, Errors: ${errors.length}`)

    return NextResponse.json({
      success: true,
      elapsed_ms: elapsed,
      companies_checked: companiesChecked,
      reports_upserted: newReportsFound,
      errors: errors.length > 0 ? errors : undefined,
      details,
    })
  } catch (error: any) {
    console.error('[Cron] Fatal error:', error)

    if (logId) {
      try {
        await logCronJobEnd(logId, 'error', 0, 0, error.message)
      } catch {
        // ignore log failure
      }
    }

    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    )
  }
}
