'use client'

import { useState, useEffect } from 'react'
import { 
  Loader2, 
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Filter,
  Building2,
  Cpu,
  ShoppingBag,
  AlertCircle,
  FileSpreadsheet,
  AlertTriangle,
  Eye,
  DollarSign,
  BarChart3,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ComparisonData {
  id: string
  company_name: string
  company_symbol: string
  fiscal_year: number
  fiscal_quarter?: number
  created_at: string
  category?: string
  
  core_revenue: string
  core_profit: string
  guidance: string
  core_driver_quantified: string
  main_risk_quantified: string
  
  one_line_conclusion: string
  
  demand_metrics: string
  demand_change: string
  demand_magnitude: string
  monetization_metrics: string
  monetization_change: string
  monetization_magnitude: string
  efficiency_metrics: string
  efficiency_change: string
  efficiency_magnitude: string
  
  capex_change: string
  investment_direction: string
  roi_evidence: string[]
  
  main_risks: string[]
  checkpoints: string[]
}

export default function ComparisonPage() {
  const [companyData, setCompanyData] = useState<ComparisonData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadComparisonData()
  }, [])

  const loadComparisonData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/dashboard')
      if (!response.ok) throw new Error('加载数据失败')
      
      const data = await response.json()
      
      const processedData: ComparisonData[] = (data.analyses || [])
        .filter((a: any) => a.processed && !a.error)
        .map((analysis: any) => {
          const snapshot = analysis.comparison_snapshot || {}
          
          let coreRevenue = snapshot.core_revenue || '-'
          if (coreRevenue === '-' && analysis.results_table?.length > 0) {
            const revRow = analysis.results_table.find((r: any) => 
              r.metric?.toLowerCase().includes('revenue') || r.metric?.includes('收入')
            )
            if (revRow) coreRevenue = `${revRow.actual} (${revRow.delta})`
          }
          
          let coreProfit = snapshot.core_profit || '-'
          if (coreProfit === '-' && analysis.results_table?.length > 0) {
            const profitRow = analysis.results_table.find((r: any) => 
              r.metric?.toLowerCase().includes('income') || 
              r.metric?.toLowerCase().includes('profit') ||
              r.metric?.includes('利润')
            )
            if (profitRow) coreProfit = `${profitRow.actual} (${profitRow.delta})`
          }
          
          let guidance = snapshot.guidance || '-'
          if (guidance === '-' && analysis.results_explanation) {
            const guidanceMatch = analysis.results_explanation.match(/指引[：:]\s*([^。]+)/i)
            if (guidanceMatch) guidance = guidanceMatch[1]
          }
          
          let coreDriverQuantified = snapshot.core_driver_quantified || '-'
          if (coreDriverQuantified === '-' && analysis.drivers) {
            const drivers = []
            if (analysis.drivers.demand?.magnitude) drivers.push(`需求${analysis.drivers.demand.magnitude}`)
            if (analysis.drivers.monetization?.magnitude) drivers.push(`变现${analysis.drivers.monetization.magnitude}`)
            coreDriverQuantified = drivers.join(' + ') || '-'
          }
          
          let mainRiskQuantified = snapshot.main_risk_quantified || '-'
          if (mainRiskQuantified === '-' && analysis.sustainability_risks?.main_risks?.length > 0) {
            mainRiskQuantified = analysis.sustainability_risks.main_risks[0]
          }
          
          return {
            id: analysis.id,
            company_name: analysis.company_name || '未知公司',
            company_symbol: analysis.company_symbol || '-',
            fiscal_year: analysis.fiscal_year || new Date().getFullYear(),
            fiscal_quarter: analysis.fiscal_quarter,
            created_at: analysis.created_at,
            category: analysis.metadata?.company_category || analysis.category,
            
            core_revenue: coreRevenue,
            core_profit: coreProfit,
            guidance,
            core_driver_quantified: coreDriverQuantified,
            main_risk_quantified: mainRiskQuantified,
            
            one_line_conclusion: analysis.one_line_conclusion || '-',
            
            demand_metrics: analysis.drivers?.demand?.metrics || '-',
            demand_change: analysis.drivers?.demand?.change || '-',
            demand_magnitude: analysis.drivers?.demand?.magnitude || '-',
            monetization_metrics: analysis.drivers?.monetization?.metrics || '-',
            monetization_change: analysis.drivers?.monetization?.change || '-',
            monetization_magnitude: analysis.drivers?.monetization?.magnitude || '-',
            efficiency_metrics: analysis.drivers?.efficiency?.metrics || '-',
            efficiency_change: analysis.drivers?.efficiency?.change || '-',
            efficiency_magnitude: analysis.drivers?.efficiency?.magnitude || '-',
            
            capex_change: analysis.investment_roi?.capex_change || '-',
            investment_direction: analysis.investment_roi?.investment_direction || '-',
            roi_evidence: analysis.investment_roi?.roi_evidence || [],
            
            main_risks: analysis.sustainability_risks?.main_risks || [],
            checkpoints: analysis.sustainability_risks?.checkpoints || [],
          }
        })
      
      setCompanyData(processedData)
    } catch (err: any) {
      console.error('加载对比数据失败:', err)
      setError(err.message || '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) newExpanded.delete(id)
    else newExpanded.add(id)
    setExpandedRows(newExpanded)
  }

  const filteredData = companyData
    .filter(d => !categoryFilter || d.category?.includes(categoryFilter))
    .sort((a, b) => {
      let aVal: any = a[sortField as keyof ComparisonData]
      let bVal: any = b[sortField as keyof ComparisonData]
      if (sortField === 'created_at') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }
      return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })

  const exportToCSV = () => {
    const headers = [
      '公司', '代码', '类型', '报告期', '分析日期',
      '核心收入', '核心利润', '指引',
      '核心驱动', '主要风险', '一句话结论',
      '需求指标', '需求变化', '需求幅度',
      '变现指标', '变现变化', '变现幅度',
      '效率指标', '效率变化', '效率幅度',
      'CapEx变化', '投入方向', 'ROI证据',
      '主要风险列表', '检查点',
    ]
    
    const rows = filteredData.map(d => [
      d.company_name, d.company_symbol, d.category || '-',
      d.fiscal_quarter ? `Q${d.fiscal_quarter} ${d.fiscal_year}` : `FY ${d.fiscal_year}`,
      new Date(d.created_at).toLocaleDateString('zh-CN'),
      d.core_revenue, d.core_profit, d.guidance,
      d.core_driver_quantified, d.main_risk_quantified, d.one_line_conclusion,
      d.demand_metrics, d.demand_change, d.demand_magnitude,
      d.monetization_metrics, d.monetization_change, d.monetization_magnitude,
      d.efficiency_metrics, d.efficiency_change, d.efficiency_magnitude,
      d.capex_change, d.investment_direction, d.roi_evidence.join('；'),
      d.main_risks.join('；'), d.checkpoints.join('；'),
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `财报横向对比_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500">加载横向对比数据...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button onClick={loadComparisonData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-soft-md">
            <FileSpreadsheet className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">财报横向对比</h1>
            <p className="text-gray-500 text-sm mt-1">
              汇总所有分析报告的核心财务数据，客观对比
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadComparisonData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={exportToCSV} className="bg-gradient-to-r from-green-600 to-emerald-600">
            <Download className="h-4 w-4 mr-2" />
            导出CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{filteredData.length}</div>
            <div className="text-xs text-gray-500 mt-1">总分析数</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {new Set(filteredData.map(d => d.company_symbol)).size}
            </div>
            <div className="text-xs text-gray-500 mt-1">公司数</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {new Set(filteredData.map(d => `${d.fiscal_year}Q${d.fiscal_quarter}`)).size}
            </div>
            <div className="text-xs text-gray-500 mt-1">季度数</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">筛选：</span>
        <Button variant={categoryFilter === null ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter(null)}>
          全部
        </Button>
        <Button variant={categoryFilter === 'AI应用' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter('AI应用')}>
          <Building2 className="h-3.5 w-3.5 mr-1" />
          AI应用
        </Button>
        <Button variant={categoryFilter === 'AI供应链' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter('AI供应链')}>
          <Cpu className="h-3.5 w-3.5 mr-1" />
          AI供应链
        </Button>
        <Button variant={categoryFilter === '消费品' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter('消费品')}>
          <ShoppingBag className="h-3.5 w-3.5 mr-1" />
          消费品
        </Button>
      </div>

      {/* Table */}
      {filteredData.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <FileSpreadsheet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无分析数据</h3>
            <p className="text-gray-500">上传财报并完成分析后，数据将自动汇总到此表格</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-soft-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider sticky left-0 bg-slate-800 z-10">公司</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">报告期</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    <div className="flex items-center gap-1"><DollarSign className="h-3 w-3" />核心收入</div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    <div className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />核心利润</div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">指引</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    <div className="flex items-center gap-1"><Zap className="h-3 w-3" />核心驱动</div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    <div className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />主要风险</div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    <div className="flex items-center gap-1"><Eye className="h-3 w-3" />下季关注</div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider">详情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredData.map((company, idx) => (
                  <>
                    <tr key={company.id} className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-4 sticky left-0 bg-inherit z-10">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow">
                            {company.company_symbol?.slice(0, 2) || '??'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">{company.company_name}</div>
                            <div className="text-xs text-gray-500">{company.company_symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {company.fiscal_quarter ? `Q${company.fiscal_quarter}` : 'FY'} {company.fiscal_year}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-sm font-semibold text-gray-900">{company.core_revenue}</div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-sm font-semibold text-gray-900">{company.core_profit}</div>
                      </td>
                      <td className="px-3 py-4 max-w-[150px]">
                        <div className="text-sm text-gray-700 truncate" title={company.guidance}>{company.guidance}</div>
                      </td>
                      <td className="px-3 py-4 max-w-[180px]">
                        <div className="text-sm text-[#4B5563] truncate" title={company.core_driver_quantified}>
                          {company.core_driver_quantified}
                        </div>
                      </td>
                      <td className="px-3 py-4 max-w-[180px]">
                        <div className="text-sm text-[#4B5563] truncate" title={company.main_risk_quantified}>
                          {company.main_risk_quantified}
                        </div>
                      </td>
                      <td className="px-3 py-4 max-w-[150px]">
                        <div className="text-sm text-[#4B5563] truncate">
                          {company.checkpoints[0] || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <Button variant="ghost" size="sm" onClick={() => toggleRowExpand(company.id)} className="hover:bg-blue-100">
                          {expandedRows.has(company.id) ? (
                            <ChevronUp className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </td>
                    </tr>
                    
                    {expandedRows.has(company.id) && (
                      <tr key={`${company.id}-detail`} className="bg-[#F9F9F6]">
                        <td colSpan={9} className="px-6 py-5">
                          <div className="mb-5 p-4 bg-emerald-50/50 rounded-lg border border-blue-200">
                            <div className="text-xs font-semibold text-emerald-700 mb-2 uppercase tracking-wider">核心数据摘要</div>
                            <div className="text-sm text-blue-900 leading-relaxed font-medium">
                              {company.one_line_conclusion}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                <Zap className="h-4 w-4 text-emerald-600" />
                                增长驱动数据
                              </h4>
                              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                <div className="text-xs font-medium text-green-700 mb-1">需求/量：{company.demand_magnitude}</div>
                                <div className="text-xs text-green-800">{company.demand_change}</div>
                              </div>
                              <div className="p-3 bg-emerald-50/50 rounded-lg border border-blue-100">
                                <div className="text-xs font-medium text-emerald-700 mb-1">变现/价：{company.monetization_magnitude}</div>
                                <div className="text-xs text-blue-800">{company.monetization_change}</div>
                              </div>
                              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                                <div className="text-xs font-medium text-purple-700 mb-1">效率：{company.efficiency_magnitude}</div>
                                <div className="text-xs text-purple-800">{company.efficiency_change}</div>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-emerald-600" />
                                投入与ROI
                              </h4>
                              <div className="p-3 bg-emerald-50/50 rounded-lg border border-blue-100">
                                <div className="text-xs font-medium text-emerald-700 mb-1">CapEx变化</div>
                                <div className="text-sm text-blue-900 font-medium">{company.capex_change}</div>
                              </div>
                              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                <div className="text-xs font-medium text-indigo-700 mb-1">投入方向</div>
                                <div className="text-sm text-indigo-900">{company.investment_direction}</div>
                              </div>
                              {company.roi_evidence.length > 0 && (
                                <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
                                  <div className="text-xs font-medium text-teal-700 mb-1">ROI数据</div>
                                  <ul className="space-y-1">
                                    {company.roi_evidence.slice(0, 3).map((e, i) => (
                                      <li key={i} className="text-xs text-teal-900 flex items-start gap-1.5">
                                        <span className="w-1 h-1 bg-teal-500 rounded-full mt-1.5 flex-shrink-0" />{e}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            
                            <div className="space-y-3">
                              <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                风险与检查点
                              </h4>
                              {company.main_risks.length > 0 && (
                                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                  <div className="text-xs font-medium text-red-700 mb-1">主要风险</div>
                                  <ul className="space-y-1">
                                    {company.main_risks.slice(0, 3).map((r, i) => (
                                      <li key={i} className="text-xs text-red-900 flex items-start gap-1.5">
                                        <span className="w-1 h-1 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />{r}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {company.checkpoints.length > 0 && (
                                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                                  <div className="text-xs font-medium text-orange-700 mb-1">下季检查点</div>
                                  <ul className="space-y-1">
                                    {company.checkpoints.slice(0, 3).map((c, i) => (
                                      <li key={i} className="text-xs text-orange-900 flex items-start gap-1.5">
                                        <span className="w-1 h-1 bg-orange-500 rounded-full mt-1.5 flex-shrink-0" />{c}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
