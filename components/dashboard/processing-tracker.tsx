'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Clock,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProcessingItem {
  id: string
  company_name: string
  company_symbol: string
  status: 'processing' | 'completed' | 'error'
  error?: string
  created_at: string
}

interface ProcessingStatus {
  processing: ProcessingItem[]
  completed: ProcessingItem[]
  errors: ProcessingItem[]
  processingCount: number
  totalCount: number
}

interface ProcessingTrackerProps {
  onRefresh?: () => void
}

export default function ProcessingTracker({ onRefresh }: ProcessingTrackerProps) {
  const t = useTranslations()
  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/reports/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        
        // If processing count changed to 0, trigger refresh
        if (data.processingCount === 0 && status?.processingCount && status.processingCount > 0) {
          onRefresh?.()
        }
      }
    } catch (error) {
      console.error('Failed to fetch processing status:', error)
    }
  }, [status?.processingCount, onRefresh])

  useEffect(() => {
    fetchStatus()
    
    // Poll every 3 seconds while there are processing items
    const interval = setInterval(() => {
      fetchStatus()
    }, 3000)

    return () => clearInterval(interval)
  }, [fetchStatus])

  // Don't show if no processing items and no recent activity
  if (!status || (status.processingCount === 0 && status.completed.length === 0 && status.errors.length === 0)) {
    return null
  }

  if (!isVisible) {
    return null
  }

  const hasProcessing = status.processingCount > 0
  const hasErrors = status.errors.length > 0

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <div className={`bg-white rounded-xl shadow-soft-lg border overflow-hidden transition-all ${
        hasErrors ? 'border-red-200' : hasProcessing ? 'border-emerald-200' : 'border-green-200'
      }`}>
        {/* Header */}
        <div 
          className={`px-4 py-3 cursor-pointer flex items-center justify-between ${
            hasErrors ? 'bg-red-50' : hasProcessing ? 'bg-emerald-50/50' : 'bg-emerald-50/50'
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            {hasProcessing ? (
              <div className="relative">
                <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-600 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                  {status.processingCount}
                </span>
              </div>
            ) : hasErrors ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
            <div>
              <p className={`text-sm font-semibold ${
                hasErrors ? 'text-red-900' : hasProcessing ? 'text-blue-900' : 'text-green-900'
              }`}>
                {hasProcessing 
                  ? t('processing.analyzing', { count: status.processingCount })
                  : hasErrors 
                    ? t('processing.hasErrors', { count: status.errors.length })
                    : t('processing.allComplete')
                }
              </p>
              <p className={`text-xs ${
                hasErrors ? 'text-red-600' : hasProcessing ? 'text-emerald-600' : 'text-emerald-600'
              }`}>
                {hasProcessing 
                  ? t('processing.pleaseWait')
                  : t('processing.recentActivity')
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                setIsVisible(false)
              }}
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </Button>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="max-h-64 overflow-y-auto">
            {/* Processing Items */}
            {status.processing.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  {t('processing.inProgress')}
                </p>
                <div className="space-y-2">
                  {status.processing.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-emerald-50/50 rounded-lg">
                      <Loader2 className="h-4 w-4 text-emerald-600 animate-spin flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.company_name}
                        </p>
                        <p className="text-xs text-gray-500">{item.company_symbol}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-emerald-600">
                        <Clock className="h-3 w-3" />
                        <span>{t('processing.analyzing_status')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Items */}
            {status.completed.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  {t('processing.recentlyCompleted')}
                </p>
                <div className="space-y-2">
                  {status.completed.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-emerald-50/50 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.company_name}
                        </p>
                        <p className="text-xs text-gray-500">{item.company_symbol}</p>
                      </div>
                      <span className="text-xs text-emerald-600">{t('processing.done')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Items */}
            {status.errors.length > 0 && (
              <div className="p-3">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  {t('processing.failed')}
                </p>
                <div className="space-y-2">
                  {status.errors.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.company_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-red-600 truncate">{item.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar for Processing */}
        {hasProcessing && (
          <div className="h-1 bg-blue-100">
            <div 
              className="h-full bg-emerald-600 animate-pulse"
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
