'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Eye, Loader2, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { exportAnalysisToExcel } from '@/lib/export-excel'

interface Analysis {
  id: string
  company_name: string
  company_symbol: string
  report_type: string
  fiscal_year: number
  fiscal_quarter?: number
  filing_date: string
  created_at: string
  processed: boolean
  processing?: boolean
  error?: string
  one_line_conclusion?: string
  results_summary?: string
  results_table?: any[]
  results_explanation?: string
  drivers_summary?: string
  drivers?: any
  investment_roi?: any
  sustainability_risks?: any
  model_impact?: any
  final_judgment?: any
  metadata?: any
}

export default function ReportsPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    loadAnalyses()
  }, [])

  const loadAnalyses = async () => {
    try {
      const response = await fetch('/api/dashboard?limit=50')
      const data = await response.json()
      setAnalyses(data.analyses || [])
    } catch (error) {
      console.error('加载分析失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadAnalyses()
    setIsRefreshing(false)
  }

  const handleExport = (analysis: Analysis) => {
    exportAnalysisToExcel(analysis as any, 'zh')
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (selectedAnalysis) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => setSelectedAnalysis(null)}>
              ← 返回列表
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {selectedAnalysis.company_name} ({selectedAnalysis.company_symbol})
              </h1>
              <p className="text-gray-600">
                {selectedAnalysis.report_type} • 
                {selectedAnalysis.fiscal_quarter ? `Q${selectedAnalysis.fiscal_quarter} ` : ''}
                {selectedAnalysis.fiscal_year}
                {selectedAnalysis.metadata?.company_category && (
                  <Badge variant="outline" className="ml-2">
                    {selectedAnalysis.metadata.company_category}
                  </Badge>
                )}
              </p>
            </div>
          </div>
          <Button onClick={() => handleExport(selectedAnalysis)}>
            <Download className="h-4 w-4 mr-2" />
            导出Excel
          </Button>
        </div>

        {/* 0) 一句话结论 */}
        {selectedAnalysis.one_line_conclusion && (
          <Card className="border-l-4 border-l-blue-600 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">📌 一句话结论</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">{selectedAnalysis.one_line_conclusion}</p>
            </CardContent>
          </Card>
        )}

        {/* 1) 结果层 - 业绩 vs 预期 */}
        {selectedAnalysis.results_table && selectedAnalysis.results_table.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>📊 业绩 vs 市场预期</CardTitle>
              {selectedAnalysis.results_summary && (
                <p className="text-sm text-gray-600 mt-1">{selectedAnalysis.results_summary}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold">指标</th>
                      <th className="text-right py-3 px-4 font-semibold">实际值</th>
                      <th className="text-right py-3 px-4 font-semibold">预期值</th>
                      <th className="text-right py-3 px-4 font-semibold">差异</th>
                      <th className="text-left py-3 px-4 font-semibold">评估</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAnalysis.results_table.map((row: any, index: number) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{row.metric}</td>
                        <td className="text-right py-3 px-4">{row.actual}</td>
                        <td className="text-right py-3 px-4 text-gray-500">{row.consensus}</td>
                        <td className="text-right py-3 px-4">
                          <span className={row.delta?.includes('+') ? 'text-green-600' : row.delta?.includes('-') ? 'text-red-600' : ''}>
                            {row.delta}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {row.assessment || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedAnalysis.results_explanation && (
                <p className="mt-4 text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  <strong>关键解释：</strong>{selectedAnalysis.results_explanation}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* 2) 驱动层 */}
        {selectedAnalysis.drivers && (
          <Card>
            <CardHeader>
              <CardTitle>🔍 增长驱动拆解</CardTitle>
              {selectedAnalysis.drivers_summary && (
                <p className="text-sm text-gray-600 mt-1">{selectedAnalysis.drivers_summary}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* A. 需求/量 */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">A</span>
                    <h4 className="font-semibold">{selectedAnalysis.drivers.demand?.title || '需求/量'}</h4>
                  </div>
                  <p className="text-sm mb-2"><strong>变化：</strong>{selectedAnalysis.drivers.demand?.change}</p>
                  <p className="text-sm mb-2"><strong>幅度：</strong>{selectedAnalysis.drivers.demand?.magnitude}</p>
                  <p className="text-sm text-gray-600"><strong>原因：</strong>{selectedAnalysis.drivers.demand?.reason}</p>
                </div>
                
                {/* B. 变现/单价 */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">B</span>
                    <h4 className="font-semibold">{selectedAnalysis.drivers.monetization?.title || '变现/单价'}</h4>
                  </div>
                  <p className="text-sm mb-2"><strong>变化：</strong>{selectedAnalysis.drivers.monetization?.change}</p>
                  <p className="text-sm mb-2"><strong>幅度：</strong>{selectedAnalysis.drivers.monetization?.magnitude}</p>
                  <p className="text-sm text-gray-600"><strong>原因：</strong>{selectedAnalysis.drivers.monetization?.reason}</p>
                </div>
                
                {/* C. 内部效率 */}
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">C</span>
                    <h4 className="font-semibold">{selectedAnalysis.drivers.efficiency?.title || '内部效率'}</h4>
                  </div>
                  <p className="text-sm mb-2"><strong>变化：</strong>{selectedAnalysis.drivers.efficiency?.change}</p>
                  <p className="text-sm mb-2"><strong>幅度：</strong>{selectedAnalysis.drivers.efficiency?.magnitude}</p>
                  <p className="text-sm text-gray-600"><strong>原因：</strong>{selectedAnalysis.drivers.efficiency?.reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3) 投入与ROI */}
        {selectedAnalysis.investment_roi && (
          <Card>
            <CardHeader>
              <CardTitle>💰 投入与ROI分析</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-500">资本支出变化</p>
                  <p className="font-medium">{selectedAnalysis.investment_roi.capex_change}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-500">运营支出变化</p>
                  <p className="font-medium">{selectedAnalysis.investment_roi.opex_change}</p>
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-500">投入方向</p>
                <p className="font-medium">{selectedAnalysis.investment_roi.investment_direction}</p>
              </div>
              {selectedAnalysis.investment_roi.roi_evidence && selectedAnalysis.investment_roi.roi_evidence.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">ROI证据</p>
                  <ul className="space-y-1">
                    {selectedAnalysis.investment_roi.roi_evidence.map((evidence: string, i: number) => (
                      <li key={i} className="flex items-start text-sm">
                        <span className="w-2 h-2 bg-green-500 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                        {evidence}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="p-3 bg-amber-50 rounded border border-amber-200">
                <p className="text-sm text-gray-500">管理层承诺</p>
                <p className="font-medium">{selectedAnalysis.investment_roi.management_commitment}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4) 可持续性与风险 */}
        {selectedAnalysis.sustainability_risks && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-700">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  可持续驱动
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {selectedAnalysis.sustainability_risks.sustainable_drivers?.map((d: string, i: number) => (
                    <li key={i} className="flex items-start">
                      <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                      <span className="text-sm">{d}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-red-700">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  主要风险
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {selectedAnalysis.sustainability_risks.main_risks?.map((r: string, i: number) => (
                    <li key={i} className="flex items-start">
                      <span className="w-2 h-2 bg-red-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                      <span className="text-sm">{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 检查点 */}
        {selectedAnalysis.sustainability_risks?.checkpoints && selectedAnalysis.sustainability_risks.checkpoints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>🎯 未来检查点</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {selectedAnalysis.sustainability_risks.checkpoints.map((cp: string, i: number) => (
                  <li key={i} className="flex items-start">
                    <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-sm">{cp}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 5) 模型影响 */}
        {selectedAnalysis.model_impact && (
          <Card>
            <CardHeader>
              <CardTitle>📈 模型影响与估值</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-500">收入假设调整</p>
                  <p className="font-medium">{selectedAnalysis.model_impact.revenue_adjustment}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-500">CapEx假设调整</p>
                  <p className="font-medium">{selectedAnalysis.model_impact.capex_adjustment}</p>
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded border border-blue-200 mb-4">
                <p className="text-sm text-gray-500">估值变化</p>
                <p className="font-semibold text-blue-700">{selectedAnalysis.model_impact.valuation_change}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-500">逻辑链</p>
                <p className="text-sm">{selectedAnalysis.model_impact.logic_chain}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 6) 投委会结论 */}
        {selectedAnalysis.final_judgment && (
          <Card className="border-l-4 border-l-purple-600">
            <CardHeader>
              <CardTitle>🏛️ 投委会结论</CardTitle>
            </CardHeader>
            <CardContent>
              {typeof selectedAnalysis.final_judgment === 'string' ? (
                <p className="text-lg leading-relaxed">{selectedAnalysis.final_judgment}</p>
              ) : (
                <div className="space-y-4">
                  {selectedAnalysis.final_judgment.confidence && (
                    <div className="p-3 bg-green-50 rounded">
                      <p className="text-sm font-medium text-green-700">✅ 更有信心的点</p>
                      <p className="text-gray-900 mt-1">{selectedAnalysis.final_judgment.confidence}</p>
                    </div>
                  )}
                  {selectedAnalysis.final_judgment.concerns && (
                    <div className="p-3 bg-red-50 rounded">
                      <p className="text-sm font-medium text-red-700">⚠️ 更担心的点</p>
                      <p className="text-gray-900 mt-1">{selectedAnalysis.final_judgment.concerns}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">财报分析</h1>
          <p className="text-gray-600">查看已分析的财报详情</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {analyses.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无财报分析</h3>
          <p className="text-gray-500">请先在仪表板上传财报进行分析</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {analyses.map((analysis) => (
            <Card 
              key={analysis.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                analysis.processing ? 'border-yellow-300 bg-yellow-50' : 
                analysis.error ? 'border-red-300 bg-red-50' : ''
              }`}
              onClick={() => analysis.processed && !analysis.error && setSelectedAnalysis(analysis)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {analysis.company_symbol?.slice(0, 2) || '??'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {analysis.company_name} ({analysis.company_symbol})
                      </h3>
                      <p className="text-sm text-gray-500">
                        {analysis.report_type} • 
                        {analysis.fiscal_quarter ? `Q${analysis.fiscal_quarter} ` : ''}
                        {analysis.fiscal_year} • 
                        {new Date(analysis.created_at).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {analysis.processing ? (
                      <Badge variant="outline" className="bg-yellow-100">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        分析中...
                      </Badge>
                    ) : analysis.error ? (
                      <Badge variant="destructive">
                        分析失败
                      </Badge>
                    ) : analysis.processed ? (
                      <Badge variant="default" className="bg-green-600">
                        已完成
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        待处理
                      </Badge>
                    )}
                    {analysis.processed && !analysis.error && (
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        查看
                      </Button>
                    )}
                  </div>
                </div>
                {analysis.one_line_conclusion && (
                  <p className="mt-3 text-sm text-gray-700 line-clamp-2 bg-gray-50 p-2 rounded">
                    {analysis.one_line_conclusion}
                  </p>
                )}
                {analysis.error && (
                  <p className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">
                    错误: {analysis.error}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
