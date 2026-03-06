'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, FileText, Building2, Cpu, ShoppingBag, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  AI_APPLICATION_COMPANIES,
  AI_SUPPLY_CHAIN_COMPANIES,
  CONSUMER_GOODS_COMPANIES,
  SEMI_ANNUAL_SYMBOLS,
  type CompanyCategory,
  type Company,
} from '@/lib/companies'
import { buildCompanyDataFromAnalyses, type CompanyFinancialData, type QuarterData } from '@/lib/financial-api'
import { StockPriceChart, StockPriceChartSkeleton, type StockPriceData } from './stock-price-chart'

interface Analysis {
  id: string
  company_name: string
  company_symbol: string
  period: string
  category: string
  fiscal_year?: number
  fiscal_quarter?: number
  processed: boolean
  processing?: boolean
  error?: string
  created_at: string
  one_line_conclusion?: string
  results_table?: Array<{
    metric: string
    actual: string
    consensus: string
    delta: string
    assessment: string
  }>
  comparison_snapshot?: {
    core_revenue?: string
    core_profit?: string
  }
}

interface FetchedFinancial {
  symbol: string
  company_name: string
  category: string
  fiscal_year: number
  fiscal_quarter: number
  period: string
  revenue: string | null
  revenue_yoy: string | null
  net_income: string | null
  net_income_yoy: string | null
  eps: string | null
  eps_yoy: string | null
  operating_margin: string | null
  gross_margin: string | null
}

const CATEGORY_LABELS: Record<CompanyCategory, { name: string; icon: typeof Building2 }> = {
  AI_APPLICATION: { name: 'AI应用公司', icon: Building2 },
  AI_SUPPLY_CHAIN: { name: 'AI供应链公司', icon: Cpu },
  CONSUMER_GOODS: { name: '消费品公司', icon: ShoppingBag },
}

function getCompaniesForCategory(category: CompanyCategory): Company[] {
  switch (category) {
    case 'AI_APPLICATION': return AI_APPLICATION_COMPANIES
    case 'AI_SUPPLY_CHAIN': return AI_SUPPLY_CHAIN_COMPANIES
    case 'CONSUMER_GOODS': return CONSUMER_GOODS_COMPANIES
  }
}

function formatPeriodLabel(period: string, symbol: string): string {
  if (!SEMI_ANNUAL_SYMBOLS.has(symbol)) return period
  const match = period.match(/(\d{4}) Q(\d)/)
  if (!match) return period
  const year = match[1]
  const q = parseInt(match[2])
  if (q === 2) return `${year} H1`
  if (q === 4) return `${year} H2`
  return period
}

function MetricDelta({ value, label }: { value: string | undefined; label?: string }) {
  if (!value) return null
  const isPositive = value.startsWith('+')
  const isNegative = value.startsWith('-')
  return (
    <span className={`text-[11px] font-medium flex items-center justify-end gap-0.5 ${
      isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-[#9CA3AF]'
    }`}>
      {isPositive && <TrendingUp className="h-3 w-3" />}
      {isNegative && <TrendingDown className="h-3 w-3" />}
      {value}
      {label && <span className="text-[#9CA3AF] ml-0.5">{label}</span>}
    </span>
  )
}

function generateObjectiveSummary(q: QuarterData, companyName: string): string {
  const parts: string[] = []
  if (q.metrics.revenue) {
    let s = `${companyName} ${q.period} 营收 ${q.metrics.revenue}`
    if (q.metrics.revenueYoY) s += `，同比变化 ${q.metrics.revenueYoY}`
    parts.push(s + '。')
  }
  if (q.metrics.netIncome) {
    let s = `净利润 ${q.metrics.netIncome}`
    if (q.metrics.netIncomeYoY) s += `，同比 ${q.metrics.netIncomeYoY}`
    if (q.metrics.operatingMargin) s += `；营业利润率 ${q.metrics.operatingMargin}`
    parts.push(s + '。')
  }
  if (q.metrics.eps) {
    let s = `每股收益 ${q.metrics.eps}`
    if (q.metrics.epsYoY) s += `（同比 ${q.metrics.epsYoY}）`
    if (q.metrics.grossMargin) s += `，毛利率 ${q.metrics.grossMargin}`
    parts.push(s + '。')
  }
  return parts.slice(0, 3).join('')
}

export default function DashboardClient() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [dbFinancials, setDbFinancials] = useState<FetchedFinancial[]>([])
  const [stockPrices, setStockPrices] = useState<Record<string, StockPriceData>>({})
  const [stockPricesLoading, setStockPricesLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeCategory: CompanyCategory =
    (searchParams.get('category') as CompanyCategory) || 'AI_APPLICATION'

  const loadDashboardData = useCallback(async () => {
    try {
      const [dashboardRes, companyDataRes] = await Promise.allSettled([
        fetch('/api/dashboard'),
        fetch(`/api/company-data?category=${activeCategory}`),
      ])
      if (dashboardRes.status === 'fulfilled') {
        const data = await dashboardRes.value.json()
        if (data.analyses) setAnalyses(data.analyses)
      }
      if (companyDataRes.status === 'fulfilled') {
        const data = await companyDataRes.value.json()
        if (data.financials) setDbFinancials(data.financials)
      }
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      setIsLoading(false)
    }
  }, [activeCategory])

  // Fetch stock prices for current category companies
  const loadStockPrices = useCallback(async () => {
    setStockPricesLoading(true)
    try {
      const companies = getCompaniesForCategory(activeCategory)
      const symbols = companies.map(c => c.symbol).join(',')
      const res = await fetch(`/api/stock-prices?symbols=${symbols}&days=14`)
      if (res.ok) {
        const data = await res.json()
        if (data.prices) setStockPrices(data.prices)
      }
    } catch (error) {
      console.error('Failed to load stock prices:', error)
    } finally {
      setStockPricesLoading(false)
    }
  }, [activeCategory])

  useEffect(() => { loadDashboardData() }, [loadDashboardData])
  useEffect(() => { loadStockPrices() }, [loadStockPrices])

  const companyDataMap = useMemo(() => {
    const map = new Map<string, CompanyFinancialData>()
    for (const f of dbFinancials) {
      const sym = f.symbol.toUpperCase()
      if (!map.has(sym)) {
        map.set(sym, {
          symbol: f.symbol, name: f.company_name, nameZh: f.company_name,
          category: f.category as CompanyCategory, quarters: [], lastUpdated: '',
        })
      }
      const company = map.get(sym)!
      if (!company.quarters.some(q => q.fiscalYear === f.fiscal_year && q.fiscalQuarter === f.fiscal_quarter)) {
        company.quarters.push({
          fiscalYear: f.fiscal_year, fiscalQuarter: f.fiscal_quarter, period: f.period,
          metrics: {
            revenue: f.revenue || '', revenueYoY: f.revenue_yoy || '',
            netIncome: f.net_income || '', netIncomeYoY: f.net_income_yoy || '',
            eps: f.eps || '', epsYoY: f.eps_yoy || '',
            operatingMargin: f.operating_margin || '', grossMargin: f.gross_margin || '',
          },
          reportAvailable: true,
        })
      }
    }
    const completedAnalyses = analyses.filter(a => a.processed && !a.error)
    const userCompanyData = buildCompanyDataFromAnalyses(completedAnalyses)
    for (const cd of userCompanyData) {
      const sym = cd.symbol.toUpperCase()
      if (!map.has(sym)) { map.set(sym, cd) }
      else {
        const existing = map.get(sym)!
        for (const q of cd.quarters) {
          const idx = existing.quarters.findIndex(eq => eq.fiscalYear === q.fiscalYear && eq.fiscalQuarter === q.fiscalQuarter)
          if (idx >= 0) existing.quarters[idx] = q
          else existing.quarters.push(q)
        }
      }
    }
    for (const company of map.values()) {
      company.quarters.sort((a, b) => b.fiscalYear !== a.fiscalYear ? b.fiscalYear - a.fiscalYear : b.fiscalQuarter - a.fiscalQuarter)
    }
    return map
  }, [analyses, dbFinancials])

  const companies = getCompaniesForCategory(activeCategory)
  const categoryInfo = CATEGORY_LABELS[activeCategory]
  const CategoryIcon = categoryInfo.icon

  const handleCompanyClick = (symbol: string) => {
    router.push(`/dashboard/company/${encodeURIComponent(symbol)}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  const hasAnyData = companies.some(c => {
    const d = companyDataMap.get(c.symbol.toUpperCase())
    return d && d.quarters.length > 0
  })

  return (
    <div className="min-h-full">
      {/* Category header */}
      <div className="sticky top-0 z-30 bg-[#FAFAF8]/90 backdrop-blur-sm border-b border-[#E8E8E3]">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#F0F0EB] flex items-center justify-center">
              <CategoryIcon className="h-4 w-4 text-[#4B5563]" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-[#1F2937]">{categoryInfo.name}</h1>
              <p className="text-[11px] text-[#9CA3AF]">{companies.length} 家公司 · 最近季度核心指标</p>
            </div>
          </div>
        </div>
      </div>

      {/* Company cards */}
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-5 space-y-3">
        {companies.map((company) => {
          const data = companyDataMap.get(company.symbol.toUpperCase())
          const quarters = data?.quarters.slice(0, 4) || []
          const latestQ = quarters[0]
          const summary = latestQ ? generateObjectiveSummary(latestQ, company.name) : ''

          return (
            <div
              key={company.symbol}
              onClick={() => handleCompanyClick(company.symbol)}
              className="bg-white rounded-xl border border-[#E8E8E3] p-4 lg:p-5
                         hover:border-emerald-300 hover:shadow-soft-md
                         transition-all duration-200 cursor-pointer group"
            >
              {/* Header with stock price chart */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-[#F5F5F0] flex items-center justify-center font-semibold text-[#6B7280] text-[11px] flex-shrink-0">
                    {company.symbol.slice(0, 4)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-[#1F2937] text-sm group-hover:text-emerald-700 transition-colors duration-200">
                        {company.name}
                      </span>
                      {company.nameZh !== company.name && (
                        <span className="text-xs text-[#9CA3AF] hidden sm:inline">{company.nameZh}</span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-[#D1D5DB] group-hover:text-emerald-500 transition-colors duration-200" />
                    </div>
                    <span className="text-[11px] text-[#9CA3AF]">{company.symbol}</span>
                  </div>
                </div>
                <div className="hidden sm:block flex-shrink-0">
                  {stockPrices[company.symbol]?.prices?.length ? (
                    <StockPriceChart data={stockPrices[company.symbol]} />
                  ) : stockPricesLoading ? (
                    <StockPriceChartSkeleton />
                  ) : quarters.length === 0 ? (
                    <span className="text-[11px] text-[#9CA3AF] bg-[#F5F5F0] px-2.5 py-1 rounded-full">
                      暂无数据
                    </span>
                  ) : null}
                </div>
              </div>
              {/* Mobile stock price */}
              <div className="sm:hidden mb-2">
                {stockPrices[company.symbol]?.prices?.length ? (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] text-[#9CA3AF]">14日股价</span>
                    <StockPriceChart data={stockPrices[company.symbol]} />
                  </div>
                ) : stockPricesLoading ? (
                  <StockPriceChartSkeleton />
                ) : null}
              </div>

              {/* Summary */}
              {summary && (
                <div className="mb-3 px-3 py-2.5 bg-[#F9F9F6] rounded-lg border border-[#E8E8E3]/60">
                  <p className="text-[13px] text-[#4B5563] leading-relaxed">{summary}</p>
                </div>
              )}

              {/* Metrics table - desktop */}
              {quarters.length > 0 && (
                <div className="hidden sm:block space-y-0.5">
                  <div className="grid grid-cols-4 gap-3 px-2.5 pb-1">
                    <div className="text-[11px] font-medium text-[#9CA3AF]">季度</div>
                    <div className="text-[11px] font-medium text-[#9CA3AF] text-right">Revenue</div>
                    <div className="text-[11px] font-medium text-[#9CA3AF] text-right">Net Income</div>
                    <div className="text-[11px] font-medium text-[#9CA3AF] text-right">EPS</div>
                  </div>
                  {quarters.map((q, idx) => (
                    <div
                      key={`${q.fiscalYear}-Q${q.fiscalQuarter}`}
                      className={`grid grid-cols-4 gap-3 px-2.5 py-2 rounded-lg ${
                        idx === 0 ? 'bg-emerald-50/50' : idx % 2 === 1 ? 'bg-[#FAFAF8]' : ''
                      }`}
                    >
                      <div>
                        <span className={`text-sm font-medium ${idx === 0 ? 'text-emerald-700' : 'text-[#4B5563]'}`}>
                          {formatPeriodLabel(q.period, company.symbol)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-[#1F2937]">{q.metrics.revenue || '-'}</div>
                        <MetricDelta value={q.metrics.revenueYoY} label="YoY" />
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-[#1F2937]">{q.metrics.netIncome || '-'}</div>
                        <MetricDelta value={q.metrics.netIncomeYoY} label="YoY" />
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-[#1F2937]">{q.metrics.eps || '-'}</div>
                        <MetricDelta value={q.metrics.epsYoY} label="YoY" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Metrics - mobile (stacked) */}
              {quarters.length > 0 && (
                <div className="sm:hidden space-y-2">
                  {quarters.slice(0, 2).map((q, idx) => (
                    <div key={`m-${q.fiscalYear}-Q${q.fiscalQuarter}`}
                      className={`px-3 py-2.5 rounded-lg ${idx === 0 ? 'bg-emerald-50/50' : 'bg-[#FAFAF8]'}`}>
                      <div className={`text-sm font-medium mb-1.5 ${idx === 0 ? 'text-emerald-700' : 'text-[#4B5563]'}`}>
                        {formatPeriodLabel(q.period, company.symbol)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[10px] text-[#9CA3AF] mb-0.5">Revenue</div>
                          <div className="text-xs font-medium text-[#1F2937]">{q.metrics.revenue || '-'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#9CA3AF] mb-0.5">Net Income</div>
                          <div className="text-xs font-medium text-[#1F2937]">{q.metrics.netIncome || '-'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#9CA3AF] mb-0.5">EPS</div>
                          <div className="text-xs font-medium text-[#1F2937]">{q.metrics.eps || '-'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {!hasAnyData && (
          <div className="text-center py-16 bg-white rounded-xl border border-[#E8E8E3]">
            <div className="h-14 w-14 rounded-xl bg-[#F5F5F0] flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <h3 className="text-base font-medium text-[#4B5563] mb-1">暂无财报数据</h3>
            <p className="text-sm text-[#9CA3AF]">数据将由系统每日自动从数据API获取</p>
          </div>
        )}
      </div>
    </div>
  )
}
