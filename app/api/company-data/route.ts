import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'
import { CompanyCategory } from '@/lib/companies'

export const dynamic = 'force-dynamic'

/**
 * GET /api/company-data?category=AI_APPLICATION
 * or  GET /api/company-data?symbol=MSFT
 *
 * Returns financial data from Vercel Postgres (fetched by cron job).
 * Falls back gracefully when DATABASE_URL is not configured.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Company Data API')
    if (!sessionResult.valid) {
      return NextResponse.json(
        { error: sessionResult.error },
        { status: sessionResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as CompanyCategory | null
    const symbol = searchParams.get('symbol')

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ financials: [], source: 'none' })
    }

    const {
      getFetchedFinancialsByCategory,
      getFetchedFinancialsBySymbol,
      getAllFetchedFinancials,
    } = await import('@/lib/db/financial-queries')

    let financials
    if (symbol) {
      financials = await getFetchedFinancialsBySymbol(symbol)
    } else if (category) {
      financials = await getFetchedFinancialsByCategory(category)
    } else {
      financials = await getAllFetchedFinancials()
    }

    return NextResponse.json({
      financials,
      source: 'database',
      count: financials.length,
    })
  } catch (error: any) {
    console.error('[Company Data API] Error:', error)
    return NextResponse.json({ financials: [], source: 'error', error: error.message })
  }
}
