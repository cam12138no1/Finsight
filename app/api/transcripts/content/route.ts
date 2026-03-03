import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/transcripts/content?symbol=GOOGL&year=2025&quarter=4
 *
 * Returns full transcript content for modal display.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Transcript Content API')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }

    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const year = searchParams.get('year')
    const quarter = searchParams.get('quarter')

    if (!symbol || !year || !quarter) {
      return NextResponse.json({ error: 'symbol, year, quarter required' }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ content: null })
    }

    const { getTranscript } = await import('@/lib/db/financial-queries')
    const transcript = await getTranscript(symbol, parseInt(year), parseInt(quarter))

    return NextResponse.json({
      content: transcript?.content || null,
      transcript_date: transcript?.transcript_date,
      speakers: transcript?.speakers,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
