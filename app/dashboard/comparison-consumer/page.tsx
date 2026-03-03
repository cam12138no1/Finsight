'use client'

import { useState, useEffect } from 'react'
import { Loader2, ShoppingBag, RefreshCw, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface CompanyMetrics {
  symbol: string
  company_name: string
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

// Product category mapping for consumer goods companies (excluding 茅台 - different industry)
const PRODUCT_CATEGORIES: Record<string, string[]> = {
  '皮具 & 配饰': ['RMS.PA', 'MC.PA', 'RL'],
  '成衣 & 服饰': ['RMS.PA', 'MC.PA', 'RL', 'CROX'],
  '综合奢侈品': ['RMS.PA', 'MC.PA', 'RL'],
}

const COMPANY_NAMES: Record<string, string> = {
  'RMS.PA': 'Hermès',
  'MC.PA': 'LVMH',
  'RL': 'Ralph Lauren',
  'CROX': 'Crocs',
  '600519.SS': '贵州茅台',
}

export default function ConsumerComparisonPage() {
  const [allData, setAllData] = useState<CompanyMetrics[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('综合奢侈品')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/company-data?category=CONSUMER_GOODS')
      const data = await res.json()
      if (data.financials) {
        setAllData(data.financials)
        if (data.financials.length > 0) {
          const periods = [...new Set(data.financials.map((f: any) => f.period))].sort().reverse()
          if (periods.length > 0 && !selectedPeriod) setSelectedPeriod(periods[0] as string)
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const allPeriods = [...new Set(allData.map(d => d.period))].sort().reverse()
  const categoryCompanies = PRODUCT_CATEGORIES[selectedCategory] || []

  const comparisonData = categoryCompanies.map(symbol => {
    const record = allData.find(d => d.symbol === symbol && d.period === selectedPeriod)
    return {
      symbol,
      name: COMPANY_NAMES[symbol] || symbol,
      data: record,
    }
  })

  const formatDelta = (val: string | null | undefined) => {
    if (!val) return <span className="text-slate-400">-</span>
    const isPos = val.startsWith('+')
    const isNeg = val.startsWith('-')
    return (
      <span className={`font-mono text-sm ${isPos ? 'text-green-600' : isNeg ? 'text-red-500' : 'text-slate-600'}`}>
        {val}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
            <ShoppingBag className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">消费品竞品对比</h1>
            <p className="text-gray-500 text-sm mt-1">按品类对比同类消费品公司核心财务数据</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" /> 刷新
        </Button>
      </div>

      {/* Category + Period selectors */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">品类</label>
          <div className="flex gap-2">
            {Object.keys(PRODUCT_CATEGORIES).map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">季度</label>
          <div className="flex gap-1.5 flex-wrap">
            {allPeriods.slice(0, 8).map(period => (
              <Button
                key={period}
                size="sm"
                variant={selectedPeriod === period ? 'default' : 'outline'}
                onClick={() => setSelectedPeriod(period)}
                className="text-xs"
              >
                {period}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      {comparisonData.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无对比数据</h3>
            <p className="text-gray-500">等待数据API同步消费品公司的财报数据</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-gradient-to-r from-purple-800 to-pink-800 text-white">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">公司</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">YoY</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Net Income</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">YoY</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">EPS</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Gross Margin</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Op. Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {comparisonData.map((company, idx) => (
                  <tr key={company.symbol} className={`hover:bg-purple-50/50 ${idx % 2 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900 text-sm">{company.name}</div>
                      <div className="text-xs text-gray-400">{company.symbol}</div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-gray-800">
                      {company.data?.revenue || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-4 text-right">{formatDelta(company.data?.revenue_yoy)}</td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-gray-800">
                      {company.data?.net_income || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-4 text-right">{formatDelta(company.data?.net_income_yoy)}</td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-gray-800">
                      {company.data?.eps || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-gray-800">
                      {company.data?.gross_margin || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-gray-800">
                      {company.data?.operating_margin || <span className="text-slate-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Note */}
      <div className="text-xs text-slate-400 text-center">
        注：茅台为白酒行业，与其他四家奢侈品/服饰公司不属于同品类，不参与品类竞品对比。
        <br />所有数据来自财报客观提取，不含任何主观评价。
      </div>
    </div>
  )
}
