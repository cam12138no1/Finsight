'use client'

import { useState, useEffect } from 'react'
import { X, Download, AlertTriangle, CheckCircle, Target, BarChart3, DollarSign, Loader2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Analysis {
  id: string
  company_name: string
  company_symbol: string
  period: string
  category: string
  processed: boolean
  created_at: string
  one_line_conclusion?: string
  results_summary?: string
  results_table?: Array<{
    metric: string
    actual: string
    consensus: string
    delta: string
    assessment: string
    importance?: string
  }>
  results_explanation?: string
  drivers_summary?: string
  drivers?: {
    demand?: {
      title: string
      metrics: string
      change: string
      magnitude: string
      reason: string
    }
    monetization?: {
      title: string
      metrics: string
      change: string
      magnitude: string
      reason: string
    }
    efficiency?: {
      title: string
      metrics: string
      change: string
      magnitude: string
      reason: string
    }
  }
  investment_roi?: {
    capex_change: string
    opex_change: string
    investment_direction: string
    roi_evidence: string[]
    management_commitment: string
  }
  sustainability_risks?: {
    sustainable_drivers: string[]
    main_risks: string[]
    checkpoints: string[]
  }
  model_impact?: {
    upgrade_factors: string[]
    downgrade_factors: string[]
    logic_chain: string
  }
  comparison_snapshot?: {
    core_revenue?: string
    core_profit?: string
    guidance?: string
    core_driver_quantified?: string
    main_risk_quantified?: string
  }
  research_comparison?: {
    consensus_source?: string
    key_differences?: string[]
    analyst_blind_spots?: string
  }
}

interface AnalysisModalProps {
  analysis: Analysis
  onClose: () => void
}

export default function AnalysisModal({ analysis, onClose }: AnalysisModalProps) {
  const [fullAnalysis, setFullAnalysis] = useState<Analysis>(analysis)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  // 加载完整分析数据
  useEffect(() => {
    const loadFullAnalysis = async () => {
      try {
        const response = await fetch(`/api/reports/${analysis.id}`)
        const data = await response.json()
        if (data.analysis) {
          setFullAnalysis(data.analysis)
        }
      } catch (error) {
        console.error('Failed to load full analysis:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadFullAnalysis()
  }, [analysis.id])

  // 导出PDF - 使用html2canvas + jsPDF生成专业PDF
  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const [html2canvasModule, jspdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ])
      
      const html2canvas = html2canvasModule.default
      const { jsPDF } = jspdfModule
      
      // 创建临时容器用于渲染PDF内容
      const container = document.createElement('div')
      container.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 800px;
        background: white;
        padding: 40px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `
      
      container.innerHTML = buildPdfHtml(fullAnalysis)
      document.body.appendChild(container)
      
      // 等待内容渲染完成
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        windowWidth: 800,
      })
      
      document.body.removeChild(container)
      
      const imgData = canvas.toDataURL('image/png', 1.0)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pdfWidth - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      let heightLeft = imgHeight
      let position = 10
      
      // 添加第一页
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
      heightLeft -= (pdfHeight - 20)
      
      // 添加后续页面
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
        heightLeft -= (pdfHeight - 20)
      }
      
      // 生成文件名：公司代码_年份Q季度_财报分析报告.pdf
      const year = fullAnalysis.period?.match(/\d{4}/)?.[0] || 'FY'
      const quarter = fullAnalysis.period?.match(/Q(\d)/)?.[1] || ''
      const filename = `${fullAnalysis.company_symbol || 'Report'}_${year}${quarter ? `Q${quarter}` : ''}_财报分析报告.pdf`
      pdf.save(filename)
    } catch (error) {
      console.error('PDF导出失败:', error)
      alert('PDF导出失败，请尝试使用浏览器的打印功能 (Ctrl+P / Cmd+P)')
    } finally {
      setIsExporting(false)
    }
  }

  // 构建PDF专用HTML
  const buildPdfHtml = (data: Analysis) => {
    const styles = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; line-height: 1.6; font-size: 13px; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
        .logo { width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #4f46e5); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; }
        .company-info h1 { font-size: 22px; font-weight: 700; color: #111827; }
        .company-info p { font-size: 13px; color: #6b7280; margin-top: 2px; }
        .section { margin-bottom: 20px; background: white; border-radius: 10px; border: 1px solid #e5e7eb; overflow: hidden; page-break-inside: avoid; }
        .section-header { padding: 12px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 10px; }
        .section-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .section-title { font-size: 14px; font-weight: 600; color: #111827; }
        .section-content { padding: 16px; }
        .conclusion-box { background: linear-gradient(135deg, #3b82f6, #4f46e5); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .conclusion-box h3 { font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 6px; }
        .conclusion-box p { font-size: 15px; font-weight: 500; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; page-break-inside: avoid; }
        th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
        td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
        .text-right { text-align: right; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
        .badge-green { background: #dcfce7; color: #166534; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        .badge-gray { background: #f3f4f6; color: #4b5563; }
        .text-green { color: #16a34a; }
        .text-red { color: #dc2626; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .card { padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; page-break-inside: avoid; }
        .card-green { background: #f0fdf4; border-color: #bbf7d0; }
        .card-blue { background: #eff6ff; border-color: #bfdbfe; }
        .card-amber { background: #fffbeb; border-color: #fde68a; }
        .card-title { font-size: 12px; font-weight: 600; margin-bottom: 6px; }
        .card-text { font-size: 11px; color: #4b5563; line-height: 1.5; }
        .list-item { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 6px; font-size: 12px; }
        .list-dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
        .dot-green { background: #22c55e; }
        .dot-red { background: #ef4444; }
        .dot-blue { background: #3b82f6; }
      </style>
    `
    
    // 构建结果表格
    let resultsTableHtml = ''
    if (data.results_table && data.results_table.length > 0) {
      const rows = data.results_table.map((row) => {
        const deltaClass = row.delta?.startsWith('-') ? 'text-red' : (row.delta?.startsWith('+') ? 'text-green' : '')
        return `
          <tr>
            <td style="font-weight: 500;">${row.metric || '-'}</td>
            <td class="text-right" style="font-weight: 600;">${row.actual || '-'}</td>
            <td class="text-right" style="color: #6b7280;">${row.consensus || '-'}</td>
            <td class="text-right ${deltaClass}" style="font-weight: 600;">${row.delta || '-'}</td>
            <td style="color: #6b7280; font-size: 11px;">${row.assessment || '-'}</td>
          </tr>
        `
      }).join('')
      
      resultsTableHtml = `
        <div class="section">
          <div class="section-header">
            <div class="section-icon" style="background: #dbeafe; color: #2563eb;">📊</div>
            <div class="section-title">1) 业绩与指引 vs 市场预期</div>
          </div>
          <div class="section-content">
            <table>
              <thead>
                <tr>
                  <th>指标</th>
                  <th class="text-right">实际值</th>
                  <th class="text-right">市场预期</th>
                  <th class="text-right">差异</th>
                  <th>评估</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `
    }
    
    // 构建驱动因素
    let driversHtml = ''
    if (data.drivers) {
      driversHtml = `
        <div class="section">
          <div class="section-header">
            <div class="section-icon" style="background: #f3e8ff; color: #7c3aed;">⚡</div>
            <div class="section-title">2) 增长驱动拆解</div>
          </div>
          <div class="section-content">
            <div class="grid-3">
              <div class="card card-green">
                <div class="card-title" style="color: #166534;">${data.drivers.demand?.title || 'A. 需求/量'}</div>
                ${data.drivers.demand?.metrics ? `<div class="card-text"><strong>指标：</strong>${data.drivers.demand.metrics}</div>` : ''}
                <div class="card-text"><strong>变化：</strong>${data.drivers.demand?.change || '-'}</div>
                <div class="card-text"><strong>幅度：</strong><span class="text-green">${data.drivers.demand?.magnitude || '-'}</span></div>
                <div class="card-text"><strong>原因：</strong>${data.drivers.demand?.reason || '-'}</div>
              </div>
              <div class="card card-blue">
                <div class="card-title" style="color: #1e40af;">${data.drivers.monetization?.title || 'B. 变现/单价'}</div>
                ${data.drivers.monetization?.metrics ? `<div class="card-text"><strong>指标：</strong>${data.drivers.monetization.metrics}</div>` : ''}
                <div class="card-text"><strong>变化：</strong>${data.drivers.monetization?.change || '-'}</div>
                <div class="card-text"><strong>幅度：</strong><span style="color: #2563eb;">${data.drivers.monetization?.magnitude || '-'}</span></div>
                <div class="card-text"><strong>原因：</strong>${data.drivers.monetization?.reason || '-'}</div>
              </div>
              <div class="card card-amber">
                <div class="card-title" style="color: #92400e;">${data.drivers.efficiency?.title || 'C. 内部效率'}</div>
                ${data.drivers.efficiency?.metrics ? `<div class="card-text"><strong>指标：</strong>${data.drivers.efficiency.metrics}</div>` : ''}
                <div class="card-text"><strong>变化：</strong>${data.drivers.efficiency?.change || '-'}</div>
                <div class="card-text"><strong>幅度：</strong><span style="color: #d97706;">${data.drivers.efficiency?.magnitude || '-'}</span></div>
                <div class="card-text"><strong>原因：</strong>${data.drivers.efficiency?.reason || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      `
    }
    
    // 构建投入与ROI
    let investmentHtml = ''
    if (data.investment_roi) {
      const roiEvidence = (data.investment_roi.roi_evidence || []).map((e: string) => 
        `<div class="list-item"><div class="list-dot dot-green"></div><span>${e}</span></div>`
      ).join('')
      
      investmentHtml = `
        <div class="section">
          <div class="section-header">
            <div class="section-icon" style="background: #e0e7ff; color: #4f46e5;">💰</div>
            <div class="section-title">3) 投入与ROI分析</div>
          </div>
          <div class="section-content">
            <div class="grid-2" style="margin-bottom: 12px;">
              <div class="card"><strong>CapEx变化：</strong>${data.investment_roi.capex_change || '-'}</div>
              <div class="card"><strong>Opex变化：</strong>${data.investment_roi.opex_change || '-'}</div>
            </div>
            <div class="card" style="margin-bottom: 12px;"><strong>投入方向：</strong>${data.investment_roi.investment_direction || '-'}</div>
            ${roiEvidence ? `
              <div class="card card-green" style="margin-bottom: 12px;">
                <div class="card-title" style="color: #166534;">已体现的ROI证据</div>
                ${roiEvidence}
              </div>
            ` : ''}
            <div class="card card-amber">
              <div class="card-title" style="color: #92400e;">管理层底线框架</div>
              <div class="card-text">${data.investment_roi.management_commitment || '-'}</div>
            </div>
          </div>
        </div>
      `
    }
    
    // 构建可持续性与风险（只保留客观事实）
    let risksHtml = ''
    if (data.sustainability_risks) {
      const sustainableDrivers = (data.sustainability_risks.sustainable_drivers || []).map((d: string) => 
        `<div class="list-item"><div class="list-dot dot-green"></div><span>${d}</span></div>`
      ).join('')
      const mainRisks = (data.sustainability_risks.main_risks || []).map((r: string) => 
        `<div class="list-item"><div class="list-dot dot-red"></div><span>${r}</span></div>`
      ).join('')
      
      risksHtml = `
        <div class="section">
          <div class="section-header">
            <div class="section-icon" style="background: #fef3c7; color: #d97706;">⚠️</div>
            <div class="section-title">4) 可持续性与风险</div>
          </div>
          <div class="section-content">
            <div class="grid-2">
              <div class="card card-green">
                <div class="card-title" style="color: #166534;">可持续驱动</div>
                ${sustainableDrivers || '<span style="color: #9ca3af;">-</span>'}
              </div>
              <div class="card" style="background: #fef2f2; border-color: #fecaca;">
                <div class="card-title" style="color: #991b1b;">主要风险</div>
                ${mainRisks || '<span style="color: #9ca3af;">-</span>'}
              </div>
            </div>
          </div>
        </div>
      `
    }
    
    // 构建模型影响
    let modelImpactHtml = ''
    if (data.model_impact) {
      const upgradeFactors = (data.model_impact.upgrade_factors || []).map((f: string) => 
        `<div class="list-item"><div class="list-dot dot-green"></div><span>${f}</span></div>`
      ).join('')
      const downgradeFactors = (data.model_impact.downgrade_factors || []).map((f: string) => 
        `<div class="list-item"><div class="list-dot dot-red"></div><span>${f}</span></div>`
      ).join('')
      
      modelImpactHtml = `
        <div class="section">
          <div class="section-header">
            <div class="section-icon" style="background: #e0e7ff; color: #4f46e5;">📈</div>
            <div class="section-title">5) 模型影响（估值假设变化）</div>
          </div>
          <div class="section-content">
            <div class="grid-2" style="margin-bottom: 12px;">
              <div class="card card-green">
                <div class="card-title" style="color: #166534;">上调</div>
                ${upgradeFactors || '<span style="color: #9ca3af;">-</span>'}
              </div>
              <div class="card" style="background: #fef2f2; border-color: #fecaca;">
                <div class="card-title" style="color: #991b1b;">下调</div>
                ${downgradeFactors || '<span style="color: #9ca3af;">-</span>'}
              </div>
            </div>
            ${data.model_impact.logic_chain ? `
              <div class="card card-blue">
                <div class="card-title" style="color: #1e40af;">逻辑链</div>
                <div class="card-text">${data.model_impact.logic_chain}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `
    }
    
    // 提取年份和季度用于标题
    const year = data.period?.match(/\d{4}/)?.[0] || ''
    const quarter = data.period?.match(/Q(\d)/)?.[1] || ''
    
    return `
      ${styles}
      <div class="header">
        <div class="logo">${(data.company_symbol || '??').slice(0, 2)}</div>
        <div class="company-info">
          <h1>${data.company_name || '未知公司'}</h1>
          <p>${data.company_symbol || ''} · ${quarter ? `Q${quarter}` : 'FY'} ${year} · 财报分析报告</p>
        </div>
      </div>
      
      <div class="conclusion-box">
        <h3>📌 一句话结论</h3>
        <p>${data.one_line_conclusion || '暂无结论'}</p>
      </div>
      
      ${resultsTableHtml}
      ${driversHtml}
      ${investmentHtml}
      ${risksHtml}
      ${modelImpactHtml}
    `
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-4 md:inset-8 lg:inset-12 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm">
                {fullAnalysis.company_symbol?.slice(0, 4) || 'N/A'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{fullAnalysis.company_name}</h2>
                <p className="text-sm text-slate-500">
                  {fullAnalysis.period} · {
                    fullAnalysis.category === 'AI_APPLICATION' ? 'AI应用公司' :
                    fullAnalysis.category === 'CONSUMER_GOODS' ? '消费品公司' : 'AI供应链公司'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                导出PDF
              </Button>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 print:p-0" id="analysis-content">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              {/* 一句话结论 */}
              {fullAnalysis.one_line_conclusion && (
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                  <h3 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    核心结论
                  </h3>
                  <p className="text-lg font-medium text-slate-800 leading-relaxed">
                    {fullAnalysis.one_line_conclusion}
                  </p>
                </div>
              )}

              {/* 投委会总结已删除 - 只保留客观数据对比 */}

              {/* 关键指标表格 */}
              {fullAnalysis.results_table && fullAnalysis.results_table.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    关键财务指标
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">指标</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">实际</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">预期</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">差异</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">同比变化</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {fullAnalysis.results_table.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{row.metric}</td>
                            <td className="px-4 py-3 text-slate-700 font-mono">{row.actual}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono">{row.consensus || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`font-medium font-mono ${
                                row.delta?.startsWith('+') ? 'text-green-600' : 
                                row.delta?.startsWith('-') ? 'text-red-600' : 'text-slate-600'
                              }`}>
                                {row.delta || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-slate-600">
                                {row.assessment || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 三大驱动 */}
              {fullAnalysis.drivers && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    增长驱动分析
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {fullAnalysis.drivers.demand && (
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <h4 className="font-semibold text-blue-700 mb-2">{fullAnalysis.drivers.demand.title}</h4>
                        <p className="text-sm text-blue-600 mb-2">{fullAnalysis.drivers.demand.metrics}</p>
                        <p className="text-sm text-slate-700 mb-1"><strong>变化：</strong>{fullAnalysis.drivers.demand.change}</p>
                        <p className="text-sm text-slate-700 mb-1"><strong>幅度：</strong>{fullAnalysis.drivers.demand.magnitude}</p>
                        <p className="text-sm text-slate-600"><strong>原因：</strong>{fullAnalysis.drivers.demand.reason}</p>
                      </div>
                    )}
                    {fullAnalysis.drivers.monetization && (
                      <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                        <h4 className="font-semibold text-green-700 mb-2">{fullAnalysis.drivers.monetization.title}</h4>
                        <p className="text-sm text-green-600 mb-2">{fullAnalysis.drivers.monetization.metrics}</p>
                        <p className="text-sm text-slate-700 mb-1"><strong>变化：</strong>{fullAnalysis.drivers.monetization.change}</p>
                        <p className="text-sm text-slate-700 mb-1"><strong>幅度：</strong>{fullAnalysis.drivers.monetization.magnitude}</p>
                        <p className="text-sm text-slate-600"><strong>原因：</strong>{fullAnalysis.drivers.monetization.reason}</p>
                      </div>
                    )}
                    {fullAnalysis.drivers.efficiency && (
                      <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                        <h4 className="font-semibold text-purple-700 mb-2">{fullAnalysis.drivers.efficiency.title}</h4>
                        <p className="text-sm text-purple-600 mb-2">{fullAnalysis.drivers.efficiency.metrics}</p>
                        <p className="text-sm text-slate-700 mb-1"><strong>变化：</strong>{fullAnalysis.drivers.efficiency.change}</p>
                        <p className="text-sm text-slate-700 mb-1"><strong>幅度：</strong>{fullAnalysis.drivers.efficiency.magnitude}</p>
                        <p className="text-sm text-slate-600"><strong>原因：</strong>{fullAnalysis.drivers.efficiency.reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 投入与ROI */}
              {fullAnalysis.investment_roi && (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    投入与ROI
                  </h3>
                  <div className="space-y-3">
                    <p className="text-sm text-slate-700"><strong>CapEx变化：</strong>{fullAnalysis.investment_roi.capex_change}</p>
                    <p className="text-sm text-slate-700"><strong>Opex变化：</strong>{fullAnalysis.investment_roi.opex_change}</p>
                    <p className="text-sm text-slate-700"><strong>投入方向：</strong>{fullAnalysis.investment_roi.investment_direction}</p>
                    {fullAnalysis.investment_roi.roi_evidence && fullAnalysis.investment_roi.roi_evidence.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-700 mb-1">ROI证据：</p>
                        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                          {fullAnalysis.investment_roi.roi_evidence.map((evidence, idx) => (
                            <li key={idx}>{evidence}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-sm text-slate-700"><strong>管理层承诺：</strong>{fullAnalysis.investment_roi.management_commitment}</p>
                  </div>
                </div>
              )}

              {/* 风险与检查点 */}
              {fullAnalysis.sustainability_risks && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 可持续驱动 */}
                  {fullAnalysis.sustainability_risks.sustainable_drivers && fullAnalysis.sustainability_risks.sustainable_drivers.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                      <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        可持续驱动
                      </h4>
                      <ul className="space-y-2">
                        {fullAnalysis.sustainability_risks.sustainable_drivers.map((driver, idx) => (
                          <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            {driver}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* 主要风险 */}
                  {fullAnalysis.sustainability_risks.main_risks && fullAnalysis.sustainability_risks.main_risks.length > 0 && (
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                      <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        主要风险
                      </h4>
                      <ul className="space-y-2">
                        {fullAnalysis.sustainability_risks.main_risks.map((risk, idx) => (
                          <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">⚠</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 检查点 */}
              {fullAnalysis.sustainability_risks?.checkpoints && fullAnalysis.sustainability_risks.checkpoints.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <h4 className="font-semibold text-amber-700 mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    后续检查点
                  </h4>
                  <ul className="space-y-2">
                    {fullAnalysis.sustainability_risks.checkpoints.map((checkpoint, idx) => (
                      <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">📍</span>
                        {checkpoint}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 投资判断已删除 - 只保留客观数据对比 */}

              {/* 研报对比 */}
              {fullAnalysis.research_comparison && (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-600 mb-4">研报对比分析</h3>
                  {fullAnalysis.research_comparison.consensus_source && (
                    <p className="text-sm text-slate-700 mb-3">
                      <strong>预期来源：</strong>{fullAnalysis.research_comparison.consensus_source}
                    </p>
                  )}
                  {fullAnalysis.research_comparison.key_differences && fullAnalysis.research_comparison.key_differences.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-slate-700 mb-1">关键差异：</p>
                      <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                        {fullAnalysis.research_comparison.key_differences.map((diff, idx) => (
                          <li key={idx}>{diff}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {fullAnalysis.research_comparison.analyst_blind_spots && (
                    <p className="text-sm text-slate-700">
                      <strong>分析师盲点：</strong>{fullAnalysis.research_comparison.analyst_blind_spots}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
