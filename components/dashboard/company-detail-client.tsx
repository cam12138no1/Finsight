'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  Trash2, BookOpen
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { upload } from '@vercel/blob/client'
import { getCompanyBySymbol, getCompanyCategoryBySymbol } from '@/lib/companies'
import AnalysisView from './analysis-view-objective'

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
  research_comparison?: {
    consensus_source?: string
    key_differences?: string[]
    analyst_blind_spots?: string
  }
  has_research_report?: boolean
}

interface DbQuarter {
  fiscal_year: number
  fiscal_quarter: number
  period: string
  has_report_text: boolean
  analysis_result: any | null
}

interface FileItem {
  file: File
  id: string
}

interface UploadedFile {
  url: string
  pathname: string
  originalName: string
}

const MAX_FILE_SIZE = 500 * 1024 * 1024

function generatePast3YearsQuarters(): { year: number; quarter: number; label: string }[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)
  const quarters: { year: number; quarter: number; label: string }[] = []
  let y = currentYear
  let q = currentQuarter
  for (let i = 0; i < 12; i++) {
    quarters.push({ year: y, quarter: q, label: `${y} Q${q}` })
    q--
    if (q === 0) { q = 4; y-- }
  }
  return quarters
}

export default function CompanyDetailClient({ symbol }: { symbol: string }) {
  const router = useRouter()
  const company = getCompanyBySymbol(symbol)
  const category = getCompanyCategoryBySymbol(symbol)

  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)

  // User-uploaded analysis for selected period
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [fullAnalysis, setFullAnalysis] = useState<Analysis | null>(null)
  const [isLoadingFull, setIsLoadingFull] = useState(false)

  // DB-fetched quarters from cron
  const [dbQuarters, setDbQuarters] = useState<DbQuarter[]>([])

  // Research report upload state
  const [showResearchUpload, setShowResearchUpload] = useState(false)
  const [researchFiles, setResearchFiles] = useState<FileItem[]>([])
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')
  const isSubmittingRef = useRef(false)

  const allPeriods = generatePast3YearsQuarters()

  const loadData = useCallback(async () => {
    try {
      const [dashboardRes, companyDataRes] = await Promise.allSettled([
        fetch('/api/dashboard'),
        fetch(`/api/company-data?symbol=${encodeURIComponent(symbol)}`),
      ])

      let userAnalyses: Analysis[] = []
      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
        const data = await dashboardRes.value.json()
        if (data.analyses) {
          userAnalyses = data.analyses.filter(
            (a: Analysis) => a.company_symbol?.toUpperCase() === symbol.toUpperCase()
          )
          userAnalyses.sort((a: Analysis, b: Analysis) => {
            if ((b.fiscal_year || 0) !== (a.fiscal_year || 0)) return (b.fiscal_year || 0) - (a.fiscal_year || 0)
            return (b.fiscal_quarter || 0) - (a.fiscal_quarter || 0)
          })
        }
      }
      setAnalyses(userAnalyses)

      let fetchedQuarters: DbQuarter[] = []
      if (companyDataRes.status === 'fulfilled' && companyDataRes.value.ok) {
        const data = await companyDataRes.value.json()
        if (data.financials && data.financials.length > 0) {
          fetchedQuarters = data.financials.map((f: any) => ({
            fiscal_year: f.fiscal_year,
            fiscal_quarter: f.fiscal_quarter,
            period: f.period || `${f.fiscal_year} Q${f.fiscal_quarter}`,
            has_report_text: !!f.report_text,
            analysis_result: f.analysis_result,
          }))
        }
      }
      setDbQuarters(fetchedQuarters)

      // Auto-select newest period that has any data
      if (!selectedPeriod) {
        // Prefer DB data (cron-fetched), fall back to user analyses
        if (fetchedQuarters.length > 0) {
          setSelectedPeriod(fetchedQuarters[0].period)
        } else if (userAnalyses.length > 0 && userAnalyses[0].fiscal_year) {
          setSelectedPeriod(`${userAnalyses[0].fiscal_year} Q${userAnalyses[0].fiscal_quarter}`)
        }
      }

      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load data:', error)
      setIsLoading(false)
    }
  }, [symbol, selectedPeriod])

  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      if (analyses.some(a => a.processing && !a.processed)) loadData()
    }, 3000)
    return () => clearInterval(interval)
  }, [loadData, analyses])

  // Build lookup maps
  const userAnalysisByPeriod = new Map<string, Analysis>()
  for (const a of analyses) {
    if (a.processed && !a.error && a.fiscal_year && a.fiscal_quarter) {
      const key = `${a.fiscal_year} Q${a.fiscal_quarter}`
      if (!userAnalysisByPeriod.has(key)) userAnalysisByPeriod.set(key, a)
    }
  }

  const dbQuarterByPeriod = new Map<string, DbQuarter>()
  for (const dq of dbQuarters) {
    dbQuarterByPeriod.set(dq.period, dq)
  }

  // Determine what data is available for the selected period
  const selectedDbQuarter = selectedPeriod ? dbQuarterByPeriod.get(selectedPeriod) : null
  const selectedUserAnalysis = selectedPeriod ? userAnalysisByPeriod.get(selectedPeriod) : null
  const hasFinancialData = !!selectedDbQuarter || !!selectedUserAnalysis

  // The analysis to display: user analysis (with research comparison) takes priority, then DB analysis_result
  const displayAnalysis = selectedUserAnalysis
    ? fullAnalysis
    : selectedDbQuarter?.analysis_result
    ? selectedDbQuarter.analysis_result as Analysis
    : null

  const hasResearchReport = !!displayAnalysis?.has_research_report || !!displayAnalysis?.research_comparison

  // Load full user analysis when selection changes
  useEffect(() => {
    if (!selectedUserAnalysis) {
      setFullAnalysis(null)
      return
    }
    setIsLoadingFull(true)
    fetch(`/api/reports/${selectedUserAnalysis.id}`)
      .then(res => res.json())
      .then(data => {
        const analysisData = data.report || data.analysis
        if (analysisData) setFullAnalysis(analysisData)
      })
      .catch(err => console.error('Failed to load full analysis:', err))
      .finally(() => setIsLoadingFull(false))
  }, [selectedUserAnalysis?.id])

  const handlePeriodSelect = (periodLabel: string) => {
    setSelectedPeriod(periodLabel)
    setSelectedAnalysis(userAnalysisByPeriod.get(periodLabel) || null)
    setFullAnalysis(null)
    setShowResearchUpload(false)
  }

  // File handlers
  const addResearchFiles = (newFiles: FileList) => {
    const validFiles: FileItem[] = []
    Array.from(newFiles).forEach(file => {
      if (file.type !== 'application/pdf') return
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: '文件过大', description: `${file.name} 超过500MB限制`, variant: 'destructive' })
        return
      }
      if (!researchFiles.some(f => f.file.name === file.name)) {
        validFiles.push({ file, id: `${file.name}_${Date.now()}_${Math.random()}` })
      }
    })
    if (validFiles.length > 0) setResearchFiles(prev => [...prev, ...validFiles])
  }

  const uploadFileToBlob = async (file: File, prefix: string): Promise<UploadedFile> => {
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pathname = `uploads/${prefix}/${timestamp}_${safeName}`
    const blob = await upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/blob/upload-token',
    })
    return { url: blob.url, pathname: blob.pathname, originalName: file.name }
  }

  // Upload research report → triggers comparison analysis with existing financial data
  const handleResearchUpload = async () => {
    if (isSubmittingRef.current || researchFiles.length === 0 || !selectedPeriod) return

    isSubmittingRef.current = true
    setUploadStatus('uploading')
    setUploadError('')
    setUploadProgress('上传研报...')

    try {
      const uploadedResearch: UploadedFile[] = []
      for (let i = 0; i < researchFiles.length; i++) {
        setUploadProgress(`上传研报 ${i + 1}/${researchFiles.length}`)
        uploadedResearch.push(await uploadFileToBlob(researchFiles[i].file, 'research'))
      }

      setUploadStatus('analyzing')
      setUploadProgress('AI正在客观对比财报与研报数据...')

      const match = selectedPeriod.match(/(\d{4}) Q(\d)/)
      const year = match ? parseInt(match[1]) : new Date().getFullYear()
      const quarter = match ? parseInt(match[2]) : 4

      const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const response = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialFiles: [],
          researchFiles: uploadedResearch,
          category: category || 'AI_APPLICATION',
          requestId,
          fiscalYear: year,
          fiscalQuarter: quarter,
          useDbFinancialData: true,
          companySymbol: symbol,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '对比分析失败')
      }

      setUploadStatus('success')
      toast({ title: '对比分析完成', description: '研报与财报数据的客观对比已生成' })

      setTimeout(() => {
        setResearchFiles([])
        setUploadStatus('idle')
        setShowResearchUpload(false)
        isSubmittingRef.current = false
        loadData()
      }, 1500)
    } catch (error: any) {
      setUploadStatus('error')
      setUploadError(error.message || '对比分析失败')
      toast({ title: '分析失败', description: error.message, variant: 'destructive' })
      isSubmittingRef.current = false
    }
  }

  const isProcessing = uploadStatus === 'uploading' || uploadStatus === 'analyzing'

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
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/dashboard?category=${category || 'AI_APPLICATION'}`)}
              className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm">
              {symbol.slice(0, 4)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{company?.name || symbol}</h1>
              <p className="text-sm text-slate-500">{company?.nameZh || ''} · {symbol} · 季度财报数据</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Left sidebar: Quarter tabs */}
        <div className="w-44 flex-shrink-0">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">季度选择</h3>
          <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {allPeriods.map(p => {
              const key = p.label
              const hasDbData = dbQuarterByPeriod.has(key)
              const hasUserData = userAnalysisByPeriod.has(key)
              const hasData = hasDbData || hasUserData
              const isSelected = selectedPeriod === key
              const isProcessingPeriod = analyses.some(
                a => a.processing && !a.processed && a.fiscal_year === p.year && a.fiscal_quarter === p.quarter
              )

              return (
                <button
                  key={key}
                  onClick={() => handlePeriodSelect(key)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : hasData
                      ? 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                >
                  <span>{key}</span>
                  <span className="flex items-center gap-1">
                    {isProcessingPeriod && <Loader2 className="h-3 w-3 animate-spin" />}
                    {hasData && !isSelected && <span className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />}
                    {hasUserData && !isSelected && <span className="h-2 w-2 rounded-full bg-purple-400 flex-shrink-0" title="含研报对比" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {selectedPeriod ? (
            <>
              {/* Period Header + Actions */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">{selectedPeriod} 财报数据</h2>
                <div className="flex gap-2">
                  {hasFinancialData && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowResearchUpload(!showResearchUpload)}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      <BookOpen className="mr-1.5 h-4 w-4" />
                      上传研报对比
                    </Button>
                  )}
                </div>
              </div>

              {/* Research Upload Panel */}
              {showResearchUpload && hasFinancialData && (
                <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900 mb-4">
                    上传研报（与财报数据客观对比）
                  </h3>

                  {isProcessing && (
                    <div className="mb-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 text-purple-600 animate-spin flex-shrink-0" />
                        <div>
                          <p className="font-medium text-purple-900 text-sm">
                            {uploadStatus === 'uploading' ? '正在上传...' : 'AI正在客观对比分析...'}
                          </p>
                          <p className="text-xs text-purple-600">{uploadProgress}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {uploadStatus === 'success' && (
                    <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <p className="font-medium text-green-900 text-sm">对比分析完成</p>
                    </div>
                  )}
                  {uploadStatus === 'error' && (
                    <div className="mb-4 p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <p className="font-medium text-red-900 text-sm">{uploadError}</p>
                    </div>
                  )}

                  {!isProcessing && uploadStatus !== 'success' && (
                    <>
                      <div className="border-2 border-dashed border-purple-200 rounded-xl p-4 hover:border-purple-300 transition-colors mb-3">
                        <input
                          type="file"
                          accept=".pdf"
                          multiple
                          onChange={e => e.target.files && addResearchFiles(e.target.files)}
                          className="hidden"
                          id="research-upload"
                        />
                        <label htmlFor="research-upload" className="cursor-pointer block text-center">
                          <Upload className="h-6 w-6 text-purple-400 mx-auto mb-1" />
                          <p className="text-sm text-slate-600">点击上传研报PDF（用于与财报数据客观对比）</p>
                          <p className="text-xs text-slate-400 mt-1">仅展示数据差异，不含任何主观评价</p>
                        </label>
                      </div>

                      {researchFiles.map(item => (
                        <div key={item.id} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg mb-1.5">
                          <FileText className="h-4 w-4 text-purple-500 flex-shrink-0" />
                          <span className="text-sm text-slate-700 flex-1 truncate">{item.file.name}</span>
                          <span className="text-xs text-slate-400">{(item.file.size / 1024 / 1024).toFixed(1)}MB</span>
                          <button onClick={() => setResearchFiles(prev => prev.filter(f => f.id !== item.id))} className="p-1 hover:bg-slate-100 rounded">
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </button>
                        </div>
                      ))}

                      <div className="flex gap-3 mt-4">
                        <Button variant="outline" size="sm" onClick={() => { setShowResearchUpload(false); setResearchFiles([]) }} className="flex-1">取消</Button>
                        <Button
                          size="sm"
                          onClick={handleResearchUpload}
                          disabled={researchFiles.length === 0}
                          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
                        >
                          开始客观对比
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Analysis Content */}
              {hasFinancialData && displayAnalysis && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  {isLoadingFull && selectedUserAnalysis ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    </div>
                  ) : (
                    <AnalysisView
                      analysis={displayAnalysis}
                      hasResearchReport={hasResearchReport}
                    />
                  )}
                </div>
              )}

              {/* DB has data but no analysis_result yet → show raw metrics */}
              {hasFinancialData && !displayAnalysis && selectedDbQuarter && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-blue-600 mb-4">财报核心指标（来自数据API）</h3>
                  <p className="text-sm text-slate-500 mb-4">该季度财报数据已通过API获取，AI核心数据提取尚未完成。</p>
                  <div className="text-xs text-slate-400">数据将在下次 Cron 任务运行时自动提取分析。</div>
                </div>
              )}

              {/* No data at all */}
              {!hasFinancialData && (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-7 w-7 text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-700 mb-2">
                    {selectedPeriod} 暂无财报数据
                  </h3>
                  <p className="text-sm text-slate-500">
                    财报数据由系统每日自动获取，该季度暂未收录
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-500">请从左侧选择一个季度查看财报数据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
