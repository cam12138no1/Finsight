import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'
import { fetchCategoryFinancials, fetchCompanyFinancials } from '@/lib/financial-api'
import { CompanyCategory } from '@/lib/companies'

export const dynamic = 'force-dynamic'

/**
 * GET /api/financials?category=AI_APPLICATION
 * or GET /api/financials?symbol=MSFT
 *
 * Fetches financial data from the data team's API
 * Returns quarterly metrics for companies
 */
export async function GET(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Financials API')
    if (!sessionResult.valid) {
      return NextResponse.json(
        { error: sessionResult.error },
        { status: sessionResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as CompanyCategory | null
    const symbol = searchParams.get('symbol')

    if (symbol) {
      const data = await fetchCompanyFinancials(symbol)
      return NextResponse.json({ company: data })
    }

    if (category) {
      const data = await fetchCategoryFinancials(category)
      return NextResponse.json({ companies: data })
    }

    return NextResponse.json({ error: 'Please provide category or symbol parameter' }, { status: 400 })
  } catch (error: any) {
    console.error('[Financials API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
