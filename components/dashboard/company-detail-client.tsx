'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  Trash2, BookOpen, FileBarChart, Calendar
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
  model_impact?: {
    upgrade_factors: string[]
    downgrade_factors: string[]
    logic_chain: string
  }
  research_comparison?: {
    consensus_source?: string
    key_differences?: string[]
    analyst_blind_spots?: string
  }
  has_research_report?: boolean
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

// Generate the past 3 years of quarters for the sidebar, newest first
function generatePast3YearsQuarters(): { year: number; quarter: number; label: string; type: 'quarterly' }[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  // Estimate current quarter
  const currentQuarter = Math.ceil(currentMonth / 3)

  const quarters: { year: number; quarter: number; label: string; type: 'quarterly' }[] = []
  let y = currentYear
  let q = currentQuarter

  // Go back ~12 quarters (3 years)
  for (let i = 0; i < 12; i++) {
    quarters.push({
      year: y,
      quarter: q,
      label: `${y} Q${q}`,
      type: 'quarterly',
    })
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
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [fullAnalysis, setFullAnalysis] = useState<Analysis | null>(null)
  const [isLoadingFull, setIsLoadingFull] = useState(false)

  // Research report upload state (for the currently selected quarter)
  const [showResearchUpload, setShowResearchUpload] = useState(false)
  const [researchFiles, setResearchFiles] = useState<FileItem[]>([])
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')
  const isSubmittingRef = useRef(false)

  // Financial report upload state (for quarters without data)
  const [showFinancialUpload, setShowFinancialUpload] = useState(false)
  const [financialFiles, setFinancialFiles] = useState<FileItem[]>([])
  const [financialUploadYear, setFinancialUploadYear] = useState(new Date().getFullYear())
  const [financialUploadQuarter, setFinancialUploadQuarter] = useState(4)

  // All possible periods: past 3 years of quarters
  const allPeriods = generatePast3YearsQuarters()

  // DB-fetched quarters (from cron job)
  const [dbQuarters, setDbQuarters] = useState<Array<{
    fiscal_year: number
    fiscal_quarter: number
    period: string
    has_analysis: boolean
    analysis_result: any
  }>>([])

  // Load all analyses for this company (both user-uploaded and DB-fetched)
  const loadData = useCallback(async () => {
    try {
      const [dashboardRes, companyDataRes] = await Promise.allSettled([
        fetch('/api/dashboard'),
        fetch(`/api/company-data?symbol=${encodeURIComponent(symbol)}`),
      ])

      // User-uploaded analyses
      if (dashboardRes.status === 'fulfilled') {
        const data = await dashboardRes.value.json()
        if (data.analyses) {
          const companyAnalyses = data.analyses.filter(
            (a: Analysis) => a.company_symbol?.toUpperCase() === symbol.toUpperCase()
          )
          companyAnalyses.sort((a: Analysis, b: Analysis) => {
            const yearA = a.fiscal_year || 0
            const yearB = b.fiscal_year || 0
            if (yearB !== yearA) return yearB - yearA
            return (b.fiscal_quarter || 0) - (a.fiscal_quarter || 0)
          })
          setAnalyses(companyAnalyses)

          if (companyAnalyses.length > 0 && !selectedPeriod) {
            const first = companyAnalyses[0]
            const key = `${first.fiscal_year} Q${first.fiscal_quarter}`
            setSelectedPeriod(key)
            setSelectedAnalysis(first)
          }
        }
      }

      // DB-fetched data from cron
      if (companyDataRes.status === 'fulfilled') {
        const data = await companyDataRes.value.json()
        if (data.financials && data.financials.length > 0) {
          const quarters = data.financials.map((f: any) => ({
            fiscal_year: f.fiscal_year,
            fiscal_quarter: f.fiscal_quarter,
            period: f.period,
            has_analysis: !!f.analysis_result,
            analysis_result: f.analysis_result,
          }))
          setDbQuarters(quarters)

          // If no user analyses but DB has data, auto-select first
          if (dashboardRes.status === 'fulfilled') {
            const dashData = await dashboardRes.value.json().catch(() => ({ analyses: [] }))
            const userHasData = (dashData.analyses || []).some(
              (a: Analysis) => a.company_symbol?.toUpperCase() === symbol.toUpperCase() && a.processed
            )
            if (!userHasData && quarters.length > 0 && !selectedPeriod) {
              setSelectedPeriod(quarters[0].period)
            }
          }
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
      if (analyses.some(a => a.processing && !a.processed)) {
        loadData()
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [loadData, analyses])

  // Load full analysis when selection changes
  useEffect(() => {
    if (!selectedAnalysis) {
      setFullAnalysis(null)
      return
    }
    setIsLoadingFull(true)
    fetch(`/api/reports/${selectedAnalysis.id}`)
      .then(res => res.json())
      .then(data => {
        // API returns { report: ... }
        const analysisData = data.report || data.analysis
        if (analysisData) {
          setFullAnalysis(analysisData)
        }
      })
      .catch(err => console.error('Failed to load full analysis:', err))
      .finally(() => setIsLoadingFull(false))
  }, [selectedAnalysis])

  // Map of existing analyses by period key (user-uploaded + DB)
  const analysisByPeriod = new Map<string, Analysis>()
  for (const a of analyses) {
    if (a.processed && !a.error && a.fiscal_year && a.fiscal_quarter) {
      const key = `${a.fiscal_year} Q${a.fiscal_quarter}`
      if (!analysisByPeriod.has(key)) {
        analysisByPeriod.set(key, a)
      }
    }
  }

  // Also mark DB quarters that have analysis results as having data
  const dbDataPeriods = new Set<string>()
  for (const dq of dbQuarters) {
    const key = `${dq.fiscal_year} Q${dq.fiscal_quarter}`
    dbDataPeriods.add(key)
  }

  const handlePeriodSelect = (periodLabel: string) => {
    setSelectedPeriod(periodLabel)
    const existing = analysisByPeriod.get(periodLabel)
    setSelectedAnalysis(existing || null)
    setFullAnalysis(null)
    setShowResearchUpload(false)
    setShowFinancialUpload(false)
  }

  // File handlers
  const addFiles = (newFiles: FileList | File[], type: 'research' | 'financial') => {
    const validFiles: FileItem[] = []
    const existing = type === 'research' ? researchFiles : financialFiles
    Array.from(newFiles).forEach(file => {
      if (file.type !== 'application/pdf') return
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: '文件过大', description: `${file.name} 超过500MB限制`, variant: 'destructive' })
        return
      }
      if (!existing.some(f => f.file.name === file.name)) {
        validFiles.push({ file, id: `${file.name}_${Date.now()}_${Math.random()}` })
      }
    })
    if (validFiles.length > 0) {
      if (type === 'research') setResearchFiles(prev => [...prev, ...validFiles])
      else setFinancialFiles(prev => [...prev, ...validFiles])
    }
  }

  const removeFile = (id: string, type: 'research' | 'financial') => {
    if (type === 'research') setResearchFiles(prev => prev.filter(f => f.id !== id))
    else setFinancialFiles(prev => prev.filter(f => f.id !== id))
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

  // Upload financial report for a quarter that has no data yet
  const handleFinancialUpload = async () => {
    if (isSubmittingRef.current || financialFiles.length === 0) return

    isSubmittingRef.current = true
    setUploadStatus('uploading')
    setUploadError('')
    setUploadProgress('准备上传...')

    try {
      const uploadedFinancial: UploadedFile[] = []
      for (let i = 0; i < financialFiles.length; i++) {
        setUploadProgress(`上传财报 ${i + 1}/${financialFiles.length}`)
        uploadedFinancial.push(await uploadFileToBlob(financialFiles[i].file, 'financial'))
      }

      setUploadStatus('analyzing')
      setUploadProgress('AI正在提取财报数据...')

      const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const response = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialFiles: uploadedFinancial,
          researchFiles: [],
          category: category || 'AI_APPLICATION',
          requestId,
          fiscalYear: financialUploadYear,
          fiscalQuarter: financialUploadQuarter,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '分析失败')
      }

      setUploadStatus('success')
      toast({ title: '分析完成', description: '财报数据提取已完成' })

      setTimeout(() => {
        setFinancialFiles([])
        setUploadStatus('idle')
        setShowFinancialUpload(false)
        isSubmittingRef.current = false
        loadData()
      }, 1500)
    } catch (error: any) {
      setUploadStatus('error')
      setUploadError(error.message || '分析失败')
      toast({ title: '分析失败', description: error.message, variant: 'destructive' })
      isSubmittingRef.current = false
    }
  }

  // Upload research report for a quarter that already has financial data
  const handleResearchUpload = async () => {
    if (isSubmittingRef.current || researchFiles.length === 0 || !selectedAnalysis) return

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
      setUploadProgress('AI正在对比分析...')

      // Re-analyze with research report
      const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const year = selectedAnalysis.fiscal_year || new Date().getFullYear()
      const quarter = selectedAnalysis.fiscal_quarter || 4

      // We need the original financial files too - fetch from existing analysis
      // For now, we pass empty financial (the backend will handle re-analysis)
      const response = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialFiles: [], // Will use existing data
          researchFiles: uploadedResearch,
          category: category || 'AI_APPLICATION',
          requestId,
          fiscalYear: year,
          fiscalQuarter: quarter,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '对比分析失败')
      }

      setUploadStatus('success')
      toast({ title: '对比分析完成', description: '研报对比分析已生成' })

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
  const hasDataForSelected = selectedPeriod
    ? (analysisByPeriod.has(selectedPeriod) || dbDataPeriods.has(selectedPeriod))
    : false

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
          <div className="flex items-center justify-between">
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
                <h1 className="text-xl font-bold text-slate-900">
                  {company?.name || symbol}
                </h1>
                <p className="text-sm text-slate-500">
                  {company?.nameZh || ''} · {symbol} · 过去3年季度财报
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Left sidebar: Quarter tabs (past 3 years) */}
        <div className="w-44 flex-shrink-0">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">季度选择</h3>
          <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {allPeriods.map(p => {
              const key = p.label
              const hasData = analysisByPeriod.has(key) || dbDataPeriods.has(key)
              const isSelected = selectedPeriod === key
              const isProcessingPeriod = analyses.some(
                a => a.processing && !a.processed &&
                a.fiscal_year === p.year && a.fiscal_quarter === p.quarter
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
                  {isProcessingPeriod && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {hasData && !isSelected && (
                    <span className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Selected period content */}
          {selectedPeriod && (
            <>
              {/* Period Header + Actions */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">{selectedPeriod} 财报数据</h2>
                <div className="flex gap-2">
                  {hasDataForSelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowResearchUpload(!showResearchUpload); setShowFinancialUpload(false) }}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      <BookOpen className="mr-1.5 h-4 w-4" />
                      上传研报对比
                    </Button>
                  )}
                  {!hasDataForSelected && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setShowFinancialUpload(!showFinancialUpload)
                        setShowResearchUpload(false)
                        // Pre-fill year/quarter from selected period
                        const match = selectedPeriod.match(/(\d{4}) Q(\d)/)
                        if (match) {
                          setFinancialUploadYear(parseInt(match[1]))
                          setFinancialUploadQuarter(parseInt(match[2]))
                        }
                      }}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      <Upload className="mr-1.5 h-4 w-4" />
                      上传财报
                    </Button>
                  )}
                </div>
              </div>

              {/* Upload Panels */}
              {showFinancialUpload && !hasDataForSelected && (
                <UploadPanel
                  type="financial"
                  files={financialFiles}
                  isProcessing={isProcessing}
                  uploadStatus={uploadStatus}
                  uploadProgress={uploadProgress}
                  uploadError={uploadError}
                  year={financialUploadYear}
                  quarter={financialUploadQuarter}
                  onYearChange={setFinancialUploadYear}
                  onQuarterChange={setFinancialUploadQuarter}
                  onAddFiles={(files) => addFiles(files, 'financial')}
                  onRemoveFile={(id) => removeFile(id, 'financial')}
                  onSubmit={handleFinancialUpload}
                  onCancel={() => { setShowFinancialUpload(false); setFinancialFiles([]) }}
                />
              )}

              {showResearchUpload && hasDataForSelected && (
                <UploadPanel
                  type="research"
                  files={researchFiles}
                  isProcessing={isProcessing}
                  uploadStatus={uploadStatus}
                  uploadProgress={uploadProgress}
                  uploadError={uploadError}
                  onAddFiles={(files) => addFiles(files, 'research')}
                  onRemoveFile={(id) => removeFile(id, 'research')}
                  onSubmit={handleResearchUpload}
                  onCancel={() => { setShowResearchUpload(false); setResearchFiles([]) }}
                />
              )}

              {/* Analysis Content */}
              {hasDataForSelected && selectedAnalysis && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  {isLoadingFull ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    </div>
                  ) : fullAnalysis ? (
                    <AnalysisView
                      analysis={fullAnalysis}
                      hasResearchReport={!!fullAnalysis.has_research_report || !!fullAnalysis.research_comparison}
                    />
                  ) : (
                    <div className="p-8 text-center text-slate-500">
                      加载中...
                    </div>
                  )}
                </div>
              )}

              {/* No data for this quarter */}
              {!hasDataForSelected && !showFinancialUpload && (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-7 w-7 text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-700 mb-2">
                    {selectedPeriod} 暂无财报数据
                  </h3>
                  <p className="text-sm text-slate-500 mb-5">
                    上传该季度的财报PDF以提取核心财务数据
                  </p>
                  <Button
                    onClick={() => {
                      setShowFinancialUpload(true)
                      const match = selectedPeriod.match(/(\d{4}) Q(\d)/)
                      if (match) {
                        setFinancialUploadYear(parseInt(match[1]))
                        setFinancialUploadQuarter(parseInt(match[2]))
                      }
                    }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    上传财报
                  </Button>
                </div>
              )}
            </>
          )}

          {/* No period selected */}
          {!selectedPeriod && (
            <div className="text-center py-20">
              <p className="text-slate-500">请从左侧选择一个季度查看财报数据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Reusable upload panel for both financial and research uploads
function UploadPanel({
  type,
  files,
  isProcessing,
  uploadStatus,
  uploadProgress,
  uploadError,
  year,
  quarter,
  onYearChange,
  onQuarterChange,
  onAddFiles,
  onRemoveFile,
  onSubmit,
  onCancel,
}: {
  type: 'financial' | 'research'
  files: FileItem[]
  isProcessing: boolean
  uploadStatus: string
  uploadProgress: string
  uploadError: string
  year?: number
  quarter?: number
  onYearChange?: (y: number) => void
  onQuarterChange?: (q: number) => void
  onAddFiles: (files: FileList) => void
  onRemoveFile: (id: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const isFinancial = type === 'financial'
  const colorClass = isFinancial ? 'blue' : 'purple'
  const inputId = `${type}-upload-panel`

  return (
    <div className={`mb-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm`}>
      <h3 className="text-base font-semibold text-slate-900 mb-4">
        {isFinancial ? '上传财报' : '上传研报（与财报对比分析）'}
      </h3>

      {/* Status */}
      {isProcessing && (
        <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900 text-sm">
                {uploadStatus === 'uploading' ? '正在上传...' : isFinancial ? 'AI正在提取财报数据...' : 'AI正在对比分析...'}
              </p>
              <p className="text-xs text-blue-600">{uploadProgress}</p>
            </div>
          </div>
        </div>
      )}
      {uploadStatus === 'success' && (
        <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="font-medium text-green-900 text-sm">完成</p>
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
          {/* Year/Quarter selector (only for financial uploads) */}
          {isFinancial && year && quarter && onYearChange && onQuarterChange && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">年份</label>
                <select
                  value={year}
                  onChange={e => onYearChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {[2023, 2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">季度</label>
                <select
                  value={quarter}
                  onChange={e => onQuarterChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {[1, 2, 3, 4].map(q => (
                    <option key={q} value={q}>Q{q}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* File upload area */}
          <div className={`border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-${colorClass}-300 transition-colors mb-3`}>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={e => e.target.files && onAddFiles(e.target.files)}
              className="hidden"
              id={inputId}
            />
            <label htmlFor={inputId} className="cursor-pointer block text-center">
              <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1" />
              <p className="text-sm text-slate-600">
                {isFinancial ? '点击上传财报PDF' : '点击上传研报PDF（用于对比市场预期）'}
              </p>
            </label>
          </div>

          {/* File list */}
          {files.map(item => (
            <div key={item.id} className={`flex items-center gap-2 p-2 bg-${colorClass}-50 rounded-lg mb-1.5`}>
              <FileText className={`h-4 w-4 text-${colorClass}-500 flex-shrink-0`} />
              <span className="text-sm text-slate-700 flex-1 truncate">{item.file.name}</span>
              <span className="text-xs text-slate-400">{(item.file.size / 1024 / 1024).toFixed(1)}MB</span>
              <button onClick={() => onRemoveFile(item.id)} className="p-1 hover:bg-slate-100 rounded">
                <Trash2 className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">取消</Button>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={files.length === 0}
              className={`flex-1 ${isFinancial
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600'
              }`}
            >
              {isFinancial ? '开始提取' : '开始对比分析'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
