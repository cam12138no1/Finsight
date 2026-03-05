'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { FileText, ChevronRight, Loader2, Calendar, RefreshCw, AlertCircle, Trash2, Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReportListProps {
  onSelectAnalysis: (analysis: any) => void
  onRefresh: () => void
}

export default function ReportList({ onSelectAnalysis, onRefresh }: ReportListProps) {
  const t = useTranslations()
  const [reports, setReports] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingCount, setProcessingCount] = useState(0)
  const [isCleaning, setIsCleaning] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadReports()
    
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Auto refresh when there are processing items
  useEffect(() => {
    if (processingCount > 0) {
      pollRef.current = setInterval(loadReports, 3000)
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [processingCount])

  const loadReports = async () => {
    try {
      const response = await fetch('/api/dashboard?limit=50')
      const data = await response.json()
      
      if (data.analyses) {
        const sorted = data.analyses.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setReports(sorted)
        
        const processing = sorted.filter((r: any) => r.processing).length
        setProcessingCount(processing)
        
        if (processing === 0 && processingCount > 0) {
          onRefresh()
        }
      }
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    
    if (!confirm('确定要删除这条分析记录吗？')) {
      return
    }
    
    setDeletingId(id)
    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setReports(prev => prev.filter(r => r.id !== id))
        onRefresh()
      } else {
        const data = await response.json()
        alert(`删除失败: ${data.error}`)
      }
    } catch (error) {
      console.error('Delete failed:', error)
      alert('删除失败，请重试')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCleanStale = async () => {
    if (!confirm('确定要清理所有卡住的"正在分析"任务吗？（超过10分钟的任务）')) {
      return
    }
    
    setIsCleaning(true)
    try {
      const response = await fetch('/api/reports/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxAgeMinutes: 10 }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        alert(`已清理 ${data.deletedCount} 条无效任务`)
        loadReports()
        onRefresh()
      } else {
        alert(`清理失败: ${data.error}`)
      }
    } catch (error) {
      console.error('Clean failed:', error)
      alert('清理失败，请重试')
    } finally {
      setIsCleaning(false)
    }
  }

  const getStatusIcon = (report: any) => {
    if (report?.processed && !report?.error) {
      return <FileText className="h-4 w-4 text-green-500" />
    } else if (report?.error) {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }
    return <FileText className="h-4 w-4 text-gray-400" />
  }

  // Count stale processing reports (older than 10 minutes)
  const staleCount = reports.filter(r => {
    if (r.processing) {
      const ageMinutes = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60)
      return ageMinutes > 10
    }
    return false
  }).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.noReportsYet')}</h3>
        <p className="text-gray-500 max-w-sm mx-auto">{t('dashboard.uploadFirstReport')}</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{t('dashboard.recentReports')}</h3>
        <div className="flex items-center gap-2">
          {staleCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCleanStale}
              disabled={isCleaning}
              className="text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              {isCleaning ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Eraser className="h-4 w-4 mr-1" />
              )}
              清理无效任务 ({staleCount})
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={loadReports} className="text-gray-500">
            <RefreshCw className="h-4 w-4 mr-1" />
            {t('common.refresh')}
          </Button>
        </div>
      </div>
      
      {/* List */}
      <div className="divide-y divide-gray-100">
        {reports.map((report) => {
          const isStale = report.processing && 
            (Date.now() - new Date(report.created_at).getTime()) / (1000 * 60) > 10
          
          return (
            <div
              key={report.id}
              className={`flex items-center gap-4 px-6 py-4 transition-colors group ${
                report.processed 
                  ? 'hover:bg-gray-50 cursor-pointer' 
                  : report.processing 
                    ? isStale ? 'bg-red-50/50' : 'bg-amber-50/50'
                    : report.error 
                      ? 'bg-red-50/50' 
                      : ''
              }`}
              onClick={() => {
                if (report.processed) {
                  onSelectAnalysis(report)
                }
              }}
            >
              {/* Company Logo */}
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-soft-md flex-shrink-0 ${
                report.processing 
                  ? isStale 
                    ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/20'
                    : 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/20 animate-pulse'
                  : report.error
                    ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/20'
                    : 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-blue-500/20'
              }`}>
                {report.processing ? (
                  isStale ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )
                ) : report.error ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  report.company_symbol?.slice(0, 2) || '??'
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {report.company_name || t('reports.identifying')}
                  </h4>
                  {report.company_symbol && (
                    <span className="text-xs text-gray-400">{report.company_symbol}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    {report.fiscal_quarter ? `Q${report.fiscal_quarter}` : 'FY'} {report.fiscal_year || '---'}
                  </span>
                  {report.created_at && (
                    <span className="text-xs text-gray-400">
                      {format(new Date(report.created_at), 'yyyy-MM-dd HH:mm')}
                    </span>
                  )}
                </div>
                {report.processing ? (
                  <p className={`text-sm mt-1 flex items-center gap-1 ${isStale ? 'text-red-600' : 'text-amber-600'}`}>
                    {isStale ? (
                      <>
                        <AlertCircle className="h-3 w-3" />
                        任务已卡住，请删除后重试
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t('common.analyzing2')}
                      </>
                    )}
                  </p>
                ) : report.error ? (
                  <p className="text-sm text-red-600 mt-1">
                    {t('common.analysisFailed')}: {report.error}
                  </p>
                ) : report.one_line_conclusion ? (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                    {report.one_line_conclusion}
                  </p>
                ) : null}
              </div>
              
              {/* Status & Action */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {report.processing ? (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      isStale 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isStale ? (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          已卡住
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('common.processing')}
                        </>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(e, report.id)}
                      disabled={deletingId === report.id}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
                    >
                      {deletingId === report.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : report.error ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <AlertCircle className="h-3 w-3" />
                      {t('common.error')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(e, report.id)}
                      disabled={deletingId === report.id}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
                    >
                      {deletingId === report.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : report.processed ? (
                  <div className="flex items-center gap-2">
                    {getStatusIcon(report)}
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100/50 text-emerald-700">
                      {t('common.completed')}
                    </span>
                  </div>
                ) : null}
                {report.processed && (
                  <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-emerald-600 transition-colors" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
