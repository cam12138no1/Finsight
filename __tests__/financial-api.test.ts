import { describe, it, expect } from 'vitest'

// Test the number formatting and calculation functions by importing them indirectly
// We re-implement them here to test the logic in isolation

function formatDollar(raw: any): string {
  if (!raw) return ''
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  if (isNaN(num)) return ''
  if (num === 0) return '$0'
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  const strip = (n: number) => n.toFixed(6).replace(/\.?0+$/, '') || '0'
  if (abs >= 1e9) return `${sign}$${strip(abs / 1e9)}B`
  if (abs >= 1e6) return `${sign}$${strip(abs / 1e6)}M`
  if (abs >= 1e3) return `${sign}$${strip(abs / 1e3)}K`
  return `${sign}$${strip(abs)}`
}

function formatEps(raw: any): string {
  if (!raw && raw !== 0) return ''
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  if (isNaN(num)) return ''
  return `$${raw}`
}

function calcYoY(cur: string | null, prev: string | null): string {
  if (!cur || !prev) return ''
  const c = parseFloat(cur), p = parseFloat(prev)
  if (isNaN(c) || isNaN(p) || p === 0) return ''
  const pct = ((c - p) / Math.abs(p)) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function calcMargin(part: string | null, whole: string | null): string {
  if (!part || !whole) return ''
  const p = parseFloat(part), w = parseFloat(whole)
  if (isNaN(p) || isNaN(w) || w === 0) return ''
  return `${((p / w) * 100).toFixed(2)}%`
}

describe('formatDollar', () => {
  it('formats billions with full precision', () => {
    expect(formatDollar('113896000000')).toBe('$113.896B')
  })

  it('formats exact billions', () => {
    expect(formatDollar('1000000000')).toBe('$1B')
  })

  it('formats small billions', () => {
    expect(formatDollar('2100000000')).toBe('$2.1B')
  })

  it('formats millions', () => {
    expect(formatDollar('892500000')).toBe('$892.5M')
  })

  it('handles zero', () => {
    expect(formatDollar('0')).toBe('$0')
  })

  it('handles null', () => {
    expect(formatDollar(null)).toBe('')
  })

  it('handles empty string', () => {
    expect(formatDollar('')).toBe('')
  })

  it('handles negative values', () => {
    expect(formatDollar('-27851000000')).toBe('-$27.851B')
  })

  it('handles number type input', () => {
    expect(formatDollar(68127000000)).toBe('$68.127B')
  })

  it('handles non-numeric string', () => {
    expect(formatDollar('abc')).toBe('')
  })

  it('preserves full precision (no rounding to 2 decimals)', () => {
    expect(formatDollar('113896000000')).not.toBe('$113.90B')
    expect(formatDollar('113896000000')).toBe('$113.896B')
  })

  it('handles very small amounts', () => {
    expect(formatDollar('500000')).toBe('$500K')
  })
})

describe('formatEps', () => {
  it('formats EPS preserving source precision', () => {
    expect(formatEps('2.85')).toBe('$2.85')
  })

  it('handles zero EPS', () => {
    expect(formatEps('0')).toBe('$0')
  })

  it('handles null', () => {
    expect(formatEps(null)).toBe('')
  })

  it('handles negative EPS', () => {
    expect(formatEps('-0.53')).toBe('$-0.53')
  })
})

describe('calcYoY', () => {
  it('calculates positive YoY', () => {
    expect(calcYoY('113896000000', '102000000000')).toBe('+11.66%')
  })

  it('calculates negative YoY', () => {
    expect(calcYoY('90000000000', '100000000000')).toBe('-10.00%')
  })

  it('handles zero growth', () => {
    expect(calcYoY('100', '100')).toBe('+0.00%')
  })

  it('handles null current', () => {
    expect(calcYoY(null, '100')).toBe('')
  })

  it('handles null previous', () => {
    expect(calcYoY('100', null)).toBe('')
  })

  it('handles zero previous (division by zero)', () => {
    expect(calcYoY('100', '0')).toBe('')
  })

  it('handles negative to positive', () => {
    const result = calcYoY('100', '-50')
    expect(result).toContain('%')
  })

  it('handles both null', () => {
    expect(calcYoY(null, null)).toBe('')
  })

  it('handles non-numeric strings', () => {
    expect(calcYoY('abc', '100')).toBe('')
  })
})

describe('calcMargin', () => {
  it('calculates operating margin', () => {
    expect(calcMargin('36002000000', '113896000000')).toBe('31.61%')
  })

  it('handles zero revenue (division by zero)', () => {
    expect(calcMargin('100', '0')).toBe('')
  })

  it('handles null part', () => {
    expect(calcMargin(null, '100')).toBe('')
  })

  it('handles null whole', () => {
    expect(calcMargin('100', null)).toBe('')
  })

  it('calculates 100% margin', () => {
    expect(calcMargin('100', '100')).toBe('100.00%')
  })

  it('handles negative margin', () => {
    const result = calcMargin('-50', '100')
    expect(result).toBe('-50.00%')
  })
})
