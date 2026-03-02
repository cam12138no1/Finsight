'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, FileText, Building2, Cpu, ShoppingBag, ChevronRight } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  AI_APPLICATION_COMPANIES,
  AI_SUPPLY_CHAIN_COMPANIES,
  CONSUMER_GOODS_COMPANIES,
  type CompanyCategory,
  type Company,
} from '@/lib/companies'
import { buildCompanyDataFromAnalyses, type CompanyFinancialData, type QuarterData } from '@/lib/financial-api'

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

export default function DashboardClient() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeCategory: CompanyCategory =
    (searchParams.get('category') as CompanyCategory) || 'AI_APPLICATION'

  const loadDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard')
      const data = await response.json()
      if (data.analyses) {
        setAnalyses(data.analyses)
      }
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Build financial data from analyses
  const companyDataMap = useMemo(() => {
    const completedAnalyses = analyses.filter(a => a.processed && !a.error)
    const allCompanyData = buildCompanyDataFromAnalyses(completedAnalyses)
    const map = new Map<string, CompanyFinancialData>()
    for (const cd of allCompanyData) {
      map.set(cd.symbol.toUpperCase(), cd)
    }
    return map
  }, [analyses])

  // Get companies for current category
  const companies = getCompaniesForCategory(activeCategory)
  const categoryInfo = CATEGORY_LABELS[activeCategory]
  const CategoryIcon = categoryInfo.icon

  // Get recent 4 quarters across all companies for the table header
  const allQuarters = useMemo(() => {
    const qSet = new Set<string>()
    for (const company of companies) {
      const data = companyDataMap.get(company.symbol.toUpperCase())
      if (data) {
        for (const q of data.quarters) {
          qSet.add(`${q.fiscalYear} Q${q.fiscalQuarter}`)
        }
      }
    }
    return Array.from(qSet)
      .map(s => {
        const [year, q] = s.split(' ')
        return { label: s, year: parseInt(year), quarter: parseInt(q.replace('Q', '')) }
      })
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year
        return b.quarter - a.quarter
      })
      .slice(0, 4) // Show up to 4 recent quarters
  }, [companies, companyDataMap])

  const handleCompanyClick = (symbol: string) => {
    router.push(`/dashboard/company/${encodeURIComponent(symbol)}`)
  }

  // Render metric value with color
  const renderMetricValue = (value: string | undefined) => {
    if (!value) return <span className="text-slate-300">-</span>
    const isNegative = value.startsWith('-')
    return (
      <span className={isNegative ? 'text-red-500' : 'text-slate-700'}>
        {value}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    )
  }

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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Company Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                    公司
                  </th>
                  {allQuarters.length > 0 ? (
                    allQuarters.map(q => (
                      <th key={q.label} className="px-4 py-4 text-center min-w-[280px]" colSpan={3}>
                        <span className="text-sm font-semibold text-slate-600">{q.label}</span>
                      </th>
                    ))
                  ) : (
                    <th className="px-4 py-4 text-center" colSpan={3}>
                      <span className="text-sm font-medium text-slate-400">暂无数据</span>
                    </th>
                  )}
                </tr>
                {allQuarters.length > 0 && (
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="sticky left-0 bg-slate-50/50 z-10"></th>
                    {allQuarters.map(q => (
                      <React.Fragment key={`sub-${q.label}`}>
                        <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">Net Income</th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">Revenue</th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">EPS</th>
                      </React.Fragment>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((company) => {
                  const data = companyDataMap.get(company.symbol.toUpperCase())
                  const hasData = !!data && data.quarters.length > 0

                  return (
                    <tr
                      key={company.symbol}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                      onClick={() => handleCompanyClick(company.symbol)}
                    >
                      {/* Company Name Cell */}
                      <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-blue-50/50 z-10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs flex-shrink-0">
                            {company.symbol.slice(0, 4)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                {company.name}
                              </span>
                              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                            </div>
                            <span className="text-xs text-slate-400">{company.symbol}</span>
                          </div>
                        </div>
                      </td>

                      {/* Quarterly Metrics Cells */}
                      {allQuarters.length > 0 ? (
                        allQuarters.map(q => {
                          const quarterData = data?.quarters.find(
                            qd => qd.fiscalYear === q.year && qd.fiscalQuarter === q.quarter
                          )
                          return (
                            <React.Fragment key={`${company.symbol}-${q.label}`}>
                              <td className="px-2 py-4 text-center text-sm">
                                {renderMetricValue(quarterData?.metrics.netIncome)}
                              </td>
                              <td className="px-2 py-4 text-center text-sm">
                                {renderMetricValue(quarterData?.metrics.revenue)}
                              </td>
                              <td className="px-2 py-4 text-center text-sm">
                                {renderMetricValue(quarterData?.metrics.eps)}
                              </td>
                            </React.Fragment>
                          )
                        })
                      ) : (
                        <>
                          <td className="px-2 py-4 text-center text-sm text-slate-300" colSpan={3}>
                            {hasData ? '-' : '暂无财报数据'}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty state hint */}
        {allQuarters.length === 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl text-sm">
              <FileText className="h-4 w-4" />
              <span>点击公司名称进入详情页上传财报进行分析</span>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// React is needed for React.Fragment
import React from 'react'
