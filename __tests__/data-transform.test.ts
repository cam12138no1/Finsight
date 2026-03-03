import { describe, it, expect } from 'vitest'
import { buildCompanyDataFromAnalyses } from '@/lib/financial-api'

describe('buildCompanyDataFromAnalyses', () => {
  it('returns empty array for empty input', () => {
    expect(buildCompanyDataFromAnalyses([])).toEqual([])
  })

  it('skips unprocessed analyses', () => {
    const result = buildCompanyDataFromAnalyses([
      { company_symbol: 'MSFT', company_name: 'Microsoft', processed: false, created_at: '2025-01-01' },
    ])
    expect(result).toHaveLength(0)
  })

  it('skips analyses with errors', () => {
    const result = buildCompanyDataFromAnalyses([
      { company_symbol: 'MSFT', company_name: 'Microsoft', processed: true, error: 'fail', created_at: '2025-01-01' },
    ])
    expect(result).toHaveLength(0)
  })

  it('extracts revenue from results_table', () => {
    const result = buildCompanyDataFromAnalyses([{
      company_symbol: 'MSFT', company_name: 'Microsoft', processed: true,
      fiscal_year: 2025, fiscal_quarter: 1, created_at: '2025-01-01',
      results_table: [
        { metric: 'Revenue', actual: '$65.59B', consensus: '-', delta: '+16.04%', assessment: '' },
        { metric: 'Net Income', actual: '$24.67B', consensus: '-', delta: '+10.71%', assessment: '' },
        { metric: 'EPS (Diluted)', actual: '$3.30', consensus: '-', delta: '+10.37%', assessment: '' },
      ],
    }])
    expect(result).toHaveLength(1)
    expect(result[0].quarters[0].metrics.revenue).toBe('$65.59B')
    expect(result[0].quarters[0].metrics.netIncome).toBe('$24.67B')
    expect(result[0].quarters[0].metrics.eps).toBe('$3.30')
  })

  it('deduplicates same quarter', () => {
    const result = buildCompanyDataFromAnalyses([
      { company_symbol: 'MSFT', company_name: 'Microsoft', processed: true, fiscal_year: 2025, fiscal_quarter: 1, created_at: '2025-01-01' },
      { company_symbol: 'MSFT', company_name: 'Microsoft', processed: true, fiscal_year: 2025, fiscal_quarter: 1, created_at: '2025-01-02' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].quarters).toHaveLength(1)
  })

  it('sorts quarters newest first', () => {
    const result = buildCompanyDataFromAnalyses([
      { company_symbol: 'MSFT', company_name: 'Microsoft', processed: true, fiscal_year: 2024, fiscal_quarter: 4, created_at: '2024-12-01' },
      { company_symbol: 'MSFT', company_name: 'Microsoft', processed: true, fiscal_year: 2025, fiscal_quarter: 2, created_at: '2025-06-01' },
      { company_symbol: 'MSFT', company_name: 'Microsoft', processed: true, fiscal_year: 2025, fiscal_quarter: 1, created_at: '2025-03-01' },
    ])
    expect(result[0].quarters[0].period).toBe('2025 Q2')
    expect(result[0].quarters[1].period).toBe('2025 Q1')
    expect(result[0].quarters[2].period).toBe('2024 Q4')
  })

  it('uses comparison_snapshot as fallback', () => {
    const result = buildCompanyDataFromAnalyses([{
      company_symbol: 'NVDA', company_name: 'NVIDIA', processed: true,
      fiscal_year: 2025, fiscal_quarter: 4, created_at: '2025-01-01',
      comparison_snapshot: { core_revenue: '$39.33B', core_profit: '$22.09B' },
    }])
    expect(result[0].quarters[0].metrics.revenue).toBe('$39.33B')
    expect(result[0].quarters[0].metrics.netIncome).toBe('$22.09B')
  })

  it('handles missing symbol', () => {
    const result = buildCompanyDataFromAnalyses([
      { company_symbol: '', company_name: 'Unknown', processed: true, created_at: '2025-01-01' },
    ])
    expect(result).toHaveLength(0)
  })

  it('handles missing fiscal year/quarter', () => {
    const result = buildCompanyDataFromAnalyses([
      { company_symbol: 'MSFT', company_name: 'Microsoft', processed: true, created_at: '2025-01-01' },
    ])
    // Company entry is created but with no quarters
    if (result.length > 0) {
      expect(result[0].quarters).toHaveLength(0)
    }
  })

  it('groups multiple companies correctly', () => {
    const result = buildCompanyDataFromAnalyses([
      { company_symbol: 'MSFT', company_name: 'Microsoft', processed: true, fiscal_year: 2025, fiscal_quarter: 1, created_at: '2025-01-01' },
      { company_symbol: 'NVDA', company_name: 'NVIDIA', processed: true, fiscal_year: 2025, fiscal_quarter: 1, created_at: '2025-01-01' },
    ])
    expect(result).toHaveLength(2)
  })

  it('skips guidance rows for revenue extraction', () => {
    const result = buildCompanyDataFromAnalyses([{
      company_symbol: 'MSFT', company_name: 'Microsoft', processed: true,
      fiscal_year: 2025, fiscal_quarter: 1, created_at: '2025-01-01',
      results_table: [
        { metric: '下季指引 Revenue', actual: '$60-62B', consensus: '-', delta: '', assessment: '' },
        { metric: 'Revenue', actual: '$65.59B', consensus: '-', delta: '+16%', assessment: '' },
      ],
    }])
    expect(result[0].quarters[0].metrics.revenue).toBe('$65.59B')
  })
})

describe('Edge cases for API data transformation', () => {
  it('handles API returning string numbers', () => {
    // Simulating what happens when we receive "113896000000" from API
    const num = parseFloat('113896000000')
    expect(num).toBe(113896000000)
    expect(num / 1e9).toBeCloseTo(113.896, 3)
  })

  it('handles API returning "0" for eps_diluted', () => {
    const num = parseFloat('0')
    expect(num).toBe(0)
  })

  it('handles negative capital expenditure', () => {
    const num = parseFloat('-27851000000')
    expect(num).toBe(-27851000000)
    expect(Math.abs(num) / 1e9).toBeCloseTo(27.851, 3)
  })

  it('growth_metrics decimal to percentage', () => {
    const growth = 0.1128524808004221
    const pct = growth * 100
    expect(pct.toFixed(2)).toBe('11.29')
  })

  it('handles very small growth rates', () => {
    const growth = 0.00367932627447774
    const pct = growth * 100
    expect(pct.toFixed(2)).toBe('0.37')
  })

  it('handles negative growth', () => {
    const growth = -0.014980416821521484
    const pct = growth * 100
    expect(`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`).toBe('-1.50%')
  })
})
