import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/research-results?symbol=PLTR&year=2025&quarter=4
 * Returns research comparison results from Postgres.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Research Results')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ results: [] })
    }

    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const year = searchParams.get('year')
    const quarter = searchParams.get('quarter')

    const { getResearchReport, getResearchReportsByUser } = await import('@/lib/db/financial-queries')

    if (symbol && year && quarter) {
      const report = await getResearchReport(sessionResult.session.userId, symbol, parseInt(year), parseInt(quarter))
      return NextResponse.json({ report })
    }

    const reports = await getResearchReportsByUser(sessionResult.session.userId)
    return NextResponse.json({ reports })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
