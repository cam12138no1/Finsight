// lib/companies.ts - Company definitions and categories

export interface Company {
  symbol: string
  name: string
  nameZh: string
}

export type CompanyCategory = 'AI_APPLICATION' | 'AI_SUPPLY_CHAIN' | 'CONSUMER_GOODS'

export const AI_APPLICATION_COMPANIES: Company[] = [
  { symbol: 'MSFT', name: 'Microsoft', nameZh: '微软' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', nameZh: '谷歌' },
  { symbol: 'AMZN', name: 'Amazon', nameZh: '亚马逊' },
  { symbol: 'META', name: 'Meta Platforms', nameZh: 'Meta' },
  { symbol: 'CRM', name: 'Salesforce', nameZh: 'Salesforce' },
  { symbol: 'NOW', name: 'ServiceNow', nameZh: 'ServiceNow' },
  { symbol: 'PLTR', name: 'Palantir', nameZh: 'Palantir' },
  { symbol: 'AAPL', name: 'Apple', nameZh: '苹果' },
  { symbol: 'APP', name: 'AppLovin', nameZh: 'AppLovin' },
  { symbol: 'ADBE', name: 'Adobe', nameZh: 'Adobe' },
]

export const AI_SUPPLY_CHAIN_COMPANIES: Company[] = [
  { symbol: 'NVDA', name: 'NVIDIA', nameZh: '英伟达' },
  { symbol: 'AMD', name: 'AMD', nameZh: 'AMD' },
  { symbol: 'AVGO', name: 'Broadcom', nameZh: '博通' },
  { symbol: 'TSM', name: 'TSMC', nameZh: '台积电' },
  { symbol: 'SKM', name: 'SK Hynix', nameZh: 'SK海力士' },
  { symbol: 'MU', name: 'Micron', nameZh: '美光' },
  { symbol: 'SSNLF', name: 'Samsung', nameZh: '三星' },
  { symbol: 'INTC', name: 'Intel', nameZh: '英特尔' },
  { symbol: 'VRT', name: 'Vertiv', nameZh: 'Vertiv' },
  { symbol: 'ETN', name: 'Eaton', nameZh: 'Eaton' },
  { symbol: 'GEV', name: 'GE Vernova', nameZh: 'GE Vernova' },
  { symbol: 'VST', name: 'Vistra', nameZh: 'Vistra' },
  { symbol: 'ASML', name: 'ASML', nameZh: 'ASML' },
  { symbol: 'SNPS', name: 'Synopsys', nameZh: 'Synopsys' },
]

export const CONSUMER_GOODS_COMPANIES: Company[] = [
  { symbol: 'RMS.PA', name: 'Hermès', nameZh: '爱马仕' },
  { symbol: '600519.SS', name: 'Kweichow Moutai', nameZh: '贵州茅台' },
  { symbol: 'CROX', name: 'Crocs', nameZh: 'Crocs' },
  { symbol: 'RL', name: 'Ralph Lauren', nameZh: 'Ralph Lauren' },
  { symbol: 'MC.PA', name: 'LVMH', nameZh: '路威酩轩' },
]

export const CATEGORY_CONFIG: Record<CompanyCategory, {
  name: string
  nameEn: string
  companies: Company[]
  icon: string
}> = {
  AI_APPLICATION: {
    name: 'AI应用公司',
    nameEn: 'AI Application',
    companies: AI_APPLICATION_COMPANIES,
    icon: 'building',
  },
  AI_SUPPLY_CHAIN: {
    name: 'AI供应链公司',
    nameEn: 'AI Supply Chain',
    companies: AI_SUPPLY_CHAIN_COMPANIES,
    icon: 'cpu',
  },
  CONSUMER_GOODS: {
    name: '消费品公司',
    nameEn: 'Consumer Goods',
    companies: CONSUMER_GOODS_COMPANIES,
    icon: 'shopping-bag',
  },
}

export function getAllCompanies(): Company[] {
  return [
    ...AI_APPLICATION_COMPANIES,
    ...AI_SUPPLY_CHAIN_COMPANIES,
    ...CONSUMER_GOODS_COMPANIES,
  ]
}

export function getCompanyCategoryBySymbol(symbol: string): CompanyCategory | null {
  const upper = symbol.toUpperCase()
  if (AI_APPLICATION_COMPANIES.some(c => c.symbol.toUpperCase() === upper)) return 'AI_APPLICATION'
  if (AI_SUPPLY_CHAIN_COMPANIES.some(c => c.symbol.toUpperCase() === upper)) return 'AI_SUPPLY_CHAIN'
  if (CONSUMER_GOODS_COMPANIES.some(c => c.symbol.toUpperCase() === upper)) return 'CONSUMER_GOODS'
  return null
}

export function getCompanyBySymbol(symbol: string): Company | undefined {
  return getAllCompanies().find(c => c.symbol.toUpperCase() === symbol.toUpperCase())
}

export function getCompaniesByCategory(category: CompanyCategory): Company[] {
  return CATEGORY_CONFIG[category].companies
}
