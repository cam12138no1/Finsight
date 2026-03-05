'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Upload, Loader2, FileText, CheckCircle2, AlertCircle, Trash2, Building2, Cpu, ShoppingBag, FileBarChart, BookOpen, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { upload } from '@vercel/blob/client'
import { signOut } from 'next-auth/react'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
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

type AnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'success' | 'error'

const COMPANY_CATEGORIES = {
  AI_APPLICATION: {
    name: 'AI应用公司',
    icon: Building2,
    description: 'Microsoft, Google, Meta, Salesforce 等'
  },
  AI_SUPPLY_CHAIN: {
    name: 'AI供应链公司',
    icon: Cpu,
    description: 'Nvidia, AMD, TSMC, ASML 等'
  },
  CONSUMER_GOODS: {
    name: '消费品公司',
    icon: ShoppingBag,
    description: 'Hermès, 茅台, LV, Crocs 等'
  }
}

// 年份选项：当前年份及前后各一年
const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1]

// 季度选项
const QUARTER_OPTIONS = [
  { value: 1, label: 'Q1' },
  { value: 2, label: 'Q2' },
  { value: 3, label: 'Q3' },
  { value: 4, label: 'Q4' },
]

// 文件大小限制：500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [financialFiles, setFinancialFiles] = useState<FileItem[]>([])
  const [researchFiles, setResearchFiles] = useState<FileItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<'AI_APPLICATION' | 'AI_SUPPLY_CHAIN' | 'CONSUMER_GOODS' | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedQuarter, setSelectedQuarter] = useState<number>(4) // 默认Q4
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState<string>('')
  
  // ★★★ 防重复提交的关键状态 ★★★
  const isSubmittingRef = useRef(false)
  const currentRequestIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isOpen) {
      // 关闭时取消正在进行的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      
      // 只有在没有正在提交时才重置状态
      if (!isSubmittingRef.current) {
        setFinancialFiles([])
        setResearchFiles([])
        setSelectedCategory(null)
        setSelectedYear(currentYear)
        setSelectedQuarter(4)
        setAnalysisStatus('idle')
        setErrorMessage('')
        setUploadProgress('')
        currentRequestIdRef.current = null
      }
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  if (!isOpen) return null

  const addFiles = (newFiles: FileList | File[], type: 'financial' | 'research') => {
    const validFiles: FileItem[] = []
    const existingFiles = type === 'financial' ? financialFiles : researchFiles

    Array.from(newFiles).forEach((file) => {
      // 检查文件类型
      if (file.type === 'application/pdf') {
        // 检查文件大小
        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: '文件过大',
            description: `${file.name} 超过500MB限制`,
            variant: 'destructive',
          })
          return
        }
        
        if (!existingFiles.some(f => f.file.name === file.name)) {
          validFiles.push({
            file,
            id: `${file.name}_${Date.now()}_${Math.random()}`,
          })
        }
      }
    })

    if (validFiles.length > 0) {
      if (type === 'financial') {
        setFinancialFiles(prev => [...prev, ...validFiles])
      } else {
        setResearchFiles(prev => [...prev, ...validFiles])
      }
    }
  }

  const removeFile = (id: string, type: 'financial' | 'research') => {
    if (type === 'financial') {
      setFinancialFiles(prev => prev.filter(f => f.id !== id))
    } else {
      setResearchFiles(prev => prev.filter(f => f.id !== id))
    }
  }

  /**
   * 使用 Vercel Blob 客户端直接上传文件
   * 绕过 Serverless Functions 的 4.5MB 限制
   * 支持最大 500MB 的文件
   */
  const uploadFileToBlob = async (file: File, prefix: string): Promise<UploadedFile> => {
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pathname = `uploads/${prefix}/${timestamp}_${safeName}`
    
    console.log(`[Blob上传] 开始上传: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
    
    // 重试机制
    const maxRetries = 3
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Blob上传] 尝试 ${attempt}/${maxRetries}`)
        
        const blob = await upload(pathname, file, {
          access: 'public',
          handleUploadUrl: '/api/blob/upload-token',
        })
        
        console.log(`[Blob上传] 完成: ${blob.url}`)
        
        return {
          url: blob.url,
          pathname: blob.pathname,
          originalName: file.name,
        }
      } catch (error: any) {
        lastError = error
        console.error(`[Blob上传] 尝试 ${attempt} 失败:`, error.message)
        
        // 如果是认证错误，不重试
        if (error.message?.includes('未授权') || error.message?.includes('401')) {
          throw new Error('登录已过期，请刷新页面重新登录')
        }
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          const delay = attempt * 1000 // 1s, 2s, 3s
          console.log(`[Blob上传] ${delay}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    // 所有重试都失败
    throw new Error(lastError?.message || '文件上传失败，请稍后重试')
  }

  // ★★★ 验证Session是否有效 ★★★
  const validateSession = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/session')
      if (!response.ok) {
        return false
      }
      const data = await response.json()
      
      // 检查Session是否存在且有用户信息
      if (!data || !data.user || !data.user.id) {
        return false
      }
      
      // 检查是否过期
      if (data.expires) {
        const expiresAt = new Date(data.expires).getTime()
        if (expiresAt < Date.now()) {
          return false
        }
      }
      
      return true
    } catch (error) {
      console.error('[前端] Session验证失败:', error)
      return false
    }
  }

  // ★★★ 处理Session过期 ★★★
  const handleSessionExpired = () => {
    toast({
      title: '登录已过期',
      description: '您的登录状态已过期，请重新登录后再上传',
      variant: 'destructive',
    })
    
    // 重置状态
    setAnalysisStatus('idle')
    setErrorMessage('')
    setUploadProgress('')
    isSubmittingRef.current = false
    
    // 延迟后跳转到登录页
    setTimeout(() => {
      signOut({ callbackUrl: '/auth/signin?expired=true' })
    }, 2000)
  }

  const handleSubmit = async () => {
    // ★★★ 严格的防重复提交检查 ★★★
    if (isSubmittingRef.current) {
      console.log('[前端] ⚠️ 阻止重复提交：isSubmittingRef.current = true')
      return
    }

    // ★★★ 在开始上传前验证Session ★★★
    console.log('[前端] 验证Session状态...')
    const isSessionValid = await validateSession()
    if (!isSessionValid) {
      console.error('[前端] Session无效或已过期')
      handleSessionExpired()
      return
    }
    console.log('[前端] Session验证通过')

    if (financialFiles.length === 0) {
      toast({
        title: '请上传财报',
        description: '请至少上传一份财报PDF文件',
        variant: 'destructive',
      })
      return
    }

    if (!selectedCategory) {
      toast({
        title: '请选择分类',
        description: '请选择公司分类（AI应用/AI供应链）',
        variant: 'destructive',
      })
      return
    }

    // ★★★ 设置提交锁 ★★★
    isSubmittingRef.current = true
    
    // 生成唯一的请求ID（不带前缀，后端会加）
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    currentRequestIdRef.current = requestId
    
    console.log('[前端] ========================================')
    console.log('[前端] 开始提交，requestId:', requestId)
    
    abortControllerRef.current = new AbortController()

    setAnalysisStatus('uploading')
    setErrorMessage('')
    setUploadProgress('准备上传文件...')

    try {
      // ★★★ 第一步：使用 Vercel Blob 客户端直接上传文件 ★★★
      const uploadedFinancialFiles: UploadedFile[] = []
      const uploadedResearchFiles: UploadedFile[] = []
      
      // 上传财报文件
      for (let i = 0; i < financialFiles.length; i++) {
        const item = financialFiles[i]
        setUploadProgress(`上传财报 ${i + 1}/${financialFiles.length}: ${item.file.name}`)
        const uploaded = await uploadFileToBlob(item.file, 'financial')
        uploadedFinancialFiles.push(uploaded)
      }
      
      // 上传研报文件
      for (let i = 0; i < researchFiles.length; i++) {
        const item = researchFiles[i]
        setUploadProgress(`上传研报 ${i + 1}/${researchFiles.length}: ${item.file.name}`)
        const uploaded = await uploadFileToBlob(item.file, 'research')
        uploadedResearchFiles.push(uploaded)
      }
      
      console.log('[前端] 文件上传完成，开始分析')
      setUploadProgress('')
      setAnalysisStatus('analyzing')

      // ★★★ 第二步：调用分析API，传递Blob URL而不是文件 ★★★
      console.log('[前端] 发送请求到 /api/reports/analyze')
      
      // ★★★ 新增：超时处理和状态轮询机制 ★★★
      const FETCH_TIMEOUT = 120000 // 2分钟超时
      const POLL_INTERVAL = 3000 // 3秒轮询一次
      const MAX_POLL_TIME = 300000 // 最多轮询5分钟
      
      let analysisId: string | null = null
      let fetchSucceeded = false
      
      try {
        // 创建超时控制器
        const timeoutController = new AbortController()
        const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT)
        
        // 合并abort信号
        const combinedSignal = abortControllerRef.current.signal
        combinedSignal.addEventListener('abort', () => timeoutController.abort())
        
        const response = await fetch('/api/reports/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            financialFiles: uploadedFinancialFiles,
            researchFiles: uploadedResearchFiles,
            category: selectedCategory,
            requestId: requestId,
            fiscalYear: selectedYear,
            fiscalQuarter: selectedQuarter,
          }),
          signal: timeoutController.signal,
        })
        
        clearTimeout(timeoutId)
        
        // 检查是否是当前请求
        if (currentRequestIdRef.current !== requestId) {
          console.log('[前端] ⚠️ 请求ID不匹配，忽略响应')
          return
        }
        
        console.log('[前端] 收到响应，状态:', response.status)
        
        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || '分析失败')
        }
        
        const result = await response.json()
        analysisId = result.analysis_id
        fetchSucceeded = true
        console.log('[前端] ✓ 分析成功，analysis_id:', analysisId)
        
      } catch (fetchError: any) {
        // 如果是超时或网络错误，尝试轮询状态
        const isNetworkError = 
          fetchError.name === 'AbortError' ||
          fetchError.name === 'TypeError' ||
          fetchError.message?.includes('fetch') ||
          fetchError.message?.includes('network') ||
          fetchError.message?.includes('Network') ||
          fetchError.message?.includes('ERR_') ||
          fetchError.message?.includes('timeout') ||
          fetchError.message?.includes('Load failed')
        
        if (isNetworkError) {
          console.log('[前端] 请求超时或网络错误，开始轮询状态...')
          setUploadProgress('正在检查分析状态...')
          
          // 轮询检查后台是否已完成
          const pollStartTime = Date.now()
          let pollSuccess = false
          
          while (Date.now() - pollStartTime < MAX_POLL_TIME) {
            if (currentRequestIdRef.current !== requestId) {
              console.log('[前端] 轮询时请求ID变化，停止轮询')
              return
            }
            
            try {
              // 查询最新的dashboard数据
              const statusResponse = await fetch('/api/dashboard')
              if (statusResponse.ok) {
                const statusData = await statusResponse.json()
                
                // 查找匹配的分析记录（通过requestId匹配）
                const matchingAnalysis = statusData.analyses?.find(
                  (a: any) => a.request_id === requestId || a.id === `req_${requestId}`
                )
                
                if (matchingAnalysis) {
                  console.log('[前端] 找到匹配的分析记录:', matchingAnalysis.id)
                  
                  if (matchingAnalysis.processed && !matchingAnalysis.error) {
                    // 分析已完成
                    console.log('[前端] ✓ 后台分析已完成')
                    analysisId = matchingAnalysis.id
                    fetchSucceeded = true
                    pollSuccess = true
                    break
                  } else if (matchingAnalysis.error) {
                    // 分析失败
                    throw new Error(matchingAnalysis.error)
                  } else if (matchingAnalysis.processing) {
                    // 仍在处理中
                    const elapsed = Math.round((Date.now() - pollStartTime) / 1000)
                    setUploadProgress(`AI正在分析中... (已耗时 ${elapsed} 秒)`)
                  }
                }
              }
            } catch (pollError) {
              console.error('[前端] 轮询出错:', pollError)
            }
            
            // 等待后继续轮询
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
          }
          
          if (!pollSuccess) {
            throw new Error('分析超时，请稍后刷新页面查看结果')
          }
        } else {
          // 其他错误直接抛出
          throw fetchError
        }
      }
      
      // 成功处理
      if (fetchSucceeded) {
        setAnalysisStatus('success')
        setUploadProgress('')
        
        toast({
          title: '分析完成',
          description: '财报分析已完成',
        })
        
        onSuccess()
        
        // 1.5秒后关闭并重置
        setTimeout(() => {
          if (currentRequestIdRef.current === requestId) {
            setFinancialFiles([])
            setResearchFiles([])
            setSelectedCategory(null)
            setSelectedYear(currentYear)
            setSelectedQuarter(4)
            setAnalysisStatus('idle')
            setUploadProgress('')
            isSubmittingRef.current = false
            currentRequestIdRef.current = null
            onClose()
          }
        }, 1500)
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[前端] 请求被取消')
        return
      }
      
      if (currentRequestIdRef.current !== requestId) {
        console.log('[前端] ⚠️ 请求ID不匹配，忽略错误')
        return
      }
      
      console.error('[前端] ✗ 提交失败:', error.message)
      
      // ★★★ 检查是否是Session过期错误 ★★★
      const isSessionError = 
        error.message?.includes('登录已过期') ||
        error.message?.includes('未登录') ||
        error.message?.includes('会话无效') ||
        error.message?.includes('会话已过期') ||
        error.message?.includes('请重新登录') ||
        error.message?.includes('Unauthorized') ||
        error.message?.includes('未授权')
      
      if (isSessionError) {
        handleSessionExpired()
        return
      }
      
      setAnalysisStatus('error')
      setErrorMessage(error.message || '分析失败')
      setUploadProgress('')
      
      toast({
        title: '分析失败',
        description: error.message || '分析失败',
        variant: 'destructive',
      })
      
      // 失败后释放提交锁，允许重试
      isSubmittingRef.current = false
    } finally {
      abortControllerRef.current = null
      console.log('[前端] ========================================')
    }
  }

  const isProcessing = analysisStatus === 'uploading' || analysisStatus === 'analyzing'

  // 计算总文件大小
  const totalSize = [...financialFiles, ...researchFiles].reduce((sum, f) => sum + f.file.size, 0)
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(1)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={() => !isProcessing && onClose()}
      />
      
      {/* Modal */}
      <div className="absolute inset-x-4 top-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white rounded-xl shadow-soft-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8E8E3] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1F2937]">上传财报分析</h2>
            <p className="text-sm text-[#6B7280]">上传季度财报和研报进行AI深度分析</p>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-[#F5F5F0] flex items-center justify-center"
            >
              <X className="h-5 w-5 text-[#9CA3AF]" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status Display */}
          {isProcessing && (
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                </div>
                <div>
                  <p className="font-medium text-blue-900">
                    {analysisStatus === 'uploading' ? '正在上传文件...' : 'AI正在分析财报...'}
                  </p>
                  <p className="text-sm text-emerald-600">
                    {uploadProgress || '请稍候，这可能需要1-2分钟'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {analysisStatus === 'success' && (
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-green-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100/50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-green-900">分析完成</p>
                  <p className="text-sm text-emerald-600">财报分析已生成，正在关闭...</p>
                </div>
              </div>
            </div>
          )}

          {analysisStatus === 'error' && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-red-900">分析失败</p>
                  <p className="text-sm text-red-600">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Company Category Selection */}
          {!isProcessing && analysisStatus !== 'success' && (
            <>
              {/* Year and Quarter Selection */}
              <div>
                <label className="block text-sm font-medium text-[#4B5563] mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  报告期间
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Year Selection */}
                  <div>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-[#E8E8E3] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {YEAR_OPTIONS.map(year => (
                        <option key={year} value={year}>{year}年</option>
                      ))}
                    </select>
                  </div>
                  {/* Quarter Selection */}
                  <div>
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-[#E8E8E3] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {QUARTER_OPTIONS.map(q => (
                        <option key={q.value} value={q.value}>{q.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4B5563] mb-3">公司分类</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(COMPANY_CATEGORIES).map(([key, value]) => {
                    const Icon = value.icon
                    const isSelected = selectedCategory === key
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedCategory(key as 'AI_APPLICATION' | 'AI_SUPPLY_CHAIN' | 'CONSUMER_GOODS')}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          isSelected 
                            ? 'border-emerald-500 bg-emerald-50/50' 
                            : 'border-[#E8E8E3] hover:border-[#E8E8E3]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-emerald-600' : 'text-[#9CA3AF]'}`} />
                          <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-[#4B5563]'}`}>
                            {value.name}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280]">{value.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Financial Report Upload */}
              <div>
                <label className="block text-sm font-medium text-[#4B5563] mb-2 flex items-center gap-2">
                  <FileBarChart className="h-4 w-4 text-emerald-600" />
                  财报文件 <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-[#6B7280] mb-3">季度财报 (10-Q) 或年度财报 (10-K)，支持最大500MB</p>
                
                <div className="border-2 border-dashed border-[#E8E8E3] rounded-xl p-4 hover:border-emerald-300 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => e.target.files && addFiles(e.target.files, 'financial')}
                    className="hidden"
                    id="financial-upload"
                  />
                  <label htmlFor="financial-upload" className="cursor-pointer block text-center">
                    <Upload className="h-8 w-8 text-[#9CA3AF] mx-auto mb-2" />
                    <p className="text-sm text-[#6B7280]">点击上传财报PDF</p>
                  </label>
                </div>

                {financialFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {financialFiles.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 bg-emerald-50/50 rounded-lg">
                        <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <span className="text-sm text-[#4B5563] flex-1 truncate">{item.file.name}</span>
                        <span className="text-xs text-[#9CA3AF]">{(item.file.size / 1024 / 1024).toFixed(1)}MB</span>
                        <button
                          onClick={() => removeFile(item.id, 'financial')}
                          className="p-1 hover:bg-blue-100 rounded"
                        >
                          <Trash2 className="h-4 w-4 text-[#9CA3AF]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Research Report Upload */}
              <div>
                <label className="block text-sm font-medium text-[#4B5563] mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-purple-500" />
                  研报文件 <span className="text-[#9CA3AF] text-xs font-normal">（可选）</span>
                </label>
                <p className="text-xs text-[#6B7280] mb-3">卖方研报，用于对比市场预期</p>
                
                <div className="border-2 border-dashed border-[#E8E8E3] rounded-xl p-4 hover:border-purple-300 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => e.target.files && addFiles(e.target.files, 'research')}
                    className="hidden"
                    id="research-upload"
                  />
                  <label htmlFor="research-upload" className="cursor-pointer block text-center">
                    <Upload className="h-8 w-8 text-[#9CA3AF] mx-auto mb-2" />
                    <p className="text-sm text-[#6B7280]">点击上传研报PDF</p>
                  </label>
                </div>

                {researchFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {researchFiles.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                        <FileText className="h-4 w-4 text-purple-500 flex-shrink-0" />
                        <span className="text-sm text-[#4B5563] flex-1 truncate">{item.file.name}</span>
                        <span className="text-xs text-[#9CA3AF]">{(item.file.size / 1024 / 1024).toFixed(1)}MB</span>
                        <button
                          onClick={() => removeFile(item.id, 'research')}
                          className="p-1 hover:bg-purple-100 rounded"
                        >
                          <Trash2 className="h-4 w-4 text-[#9CA3AF]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total file size indicator */}
              {(financialFiles.length > 0 || researchFiles.length > 0) && (
                <div className="text-xs text-[#6B7280] text-right">
                  总计: {financialFiles.length + researchFiles.length} 个文件, {totalSizeMB}MB
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isProcessing && analysisStatus !== 'success' && (
          <div className="px-6 py-4 border-t border-[#E8E8E3] bg-[#F9F9F6]">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={financialFiles.length === 0 || !selectedCategory}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                开始分析
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
