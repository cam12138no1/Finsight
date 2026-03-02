'use client'

import { BarChart3, TrendingUp, DollarSign, AlertTriangle, CheckCircle, Target } from 'lucide-react'

interface Analysis {
  id: string
  company_name: string
  company_symbol: string
  period: string
  category: string
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
    demand?: { title: string; metrics: string; change: string; magnitude: string; reason: string }
    monetization?: { title: string; metrics: string; change: string; magnitude: string; reason: string }
    efficiency?: { title: string; metrics: string; change: string; magnitude: string; reason: string }
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
  research_comparison?: {
    consensus_source?: string
    key_differences?: string[]
    beat_miss_summary?: string
    analyst_blind_spots?: string
  }
}

interface Props {
  analysis: Analysis
  hasResearchReport: boolean
}

/**
 * Objective Analysis View - only shows factual financial data extraction
 * No AI evaluations like "beat", "strong beat", recommendations, etc.
 * When no research report: shows raw financial data
 * When research report uploaded: shows comparison data
 */
export default function AnalysisView({ analysis, hasResearchReport }: Props) {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Core Summary - Objective */}
        {analysis.one_line_conclusion && (
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
            <h3 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              核心数据摘要
            </h3>
            <p className="text-lg font-medium text-slate-800 leading-relaxed">
              {stripSubjectiveContent(analysis.one_line_conclusion)}
            </p>
          </div>
        )}

        {/* Key Financial Metrics Table */}
        {analysis.results_table && analysis.results_table.length > 0 && (
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
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">实际值</th>
                    {hasResearchReport && (
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">市场预期</th>
                    )}
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">同比变化</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.results_table.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{row.metric}</td>
                      <td className="px-4 py-3 text-slate-700 font-mono">{row.actual}</td>
                      {hasResearchReport && (
                        <td className="px-4 py-3 text-slate-500 font-mono">{row.consensus || '-'}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`font-medium font-mono ${
                          row.delta?.startsWith('+') ? 'text-green-600' :
                          row.delta?.startsWith('-') ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {row.delta || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {analysis.results_summary && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-sm text-slate-700 leading-relaxed">
              {stripSubjectiveContent(analysis.results_summary)}
            </p>
          </div>
        )}

        {/* Drivers - Objective Data Only */}
        {analysis.drivers && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              增长驱动数据
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analysis.drivers.demand && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <h4 className="font-semibold text-blue-700 mb-2">{analysis.drivers.demand.title}</h4>
                  {analysis.drivers.demand.metrics && (
                    <p className="text-sm text-blue-600 mb-2">{analysis.drivers.demand.metrics}</p>
                  )}
                  <p className="text-sm text-slate-700 mb-1"><strong>变化：</strong>{analysis.drivers.demand.change}</p>
                  <p className="text-sm text-slate-700 mb-1"><strong>幅度：</strong>{analysis.drivers.demand.magnitude}</p>
                  <p className="text-sm text-slate-600"><strong>原因：</strong>{analysis.drivers.demand.reason}</p>
                </div>
              )}
              {analysis.drivers.monetization && (
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <h4 className="font-semibold text-green-700 mb-2">{analysis.drivers.monetization.title}</h4>
                  {analysis.drivers.monetization.metrics && (
                    <p className="text-sm text-green-600 mb-2">{analysis.drivers.monetization.metrics}</p>
                  )}
                  <p className="text-sm text-slate-700 mb-1"><strong>变化：</strong>{analysis.drivers.monetization.change}</p>
                  <p className="text-sm text-slate-700 mb-1"><strong>幅度：</strong>{analysis.drivers.monetization.magnitude}</p>
                  <p className="text-sm text-slate-600"><strong>原因：</strong>{analysis.drivers.monetization.reason}</p>
                </div>
              )}
              {analysis.drivers.efficiency && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <h4 className="font-semibold text-purple-700 mb-2">{analysis.drivers.efficiency.title}</h4>
                  {analysis.drivers.efficiency.metrics && (
                    <p className="text-sm text-purple-600 mb-2">{analysis.drivers.efficiency.metrics}</p>
                  )}
                  <p className="text-sm text-slate-700 mb-1"><strong>变化：</strong>{analysis.drivers.efficiency.change}</p>
                  <p className="text-sm text-slate-700 mb-1"><strong>幅度：</strong>{analysis.drivers.efficiency.magnitude}</p>
                  <p className="text-sm text-slate-600"><strong>原因：</strong>{analysis.drivers.efficiency.reason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Investment & CapEx Data */}
        {analysis.investment_roi && (
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              投入与资本支出数据
            </h3>
            <div className="space-y-3">
              <p className="text-sm text-slate-700"><strong>CapEx变化：</strong>{analysis.investment_roi.capex_change}</p>
              <p className="text-sm text-slate-700"><strong>Opex变化：</strong>{analysis.investment_roi.opex_change}</p>
              <p className="text-sm text-slate-700"><strong>投入方向：</strong>{analysis.investment_roi.investment_direction}</p>
              {analysis.investment_roi.roi_evidence && analysis.investment_roi.roi_evidence.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">ROI数据：</p>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    {analysis.investment_roi.roi_evidence.map((evidence, idx) => (
                      <li key={idx}>{evidence}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-sm text-slate-700"><strong>管理层表态：</strong>{analysis.investment_roi.management_commitment}</p>
            </div>
          </div>
        )}

        {/* Factual Risk Data */}
        {analysis.sustainability_risks && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.sustainability_risks.sustainable_drivers && analysis.sustainability_risks.sustainable_drivers.length > 0 && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  可持续驱动因素
                </h4>
                <ul className="space-y-2">
                  {analysis.sustainability_risks.sustainable_drivers.map((driver, idx) => (
                    <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">-</span>
                      {driver}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.sustainability_risks.main_risks && analysis.sustainability_risks.main_risks.length > 0 && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  主要风险因素
                </h4>
                <ul className="space-y-2">
                  {analysis.sustainability_risks.main_risks.map((risk, idx) => (
                    <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5 flex-shrink-0">-</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Research Comparison - only when research report is uploaded */}
        {hasResearchReport && analysis.research_comparison && (
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-600 mb-4">研报数据对比</h3>
            {analysis.research_comparison.consensus_source && (
              <p className="text-sm text-slate-700 mb-3">
                <strong>预期来源：</strong>{analysis.research_comparison.consensus_source}
              </p>
            )}
            {analysis.research_comparison.key_differences && analysis.research_comparison.key_differences.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">数据差异：</p>
                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                  {analysis.research_comparison.key_differences.map((diff, idx) => (
                    <li key={idx}>{stripSubjectiveContent(diff)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Not uploaded research report hint */}
        {!hasResearchReport && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
            <p className="text-sm text-amber-700">
              当前展示财报原始数据。上传研报后可查看包含市场预期对比的分析数据。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Strip subjective AI evaluations from text
 * Removes: beat, miss, strong beat, strong miss, recommendation language, etc.
 */
function stripSubjectiveContent(text: string): string {
  if (!text) return text
  return text
    .replace(/\b(strong\s+)?beat\b/gi, '')
    .replace(/\b(strong\s+)?miss\b/gi, '')
    .replace(/\b(moderate\s+)?beat\b/gi, '')
    .replace(/\b(moderate\s+)?miss\b/gi, '')
    .replace(/\binline\b/gi, '')
    .replace(/超预期/g, '')
    .replace(/不及预期/g, '')
    .replace(/低于预期/g, '')
    .replace(/超配/g, '')
    .replace(/低配/g, '')
    .replace(/标配/g, '')
    .replace(/加仓/g, '')
    .replace(/减仓/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
