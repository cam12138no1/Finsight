'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle2, AlertCircle, Trash2, BookOpen, FileBarChart, Calendar } from 'lucide-react'
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
    beat_miss_summary?: string
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

export default function CompanyDetailClient({ symbol }: { symbol: string }) {
  const router = useRouter()
  const company = getCompanyBySymbol(symbol)
  const category = getCompanyCategoryBySymbol(symbol)

  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null)
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [fullAnalysis, setFullAnalysis] = useState<Analysis | null>(null)
  const [isLoadingFull, setIsLoadingFull] = useState(false)

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [financialFiles, setFinancialFiles] = useState<FileItem[]>([])
  const [researchFiles, setResearchFiles] = useState<FileItem[]>([])
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear())
  const [uploadQuarter, setUploadQuarter] = useState(4)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')
  const isSubmittingRef = useRef(false)

  // Load all analyses for this company
  const loadData = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard')
      const data = await response.json()
      if (data.analyses) {
        const companyAnalyses = data.analyses.filter(
          (a: Analysis) => a.company_symbol?.toUpperCase() === symbol.toUpperCase()
        )
        // Sort by period, newest first
        companyAnalyses.sort((a: Analysis, b: Analysis) => {
          const yearA = a.fiscal_year || 0
          const yearB = b.fiscal_year || 0
          if (yearB !== yearA) return yearB - yearA
          return (b.fiscal_quarter || 0) - (a.fiscal_quarter || 0)
        })
        setAnalyses(companyAnalyses)

        // Auto-select first quarter if available
        if (companyAnalyses.length > 0 && !selectedQuarter) {
          const first = companyAnalyses[0]
          const qKey = `${first.fiscal_year || ''} Q${first.fiscal_quarter || ''}`
          setSelectedQuarter(qKey)
          setSelectedAnalysis(first)
        }
      }
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load data:', error)
      setIsLoading(false)
    }
  }, [symbol, selectedQuarter])

  useEffect(() => {
    loadData()
    // Poll for processing
    const interval = setInterval(() => {
      if (analyses.some(a => a.processing && !a.processed)) {
        loadData()
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [loadData, analyses])

  // Load full analysis when a quarter is selected
  useEffect(() => {
    if (!selectedAnalysis) {
      setFullAnalysis(null)
      return
    }
    setIsLoadingFull(true)
    fetch(`/api/reports/${selectedAnalysis.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.analysis) {
          setFullAnalysis(data.analysis)
        }
      })
      .catch(err => console.error('Failed to load full analysis:', err))
      .finally(() => setIsLoadingFull(false))
  }, [selectedAnalysis])

  // Get unique quarters for tabs
  const quarterTabs = analyses
    .filter(a => a.processed && !a.error)
    .map(a => ({
      key: `${a.fiscal_year || ''} Q${a.fiscal_quarter || ''}`,
      label: `${a.fiscal_year || ''} Q${a.fiscal_quarter || ''}`,
      analysis: a,
    }))
    .filter((q, i, arr) => arr.findIndex(x => x.key === q.key) === i)

  const handleQuarterSelect = (key: string, analysis: Analysis) => {
    setSelectedQuarter(key)
    setSelectedAnalysis(analysis)
    setFullAnalysis(null)
  }

  // File upload handlers
  const addFiles = (newFiles: FileList | File[], type: 'financial' | 'research') => {
    const validFiles: FileItem[] = []
    const existing = type === 'financial' ? financialFiles : researchFiles
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
      if (type === 'financial') setFinancialFiles(prev => [...prev, ...validFiles])
      else setResearchFiles(prev => [...prev, ...validFiles])
    }
  }

  const removeFile = (id: string, type: 'financial' | 'research') => {
    if (type === 'financial') setFinancialFiles(prev => prev.filter(f => f.id !== id))
    else setResearchFiles(prev => prev.filter(f => f.id !== id))
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

  const handleUploadSubmit = async () => {
    if (isSubmittingRef.current) return
    if (financialFiles.length === 0) {
      toast({ title: '请上传财报', description: '请至少上传一份财报PDF文件', variant: 'destructive' })
      return
    }

    isSubmittingRef.current = true
    setUploadStatus('uploading')
    setUploadError('')
    setUploadProgress('准备上传...')

    try {
      const uploadedFinancial: UploadedFile[] = []
      const uploadedResearch: UploadedFile[] = []

      for (let i = 0; i < financialFiles.length; i++) {
        setUploadProgress(`上传财报 ${i + 1}/${financialFiles.length}`)
        uploadedFinancial.push(await uploadFileToBlob(financialFiles[i].file, 'financial'))
      }
      for (let i = 0; i < researchFiles.length; i++) {
        setUploadProgress(`上传研报 ${i + 1}/${researchFiles.length}`)
        uploadedResearch.push(await uploadFileToBlob(researchFiles[i].file, 'research'))
      }

      setUploadStatus('analyzing')
      setUploadProgress('AI正在分析财报...')

      const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const response = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialFiles: uploadedFinancial,
          researchFiles: uploadedResearch,
          category: category || 'AI_APPLICATION',
          requestId,
          fiscalYear: uploadYear,
          fiscalQuarter: uploadQuarter,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '分析失败')
      }

      setUploadStatus('success')
      setUploadProgress('')
      toast({ title: '分析完成', description: '财报分析已完成' })

      // Reset and reload
      setTimeout(() => {
        setFinancialFiles([])
        setResearchFiles([])
        setUploadStatus('idle')
        setShowUpload(false)
        isSubmittingRef.current = false
        loadData()
      }, 1500)

    } catch (error: any) {
      setUploadStatus('error')
      setUploadError(error.message || '分析失败')
      setUploadProgress('')
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
                  {company?.nameZh || ''} · {symbol}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowUpload(!showUpload)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25"
            >
              <Upload className="mr-2 h-4 w-4" />
              上传财报
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Upload Panel */}
        {showUpload && (
          <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">上传财报分析</h3>

            {/* Status */}
            {isProcessing && (
              <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="font-medium text-blue-900">
                      {uploadStatus === 'uploading' ? '正在上传文件...' : 'AI正在分析财报...'}
                    </p>
                    <p className="text-sm text-blue-600">{uploadProgress}</p>
                  </div>
                </div>
              </div>
            )}
            {uploadStatus === 'success' && (
              <div className="mb-4 p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-900">分析完成</p>
                </div>
              </div>
            )}
            {uploadStatus === 'error' && (
              <div className="mb-4 p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="font-medium text-red-900">{uploadError}</p>
                </div>
              </div>
            )}

            {!isProcessing && uploadStatus !== 'success' && (
              <>
                {/* Year & Quarter */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-orange-500" />
                      年份
                    </label>
                    <select
                      value={uploadYear}
                      onChange={e => setUploadYear(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {[2024, 2025, 2026].map(y => (
                        <option key={y} value={y}>{y}年</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">季度</label>
                    <select
                      value={uploadQuarter}
                      onChange={e => setUploadQuarter(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {[1, 2, 3, 4].map(q => (
                        <option key={q} value={q}>Q{q}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Financial Files */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <FileBarChart className="h-4 w-4 text-blue-500" />
                    财报文件 <span className="text-red-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={e => e.target.files && addFiles(e.target.files, 'financial')}
                      className="hidden"
                      id="financial-upload"
                    />
                    <label htmlFor="financial-upload" className="cursor-pointer block text-center">
                      <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-sm text-slate-600">点击上传财报PDF</p>
                    </label>
                  </div>
                  {financialFiles.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg mt-2">
                      <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 flex-1 truncate">{item.file.name}</span>
                      <span className="text-xs text-slate-400">{(item.file.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button onClick={() => removeFile(item.id, 'financial')} className="p-1 hover:bg-blue-100 rounded">
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Research Files */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-purple-500" />
                    研报文件 <span className="text-slate-400 text-xs font-normal">（可选 - 上传后展示对比数据）</span>
                  </label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-purple-300 transition-colors">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={e => e.target.files && addFiles(e.target.files, 'research')}
                      className="hidden"
                      id="research-upload"
                    />
                    <label htmlFor="research-upload" className="cursor-pointer block text-center">
                      <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-sm text-slate-600">点击上传研报PDF（用于对比市场预期）</p>
                    </label>
                  </div>
                  {researchFiles.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg mt-2">
                      <FileText className="h-4 w-4 text-purple-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 flex-1 truncate">{item.file.name}</span>
                      <span className="text-xs text-slate-400">{(item.file.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button onClick={() => removeFile(item.id, 'research')} className="p-1 hover:bg-purple-100 rounded">
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowUpload(false)} className="flex-1">取消</Button>
                  <Button
                    onClick={handleUploadSubmit}
                    disabled={financialFiles.length === 0}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                  >
                    开始分析
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Quarter Tabs */}
        {quarterTabs.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {quarterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => handleQuarterSelect(tab.key, tab.analysis)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedQuarter === tab.key
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Processing indicators */}
        {analyses.filter(a => a.processing && !a.processed).map(a => (
          <div key={a.id} className="mb-4 bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
              <span className="text-sm text-amber-800">
                {a.period} 正在分析中...
              </span>
            </div>
          </div>
        ))}

        {/* Analysis Content */}
        {selectedAnalysis && (
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
                无法加载分析数据
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {quarterTabs.length === 0 && !showUpload && (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">暂无财报数据</h3>
            <p className="text-sm text-slate-500 mb-6">
              点击上方"上传财报"按钮添加{company?.name || symbol}的季度财报
            </p>
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Upload className="mr-2 h-4 w-4" />
              上传财报
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
