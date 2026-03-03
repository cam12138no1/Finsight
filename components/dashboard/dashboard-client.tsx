'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, FileText, Building2, Cpu, ShoppingBag, ChevronRight, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
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

function MetricDelta({ value, label }: { value: string | undefined; label?: string }) {
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
      {label && <span className="text-slate-400 ml-0.5">{label}</span>}
    </span>
  )
}

/**
 * Generate a 3-sentence objective summary from the latest quarter data.
 * Strictly factual — no subjective language.
 */
function generateObjectiveSummary(q: QuarterData, companyName: string): string {
  const parts: string[] = []

  if (q.metrics.revenue) {
    let revSentence = `${companyName} ${q.period} 营收 ${q.metrics.revenue}`
    if (q.metrics.revenueYoY) revSentence += `，同比变化 ${q.metrics.revenueYoY}`
    parts.push(revSentence + '。')
  }

  if (q.metrics.netIncome) {
    let niSentence = `净利润 ${q.metrics.netIncome}`
    if (q.metrics.netIncomeYoY) niSentence += `，同比 ${q.metrics.netIncomeYoY}`
    if (q.metrics.operatingMargin) niSentence += `；营业利润率 ${q.metrics.operatingMargin}`
    parts.push(niSentence + '。')
  }

  if (q.metrics.eps) {
    let epsSentence = `每股收益 ${q.metrics.eps}`
    if (q.metrics.epsYoY) epsSentence += `（同比 ${q.metrics.epsYoY}）`
    if (q.metrics.grossMargin) epsSentence += `，毛利率 ${q.metrics.grossMargin}`
    parts.push(epsSentence + '。')
  }

  return parts.slice(0, 3).join('')
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

  useEffect(() => { loadDashboardData() }, [loadDashboardData])

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  const hasAnyData = companies.some(c => {
    const d = companyDataMap.get(c.symbol.toUpperCase())
    return d && d.quarters.length > 0
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <CategoryIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{categoryInfo.name}</h1>
              <p className="text-xs text-slate-500">{companies.length} 家公司 · 最近季度核心指标</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-5">
        {companies.map((company) => {
          const data = companyDataMap.get(company.symbol.toUpperCase())
          const quarters = data?.quarters.slice(0, 4) || []
          const latestQ = quarters[0]
          const summary = latestQ ? generateObjectiveSummary(latestQ, company.name) : ''

          return (
            <div
              key={company.symbol}
              onClick={() => handleCompanyClick(company.symbol)}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group"
            >
              {/* Header row: Company name + summary */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs flex-shrink-0">
                    {company.symbol.slice(0, 4)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                        {company.name}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">{company.nameZh !== company.name ? company.nameZh : ''}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <span className="text-xs text-slate-400">{company.symbol}</span>
                  </div>
                </div>
                {quarters.length === 0 && (
                  <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                    暂无数据 · 等待数据API同步
                  </span>
                )}
              </div>

              {/* 3-sentence objective conclusion */}
              {summary && (
                <div className="mb-4 px-4 py-3 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 rounded-xl border border-blue-100/60">
                  <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
                </div>
              )}

              {/* Metrics table */}
              {quarters.length > 0 && (
                <div className="space-y-1">
                  {/* Column headers */}
                  <div className="grid grid-cols-4 gap-4 px-3 pb-1.5">
                    <div className="text-xs font-medium text-slate-400">季度</div>
                    <div className="text-xs font-medium text-slate-400 text-right">Revenue（营收）</div>
                    <div className="text-xs font-medium text-slate-400 text-right">Net Income（净利润）</div>
                    <div className="text-xs font-medium text-slate-400 text-right">EPS（每股收益）</div>
                  </div>

                  {quarters.map((q, idx) => (
                    <div
                      key={`${q.fiscalYear}-Q${q.fiscalQuarter}`}
                      className={`grid grid-cols-4 gap-4 px-3 py-2.5 rounded-xl ${
                        idx === 0 ? 'bg-blue-50/60' : 'bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className={`text-sm font-semibold ${idx === 0 ? 'text-blue-700' : 'text-slate-600'}`}>
                          {q.period}
                        </span>
                      </div>

                      {/* Revenue */}
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-800">{q.metrics.revenue || '-'}</div>
                        <MetricDelta value={q.metrics.revenueYoY} label="YoY" />
                      </div>

                      {/* Net Income */}
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-800">{q.metrics.netIncome || '-'}</div>
                        <MetricDelta value={q.metrics.netIncomeYoY} label="YoY" />
                      </div>

                      {/* EPS */}
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-800">{q.metrics.eps || '-'}</div>
                        <MetricDelta value={q.metrics.epsYoY} label="YoY" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {!hasAnyData && (
          <div className="mt-4 text-center py-12 bg-white rounded-2xl border border-slate-200">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">暂无财报数据</h3>
            <p className="text-sm text-slate-500">数据将由系统每日自动从数据API获取</p>
          </div>
        )}
      </main>
    </div>
  )
}
