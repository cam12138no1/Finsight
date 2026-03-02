'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, FileText, Building2, Cpu, ShoppingBag, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  AI_APPLICATION_COMPANIES,
  AI_SUPPLY_CHAIN_COMPANIES,
  CONSUMER_GOODS_COMPANIES,
  type CompanyCategory,
  type Company,
} from '@/lib/companies'
import { buildCompanyDataFromAnalyses, type CompanyFinancialData, type QuarterData, type QuarterlyMetrics } from '@/lib/financial-api'

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

// Render a metric delta value with color and arrow
function MetricDelta({ value }: { value: string | undefined }) {
  if (!value) return null
  const isPositive = value.startsWith('+')
  const isNegative = value.startsWith('-')
  return (
    <span className={`text-xs font-medium flex items-center justify-end gap-0.5 ${
      isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-slate-500'
    }`}>
      {isPositive && <TrendingUp className="h-3 w-3" />}
      {isNegative && <TrendingDown className="h-3 w-3" />}
      {value}
    </span>
  )
}

export default function DashboardClient() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [dbFinancials, setDbFinancials] = useState<FetchedFinancial[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeCategory: CompanyCategory =
    (searchParams.get('category') as CompanyCategory) || 'AI_APPLICATION'

  const loadDashboardData = useCallback(async () => {
    try {
      // Fetch both user analyses and DB-stored financials in parallel
      const [dashboardRes, companyDataRes] = await Promise.allSettled([
        fetch('/api/dashboard'),
        fetch(`/api/company-data?category=${activeCategory}`),
      ])

      if (dashboardRes.status === 'fulfilled') {
        const data = await dashboardRes.value.json()
        if (data.analyses) {
          setAnalyses(data.analyses)
        }
      }

      if (companyDataRes.status === 'fulfilled') {
        const data = await companyDataRes.value.json()
        if (data.financials) {
          setDbFinancials(data.financials)
        }
      }

      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      setIsLoading(false)
    }
  }, [activeCategory])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Build financial data from both DB records and user analyses, keyed by symbol
  const companyDataMap = useMemo(() => {
    const map = new Map<string, CompanyFinancialData>()

    // 1. First add DB-fetched data (from cron job)
    for (const f of dbFinancials) {
      const sym = f.symbol.toUpperCase()
      if (!map.has(sym)) {
        map.set(sym, {
          symbol: f.symbol,
          name: f.company_name,
          nameZh: f.company_name,
          category: f.category as CompanyCategory,
          quarters: [],
          lastUpdated: '',
        })
      }
      const company = map.get(sym)!
      const exists = company.quarters.some(
        q => q.fiscalYear === f.fiscal_year && q.fiscalQuarter === f.fiscal_quarter
      )
      if (!exists) {
        company.quarters.push({
          fiscalYear: f.fiscal_year,
          fiscalQuarter: f.fiscal_quarter,
          period: f.period,
          metrics: {
            revenue: f.revenue || '',
            revenueYoY: f.revenue_yoy || '',
            netIncome: f.net_income || '',
            netIncomeYoY: f.net_income_yoy || '',
            eps: f.eps || '',
            epsYoY: f.eps_yoy || '',
            operatingMargin: f.operating_margin || '',
            grossMargin: f.gross_margin || '',
          },
          reportAvailable: true,
        })
      }
    }

    // 2. Then merge user-uploaded analysis data (overrides DB data for same quarter)
    const completedAnalyses = analyses.filter(a => a.processed && !a.error)
    const userCompanyData = buildCompanyDataFromAnalyses(completedAnalyses)
    for (const cd of userCompanyData) {
      const sym = cd.symbol.toUpperCase()
      if (!map.has(sym)) {
        map.set(sym, cd)
      } else {
        const existing = map.get(sym)!
        for (const q of cd.quarters) {
          const idx = existing.quarters.findIndex(
            eq => eq.fiscalYear === q.fiscalYear && eq.fiscalQuarter === q.fiscalQuarter
          )
          if (idx >= 0) {
            existing.quarters[idx] = q
          } else {
            existing.quarters.push(q)
          }
        }
      }
    }

    // Sort quarters newest first within each company
    for (const company of map.values()) {
      company.quarters.sort((a, b) => {
        if (b.fiscalYear !== a.fiscalYear) return b.fiscalYear - a.fiscalYear
        return b.fiscalQuarter - a.fiscalQuarter
      })
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  // Check if any company has data
  const hasAnyData = companies.some(c => {
    const d = companyDataMap.get(c.symbol.toUpperCase())
    return d && d.quarters.length > 0
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <CategoryIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{categoryInfo.name}</h1>
              <p className="text-xs text-slate-500">
                {companies.length} 家公司 · 最近季度核心指标
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-4">
        {/* Each company = one horizontal block */}
        {companies.map((company) => {
          const data = companyDataMap.get(company.symbol.toUpperCase())
          const quarters = data?.quarters.slice(0, 3) || [] // Latest 3 quarters, newest first

          return (
            <div
              key={company.symbol}
              onClick={() => handleCompanyClick(company.symbol)}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
            >
              {/* Top: Company name (left) */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs flex-shrink-0">
                    {company.symbol.slice(0, 4)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {company.name}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <span className="text-xs text-slate-400">{company.symbol}</span>
                  </div>
                </div>
                {quarters.length === 0 && (
                  <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                    暂无数据 · 点击进入详情页上传
                  </span>
                )}
              </div>

              {/* Below: 3 quarter rows, newest → oldest, each with 3 core metrics */}
              {quarters.length > 0 && (
                <div className="space-y-1.5">
                  {/* Column headers */}
                  <div className="grid grid-cols-4 gap-4 px-3 pb-1">
                    <div className="text-xs font-medium text-slate-400">季度</div>
                    <div className="text-xs font-medium text-slate-400 text-right">Net Income</div>
                    <div className="text-xs font-medium text-slate-400 text-right">Revenue</div>
                    <div className="text-xs font-medium text-slate-400 text-right">EPS</div>
                  </div>

                  {quarters.map((q, idx) => (
                    <div
                      key={`${q.fiscalYear}-Q${q.fiscalQuarter}`}
                      className={`grid grid-cols-4 gap-4 px-3 py-2.5 rounded-xl ${
                        idx === 0 ? 'bg-blue-50/60' : 'bg-slate-50/60'
                      }`}
                    >
                      {/* Quarter label */}
                      <div className="flex items-center">
                        <span className={`text-sm font-semibold ${idx === 0 ? 'text-blue-700' : 'text-slate-600'}`}>
                          {q.period}
                        </span>
                      </div>

                      {/* Net Income */}
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-800">
                          {q.metrics.netIncome || '-'}
                        </div>
                        <MetricDelta value={q.metrics.netIncomeYoY} />
                      </div>

                      {/* Revenue */}
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-800">
                          {q.metrics.revenue || '-'}
                        </div>
                        <MetricDelta value={q.metrics.revenueYoY} />
                      </div>

                      {/* EPS */}
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-800">
                          {q.metrics.eps || '-'}
                        </div>
                        <MetricDelta value={q.metrics.epsYoY} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Empty state when NO company in this category has data */}
        {!hasAnyData && (
          <div className="mt-4 text-center py-12 bg-white rounded-2xl border border-slate-200">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">暂无财报数据</h3>
            <p className="text-sm text-slate-500">
              点击任意公司名称进入详情页，上传财报进行分析
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
