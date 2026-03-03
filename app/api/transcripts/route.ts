import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/transcripts?symbol=GOOGL&year=2025&quarter=4
 *
 * Returns earnings call transcript for a specific company quarter.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Transcripts API')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }

    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const year = searchParams.get('year')
    const quarter = searchParams.get('quarter')

    if (!symbol) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ transcript: null, source: 'none' })
    }

    const { getTranscript, getTranscriptsBySymbol } = await import('@/lib/db/financial-queries')

    if (year && quarter) {
      const transcript = await getTranscript(symbol, parseInt(year), parseInt(quarter))
      return NextResponse.json({ transcript, source: 'database' })
    }

    const transcripts = await getTranscriptsBySymbol(symbol)
    return NextResponse.json({
      transcripts: transcripts.map(t => ({
        fiscal_year: t.fiscal_year,
        fiscal_quarter: t.fiscal_quarter,
        transcript_date: t.transcript_date,
        content_length: t.content_length,
        word_count: t.word_count,
        speakers: t.speakers,
        has_content: !!t.content,
      })),
      source: 'database',
    })
  } catch (error: any) {
    console.error('[Transcripts API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
