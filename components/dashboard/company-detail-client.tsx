'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  Trash2, BookOpen, MessageSquareQuote, ChevronDown, ChevronUp
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
  report_text: string | null
  revenue: string | null
  revenue_yoy: string | null
  net_income: string | null
  net_income_yoy: string | null
  eps: string | null
  eps_yoy: string | null
  operating_margin: string | null
  gross_margin: string | null
  filing_date: string | null
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

type ViewMode = 'quarterly' | 'annual'

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

function generatePast3Years(): { year: number; label: string }[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 4 }, (_, i) => ({
    year: currentYear - i,
    label: `FY ${currentYear - i}`,
  }))
}

export default function CompanyDetailClient({ symbol }: { symbol: string }) {
  const router = useRouter()
  const company = getCompanyBySymbol(symbol)
  const category = getCompanyCategoryBySymbol(symbol)

  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('quarterly')
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)

  // User-uploaded analysis for selected period
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [fullAnalysis, setFullAnalysis] = useState<Analysis | null>(null)
  const [isLoadingFull, setIsLoadingFull] = useState(false)

  // DB-fetched quarters from cron
  const [dbQuarters, setDbQuarters] = useState<DbQuarter[]>([])

  // Transcript state
  const [transcript, setTranscript] = useState<{ content: string; transcript_date: string; speakers: string[] } | null>(null)
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  // Research report upload state
  const [showResearchUpload, setShowResearchUpload] = useState(false)
  const [researchFiles, setResearchFiles] = useState<FileItem[]>([])
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')
  const isSubmittingRef = useRef(false)

  const allQuarterPeriods = generatePast3YearsQuarters()
  const allAnnualPeriods = generatePast3Years()

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
            report_text: f.report_text || null,
            revenue: f.revenue,
            revenue_yoy: f.revenue_yoy,
            net_income: f.net_income,
            net_income_yoy: f.net_income_yoy,
            eps: f.eps,
            eps_yoy: f.eps_yoy,
            operating_margin: f.operating_margin,
            gross_margin: f.gross_margin,
            filing_date: f.filing_date,
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
  const isAnnualView = selectedPeriod?.startsWith('FY ')
  const selectedFiscalYear = isAnnualView ? parseInt(selectedPeriod!.replace('FY ', '')) : null

  // For annual view: collect all quarters of that year
  const annualDbQuarters = isAnnualView && selectedFiscalYear
    ? dbQuarters.filter(dq => dq.fiscal_year === selectedFiscalYear)
    : []

  const selectedDbQuarter = isAnnualView ? null : (selectedPeriod ? dbQuarterByPeriod.get(selectedPeriod) : null)
  const selectedUserAnalysis = isAnnualView ? null : (selectedPeriod ? userAnalysisByPeriod.get(selectedPeriod) : null)
  const hasFinancialData = !!selectedDbQuarter || !!selectedUserAnalysis || annualDbQuarters.length > 0

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

  // Load transcript when a quarterly period is selected
  useEffect(() => {
    if (!selectedPeriod || selectedPeriod.startsWith('FY ')) {
      setTranscript(null)
      return
    }
    const match = selectedPeriod.match(/(\d{4}) Q(\d)/)
    if (!match) return

    setIsLoadingTranscript(true)
    fetch(`/api/transcripts?symbol=${encodeURIComponent(symbol)}&year=${match[1]}&quarter=${match[2]}`)
      .then(res => res.json())
      .then(data => {
        if (data.transcript?.content) {
          setTranscript({
            content: data.transcript.content,
            transcript_date: data.transcript.transcript_date,
            speakers: data.transcript.speakers || [],
          })
        } else {
          setTranscript(null)
        }
      })
      .catch(() => setTranscript(null))
      .finally(() => setIsLoadingTranscript(false))
  }, [selectedPeriod, symbol])

  const handlePeriodSelect = (periodLabel: string) => {
    setSelectedPeriod(periodLabel)
    setSelectedAnalysis(userAnalysisByPeriod.get(periodLabel) || null)
    setFullAnalysis(null)
    setShowResearchUpload(false)
    setShowTranscript(false)
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
        {/* Left sidebar: Period selector */}
        <div className="w-48 flex-shrink-0">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 mb-4">
            <button
              onClick={() => { setViewMode('quarterly'); setSelectedPeriod(null) }}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                viewMode === 'quarterly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              季度
            </button>
            <button
              onClick={() => { setViewMode('annual'); setSelectedPeriod(null) }}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                viewMode === 'annual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              年度
            </button>
          </div>

          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
            {viewMode === 'quarterly' ? '季度选择' : '年度选择'}
          </h3>
          <div className="space-y-1 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {viewMode === 'quarterly' ? (
              allQuarterPeriods.map(p => {
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
              })
            ) : (
              allAnnualPeriods.map(p => {
                const key = `FY ${p.year}`
                const hasData = dbQuarters.some(dq => dq.fiscal_year === p.year) ||
                  analyses.some(a => a.fiscal_year === p.year && a.processed && !a.error)
                const isSelected = selectedPeriod === key
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
                    {hasData && !isSelected && <span className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />}
                  </button>
                )
              })
            )}
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

              {/* Quarterly: DB has data → show full metrics */}
              {!isAnnualView && hasFinancialData && !displayAnalysis && selectedDbQuarter && (
                <DbQuarterDetailView quarter={selectedDbQuarter} allQuarters={dbQuarters} period={selectedPeriod || ''} />
              )}

              {/* Annual: show all quarters of that year side-by-side */}
              {isAnnualView && annualDbQuarters.length > 0 && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-blue-600 mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      FY {selectedFiscalYear} 年度财报汇总
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-4 py-3 text-left font-semibold text-slate-600">指标</th>
                            {annualDbQuarters
                              .sort((a, b) => a.fiscal_quarter - b.fiscal_quarter)
                              .map(q => (
                                <th key={q.period} className="px-4 py-3 text-right font-semibold text-slate-600">
                                  Q{q.fiscal_quarter}
                                </th>
                              ))
                            }
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { label: 'Revenue（营收）', key: 'revenue' as const },
                            { label: 'Net Income（净利润）', key: 'net_income' as const },
                            { label: 'EPS（每股收益）', key: 'eps' as const },
                            { label: 'Operating Margin', key: 'operating_margin' as const },
                            { label: 'Gross Margin', key: 'gross_margin' as const },
                          ].map(metric => (
                            <tr key={metric.key} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-medium text-slate-800">{metric.label}</td>
                              {annualDbQuarters
                                .sort((a, b) => a.fiscal_quarter - b.fiscal_quarter)
                                .map(q => (
                                  <td key={q.period} className="px-4 py-2.5 text-right font-mono text-slate-800">
                                    {q[metric.key] || '-'}
                                  </td>
                                ))
                              }
                            </tr>
                          ))}
                          {/* YoY row */}
                          {[
                            { label: 'Revenue YoY', key: 'revenue_yoy' as const },
                            { label: 'Net Income YoY', key: 'net_income_yoy' as const },
                            { label: 'EPS YoY', key: 'eps_yoy' as const },
                          ].map(metric => (
                            <tr key={metric.key} className="hover:bg-slate-50 bg-slate-50/50">
                              <td className="px-4 py-2.5 font-medium text-slate-500 text-xs">{metric.label}</td>
                              {annualDbQuarters
                                .sort((a, b) => a.fiscal_quarter - b.fiscal_quarter)
                                .map(q => {
                                  const val = q[metric.key] || '-'
                                  return (
                                    <td key={q.period} className="px-4 py-2.5 text-right">
                                      <span className={`font-mono text-xs font-medium ${
                                        val.startsWith('+') ? 'text-green-600' :
                                        val.startsWith('-') ? 'text-red-500' : 'text-slate-400'
                                      }`}>{val}</span>
                                    </td>
                                  )
                                })
                              }
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 text-center">年度汇总展示该财年各季度核心指标 · 数据来源：数据API</p>
                </div>
              )}

              {/* Earnings Call Transcript */}
              {!isAnnualView && hasFinancialData && (
                <div className="mt-6">
                  {isLoadingTranscript ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
                      <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                      <span className="text-sm text-slate-500">加载电话会议记录...</span>
                    </div>
                  ) : transcript ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                      <button
                        onClick={() => setShowTranscript(!showTranscript)}
                        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors rounded-2xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                            <MessageSquareQuote className="h-4 w-4 text-violet-600" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-sm font-semibold text-slate-800">Earnings Call Transcript</h3>
                            <p className="text-xs text-slate-500">
                              {transcript.transcript_date} · {transcript.speakers.length} 位发言人 · {Math.round(transcript.content.length / 1000)}K 字符
                            </p>
                          </div>
                        </div>
                        {showTranscript
                          ? <ChevronUp className="h-5 w-5 text-slate-400" />
                          : <ChevronDown className="h-5 w-5 text-slate-400" />
                        }
                      </button>

                      {showTranscript && (
                        <div className="px-5 pb-5 border-t border-slate-100">
                          {/* Speakers list */}
                          {transcript.speakers.length > 0 && (
                            <div className="mt-4 mb-4 flex flex-wrap gap-1.5">
                              {transcript.speakers.slice(0, 15).map(speaker => (
                                <span key={speaker} className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full border border-violet-100">
                                  {speaker}
                                </span>
                              ))}
                              {transcript.speakers.length > 15 && (
                                <span className="text-xs text-slate-400">+{transcript.speakers.length - 15} more</span>
                              )}
                            </div>
                          )}

                          {/* Transcript content with speaker highlighting */}
                          <div className="max-h-[600px] overflow-y-auto pr-2 space-y-3">
                            <TranscriptContent
                              content={transcript.content}
                              date={transcript.transcript_date}
                              period={selectedPeriod || ''}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
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
                    财报数据由系统每日自动获取，该{isAnnualView ? '年度' : '季度'}暂未收录
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

// ============================================================
// DB Quarter Detail View — shows full financial data from API
// ============================================================

function formatDollarDisplay(raw: any): string {
  if (!raw && raw !== 0) return '-'
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  if (isNaN(num) || num === 0) return '-'
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  if (abs >= 1e9) {
    const val = abs / 1e9
    return `${sign}$${val.toFixed(6).replace(/\.?0+$/, '')}B`
  }
  if (abs >= 1e6) {
    const val = abs / 1e6
    return `${sign}$${val.toFixed(6).replace(/\.?0+$/, '')}M`
  }
  return `${sign}$${abs}`
}

function DbQuarterDetailView({ quarter, allQuarters, period }: { quarter: DbQuarter; allQuarters: DbQuarter[]; period: string }) {
  let parsed: any = null
  try {
    if (quarter.report_text) parsed = JSON.parse(quarter.report_text)
  } catch { /* not JSON */ }

  // Find previous year same quarter for manual YoY calculation
  let prevParsed: any = null
  const prevQ = allQuarters.find(
    q => q.fiscal_year === quarter.fiscal_year - 1 && q.fiscal_quarter === quarter.fiscal_quarter
  )
  try {
    if (prevQ?.report_text) prevParsed = JSON.parse(prevQ.report_text)
  } catch { /* not JSON */ }

  const fm = parsed?.financial_metrics
  const pfm = prevParsed?.financial_metrics
  const segments = parsed?.segment_revenue?.segments
  const regions = parsed?.geographic_revenue?.regions
  const ratios = parsed?.financial_ratios
  const growth = parsed?.growth_metrics

  const fmtPct = (v: any) => {
    if (v === null || v === undefined) return '-'
    const n = typeof v === 'string' ? parseFloat(v) : Number(v)
    if (isNaN(n)) return '-'
    return `${(n * 100).toFixed(2)}%`
  }

  const fmtGrowth = (v: any) => {
    if (v === null || v === undefined) return '-'
    const n = typeof v === 'string' ? parseFloat(v) : Number(v)
    if (isNaN(n)) return '-'
    const pct = n * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
  }

  // Compute YoY from raw values when API doesn't provide it
  const computeYoY = (curRaw: any, prevRaw: any): string => {
    if (!curRaw || !prevRaw) return '-'
    const c = typeof curRaw === 'string' ? parseFloat(curRaw) : Number(curRaw)
    const p = typeof prevRaw === 'string' ? parseFloat(prevRaw) : Number(prevRaw)
    if (isNaN(c) || isNaN(p) || p === 0) return '-'
    const pct = ((c - p) / Math.abs(p)) * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
  }

  // Get YoY: prefer API growth_metrics, fall back to manual calc from prev year
  const getYoY = (apiGrowthKey: string | null, fmKey: string): string => {
    if (apiGrowthKey && growth?.[apiGrowthKey] != null) return fmtGrowth(growth[apiGrowthKey])
    if (fm?.[fmKey] && pfm?.[fmKey]) return computeYoY(fm[fmKey], pfm[fmKey])
    return '-'
  }

  const deltaColor = (v: string) => {
    if (v.startsWith('+')) return 'text-green-600'
    if (v.startsWith('-')) return 'text-red-500'
    return 'text-slate-600'
  }

  return (
    <div className="space-y-6">
      {/* Core Metrics */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-blue-600 mb-1 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {period} 财报核心指标
        </h3>
        {quarter.filing_date && <p className="text-xs text-slate-400 mb-4">报告日期：{quarter.filing_date}</p>}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">指标</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">数值</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">同比 (YoY)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { label: 'Revenue（营收）', val: quarter.revenue, yoy: getYoY('revenue_growth', 'revenue') },
                { label: 'Cost of Revenue（营业成本）', val: fm ? formatDollarDisplay(fm.cost_of_revenue) : null, yoy: getYoY(null, 'cost_of_revenue') },
                { label: 'Gross Profit（毛利润）', val: fm ? formatDollarDisplay(fm.gross_profit) : null, yoy: getYoY('gross_profit_growth', 'gross_profit') },
                { label: 'Operating Income（营业利润）', val: fm ? formatDollarDisplay(fm.operating_income) : null, yoy: getYoY('operating_income_growth', 'operating_income') },
                { label: 'EBITDA', val: fm ? formatDollarDisplay(fm.ebitda) : null, yoy: getYoY(null, 'ebitda') },
                { label: 'Net Income（净利润）', val: quarter.net_income, yoy: getYoY('net_income_growth', 'net_income') },
                { label: 'EPS（每股收益）', val: quarter.eps, yoy: getYoY('eps_growth', 'eps') },
                { label: 'Gross Margin（毛利率）', val: quarter.gross_margin, yoy: '-' },
                { label: 'Operating Margin（营业利润率）', val: quarter.operating_margin, yoy: '-' },
                { label: 'Net Profit Margin（净利率）', val: ratios ? fmtPct(ratios.net_profit_margin) : null, yoy: '-' },
                { label: 'R&D Expense（研发费用）', val: fm ? formatDollarDisplay(fm.research_and_development) : null, yoy: getYoY('rd_expense_growth', 'research_and_development') },
                { label: 'SG&A（销售及管理费用）', val: fm ? formatDollarDisplay(fm.selling_general_admin) : null, yoy: getYoY(null, 'selling_general_admin') },
                { label: 'CapEx（资本支出）', val: fm ? formatDollarDisplay(fm.capital_expenditure) : null, yoy: getYoY(null, 'capital_expenditure') },
                { label: 'Operating Cash Flow（经营现金流）', val: fm ? formatDollarDisplay(fm.operating_cash_flow) : null, yoy: getYoY(null, 'operating_cash_flow') },
                { label: 'Free Cash Flow（自由现金流）', val: fm ? formatDollarDisplay(fm.free_cash_flow) : null, yoy: getYoY('fcf_growth', 'free_cash_flow') },
              ].filter(r => r.val && r.val !== '-').map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800 text-sm">{row.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-800">{row.val}</td>
                  <td className="px-4 py-2.5 text-right">
                    {row.yoy && row.yoy !== '-' ? (
                      <span className={`font-mono font-medium ${deltaColor(row.yoy)}`}>{row.yoy}</span>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Segment Revenue */}
      {segments && Object.keys(segments).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-indigo-600 mb-4">分部收入</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(segments).map(([name, val]) => (
              <div key={name} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="text-xs text-indigo-600 font-medium mb-1">{name}</div>
                <div className="text-sm font-semibold text-slate-800 font-mono">{formatDollarDisplay(val as string)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geographic Revenue */}
      {regions && Object.keys(regions).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-teal-600 mb-4">地区收入</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(regions).map(([name, val]) => (
              <div key={name} className="p-3 bg-teal-50/50 rounded-xl border border-teal-100">
                <div className="text-xs text-teal-600 font-medium mb-1">{name}</div>
                <div className="text-sm font-semibold text-slate-800 font-mono">{formatDollarDisplay(val as string)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance Sheet Snapshot */}
      {fm && (fm.total_assets || fm.total_equity || fm.cash_and_equivalents) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-amber-600 mb-4">资产负债概况</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: '总资产', val: fm.total_assets },
              { label: '总负债', val: fm.total_liabilities },
              { label: '股东权益', val: fm.total_equity },
              { label: '现金及等价物', val: fm.cash_and_equivalents },
              { label: '总债务', val: fm.total_debt },
            ].filter(r => r.val && parseFloat(r.val) !== 0).map(item => (
              <div key={item.label} className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                <div className="text-xs text-amber-600 font-medium mb-1">{item.label}</div>
                <div className="text-sm font-semibold text-slate-800 font-mono">{formatDollarDisplay(item.val)}</div>
              </div>
            ))}
          </div>
          {ratios && (
            <div className="mt-3 flex gap-4 text-xs text-slate-500">
              {ratios.current_ratio > 0 && <span>流动比率: {Number(ratios.current_ratio).toFixed(2)}</span>}
              {ratios.debt_to_equity > 0 && <span>负债权益比: {Number(ratios.debt_to_equity).toFixed(2)}</span>}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        数据来源：数据API · 客观数据展示，不含任何主观评价 · 上传研报可查看对比分析
      </p>
    </div>
  )
}

// ============================================================
// Transcript Content Renderer
// Parses "Speaker: text" format and renders with attribution
// ============================================================

function TranscriptContent({ content, date, period }: { content: string; date: string; period: string }) {
  // Parse transcript into speaker segments
  const segments: Array<{ speaker: string; text: string }> = []
  const lines = content.split('\n')
  let currentSpeaker = ''
  let currentText = ''

  for (const line of lines) {
    const speakerMatch = line.match(/^([A-Z][a-zA-Z\s\-'.]{1,58}):\s(.*)/)
    if (speakerMatch) {
      if (currentSpeaker && currentText.trim()) {
        segments.push({ speaker: currentSpeaker, text: currentText.trim() })
      }
      currentSpeaker = speakerMatch[1].trim()
      currentText = speakerMatch[2]
    } else {
      currentText += '\n' + line
    }
  }
  if (currentSpeaker && currentText.trim()) {
    segments.push({ speaker: currentSpeaker, text: currentText.trim() })
  }

  // Color mapping for speakers
  const speakerColors = new Map<string, string>()
  const colorPalette = [
    'bg-blue-50 border-blue-200 text-blue-800',
    'bg-violet-50 border-violet-200 text-violet-800',
    'bg-emerald-50 border-emerald-200 text-emerald-800',
    'bg-amber-50 border-amber-200 text-amber-800',
    'bg-rose-50 border-rose-200 text-rose-800',
    'bg-cyan-50 border-cyan-200 text-cyan-800',
    'bg-indigo-50 border-indigo-200 text-indigo-800',
    'bg-orange-50 border-orange-200 text-orange-800',
  ]
  let colorIdx = 0

  function getSpeakerColor(speaker: string): string {
    if (!speakerColors.has(speaker)) {
      speakerColors.set(speaker, colorPalette[colorIdx % colorPalette.length])
      colorIdx++
    }
    return speakerColors.get(speaker)!
  }

  const reference = `${period} Earnings Call, ${date}`

  return (
    <>
      <div className="text-xs text-slate-400 mb-3 pb-2 border-b border-slate-100">
        来源：{reference}
      </div>
      {segments.map((seg, idx) => {
        const colorClass = getSpeakerColor(seg.speaker)
        return (
          <div key={idx} className={`p-3 rounded-lg border ${colorClass}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{seg.speaker}</span>
              <span className="text-[10px] opacity-50">[{reference}]</span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap opacity-90">
              {seg.text.length > 800 ? seg.text.slice(0, 800) + '...' : seg.text}
            </p>
          </div>
        )
      })}
    </>
  )
}
