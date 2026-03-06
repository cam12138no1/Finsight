import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'

export const dynamic = 'force-dynamic'

const PRICE_API_BASE = 'http://3.12.197.98:8006/api/v1/companies'
const DB_CACHE_TTL_MINUTES = 30

/**
 * GET /api/stock-prices?symbols=NVDA,AAPL,MSFT&days=14
 *
 * Dual-layer cache: Postgres DB (persistent) + in-memory (fast).
 * Fallback: external price API.
 * Returns { prices: { [symbol]: StockPriceData } }
 */
export async function GET(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Stock Prices API')
    if (!sessionResult.valid) {
      return NextResponse.json(
        { error: sessionResult.error },
        { status: sessionResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const symbolsParam = searchParams.get('symbols')
    const days = searchParams.get('days') || '14'

    if (!symbolsParam) {
      return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 })
    }

    const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean)
    if (symbols.length === 0 || symbols.length > 30) {
      return NextResponse.json({ error: 'Provide 1-30 symbols' }, { status: 400 })
    }

    const results: Record<string, any> = {}
    let missingSymbols = [...symbols]

    // Layer 1: Try Postgres cache
    if (process.env.DATABASE_URL) {
      try {
        const {
          ensureStockPricesCacheTable,
          getCachedStockPrices,
          upsertStockPriceCache,
        } = await import('@/lib/db/financial-queries')

        await ensureStockPricesCacheTable()
        const cached = await getCachedStockPrices(symbols, DB_CACHE_TTL_MINUTES)

        for (const symbol of symbols) {
          if (cached[symbol]) {
            results[symbol] = {
              ticker: symbol,
              currency: cached[symbol].currency,
              current_price: cached[symbol].current_price,
              price_change_percent: cached[symbol].price_change_percent,
              high: cached[symbol].high_14d,
              low: cached[symbol].low_14d,
              prices: cached[symbol].prices,
              last_updated: cached[symbol].last_updated,
            }
          }
        }

        missingSymbols = symbols.filter(s => !results[s])

        // Layer 2: Fetch missing symbols from external API
        if (missingSymbols.length > 0) {
          const fetches = missingSymbols.map(async (symbol) => {
            try {
              const controller = new AbortController()
              const timeout = setTimeout(() => controller.abort(), 8000)

              const res = await fetch(
                `${PRICE_API_BASE}/${encodeURIComponent(symbol)}/prices?days=${days}`,
                { headers: { accept: 'application/json' }, signal: controller.signal }
              )
              clearTimeout(timeout)

              if (res.ok) {
                const data = await res.json()
                results[symbol] = data

                // Persist to DB cache
                try {
                  await upsertStockPriceCache({
                    symbol,
                    currency: data.currency || 'USD',
                    current_price: data.current_price || '',
                    price_change_percent: data.price_change_percent || '',
                    high: data.high || '',
                    low: data.low || '',
                    prices: data.prices || [],
                    last_updated: data.last_updated || new Date().toISOString(),
                  })
                } catch (dbErr) {
                  console.error(`[Stock Prices] DB write failed for ${symbol}:`, dbErr)
                }
              }
            } catch {
              // Skip failed fetches
            }
          })
          await Promise.allSettled(fetches)
        }
      } catch (dbError) {
        console.error('[Stock Prices] DB cache error, falling back to direct API:', dbError)
        // Fall through to direct API fetch below
        missingSymbols = symbols.filter(s => !results[s])
      }
    }

    // Fallback: Direct API fetch if no DB or DB failed
    if (missingSymbols.length > 0) {
      const fetches = missingSymbols.map(async (symbol) => {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 8000)

          const res = await fetch(
            `${PRICE_API_BASE}/${encodeURIComponent(symbol)}/prices?days=${days}`,
            { headers: { accept: 'application/json' }, signal: controller.signal }
          )
          clearTimeout(timeout)

          if (res.ok) {
            const data = await res.json()
            results[symbol] = data
          }
        } catch {
          // Skip failed fetches
        }
      })
      await Promise.allSettled(fetches)
    }

    return NextResponse.json({ prices: results })
  } catch (error: any) {
    console.error('[Stock Prices API] Error:', error)
    return NextResponse.json({ prices: {}, error: error.message }, { status: 500 })
  }
}
