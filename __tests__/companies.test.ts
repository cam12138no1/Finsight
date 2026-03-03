import { describe, it, expect } from 'vitest'
import {
  getAllCompanies,
  getCompanyBySymbol,
  getCompanyCategoryBySymbol,
  getCompaniesByCategory,
  AI_APPLICATION_COMPANIES,
  AI_SUPPLY_CHAIN_COMPANIES,
  CONSUMER_GOODS_COMPANIES,
  CATEGORY_CONFIG,
} from '@/lib/companies'

describe('Company definitions', () => {
  it('has exactly 29 companies total', () => {
    expect(getAllCompanies()).toHaveLength(29)
  })

  it('has 10 AI application companies', () => {
    expect(AI_APPLICATION_COMPANIES).toHaveLength(10)
  })

  it('has 14 AI supply chain companies', () => {
    expect(AI_SUPPLY_CHAIN_COMPANIES).toHaveLength(14)
  })

  it('has 5 consumer goods companies', () => {
    expect(CONSUMER_GOODS_COMPANIES).toHaveLength(5)
  })

  it('all companies have symbol, name, nameZh', () => {
    for (const c of getAllCompanies()) {
      expect(c.symbol).toBeTruthy()
      expect(c.name).toBeTruthy()
      expect(c.nameZh).toBeTruthy()
    }
  })

  it('no duplicate symbols', () => {
    const symbols = getAllCompanies().map(c => c.symbol.toUpperCase())
    expect(new Set(symbols).size).toBe(symbols.length)
  })
})

describe('getCompanyBySymbol', () => {
  it('finds MSFT', () => {
    const c = getCompanyBySymbol('MSFT')
    expect(c).toBeDefined()
    expect(c?.name).toBe('Microsoft')
  })

  it('finds case-insensitive', () => {
    expect(getCompanyBySymbol('msft')).toBeDefined()
    expect(getCompanyBySymbol('Msft')).toBeDefined()
  })

  it('finds companies with dots in symbol', () => {
    expect(getCompanyBySymbol('RMS.PA')).toBeDefined()
    expect(getCompanyBySymbol('600519.SS')).toBeDefined()
    expect(getCompanyBySymbol('MC.PA')).toBeDefined()
  })

  it('returns undefined for unknown symbol', () => {
    expect(getCompanyBySymbol('UNKNOWN')).toBeUndefined()
    expect(getCompanyBySymbol('')).toBeUndefined()
  })
})

describe('getCompanyCategoryBySymbol', () => {
  it('identifies AI application companies', () => {
    expect(getCompanyCategoryBySymbol('MSFT')).toBe('AI_APPLICATION')
    expect(getCompanyCategoryBySymbol('META')).toBe('AI_APPLICATION')
    expect(getCompanyCategoryBySymbol('ADBE')).toBe('AI_APPLICATION')
  })

  it('identifies AI supply chain companies', () => {
    expect(getCompanyCategoryBySymbol('NVDA')).toBe('AI_SUPPLY_CHAIN')
    expect(getCompanyCategoryBySymbol('TSM')).toBe('AI_SUPPLY_CHAIN')
    expect(getCompanyCategoryBySymbol('ASML')).toBe('AI_SUPPLY_CHAIN')
  })

  it('identifies consumer goods companies', () => {
    expect(getCompanyCategoryBySymbol('RMS.PA')).toBe('CONSUMER_GOODS')
    expect(getCompanyCategoryBySymbol('600519.SS')).toBe('CONSUMER_GOODS')
    expect(getCompanyCategoryBySymbol('CROX')).toBe('CONSUMER_GOODS')
    expect(getCompanyCategoryBySymbol('MC.PA')).toBe('CONSUMER_GOODS')
  })

  it('returns null for unknown symbol', () => {
    expect(getCompanyCategoryBySymbol('UNKNOWN')).toBeNull()
  })
})

describe('getCompaniesByCategory', () => {
  it('returns correct companies for each category', () => {
    expect(getCompaniesByCategory('AI_APPLICATION')).toHaveLength(10)
    expect(getCompaniesByCategory('AI_SUPPLY_CHAIN')).toHaveLength(14)
    expect(getCompaniesByCategory('CONSUMER_GOODS')).toHaveLength(5)
  })
})

describe('CATEGORY_CONFIG', () => {
  it('has config for all 3 categories', () => {
    expect(CATEGORY_CONFIG.AI_APPLICATION).toBeDefined()
    expect(CATEGORY_CONFIG.AI_SUPPLY_CHAIN).toBeDefined()
    expect(CATEGORY_CONFIG.CONSUMER_GOODS).toBeDefined()
  })

  it('each category has name, nameEn, companies, icon', () => {
    for (const cat of Object.values(CATEGORY_CONFIG)) {
      expect(cat.name).toBeTruthy()
      expect(cat.nameEn).toBeTruthy()
      expect(cat.companies.length).toBeGreaterThan(0)
      expect(cat.icon).toBeTruthy()
    }
  })
})
