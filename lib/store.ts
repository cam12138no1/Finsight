// lib/store.ts - 用户隔离的数据存储
// Hybrid storage: Uses Vercel Blob when available, falls back to in-memory for development

import { put, list, del } from '@vercel/blob'
import { AnalysisResult, ResultsTableRow, DriverDetail } from './ai/analyzer'

export interface StoredAnalysis {
  id: string
  user_id: string  // ★ 新增：用户ID，用于数据隔离
  company_name: string
  company_symbol: string
  report_type: string
  fiscal_year: number
  fiscal_quarter?: number
  period?: string  // 格式化的期间，如 "Q4 2025"
  category?: string  // 公司分类: AI_APPLICATION | AI_SUPPLY_CHAIN
  request_id?: string  // 用于去重的请求ID
  filing_date: string
  created_at: string
  processed: boolean
  processing?: boolean
  error?: string
  has_research_report?: boolean
  
  // Complete analysis results (objective data extraction)
  one_line_conclusion?: string
  results_summary?: string
  results_table?: ResultsTableRow[]
  results_explanation?: string
  drivers_summary?: string
  drivers?: {
    demand: DriverDetail
    monetization: DriverDetail
    efficiency: DriverDetail
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
  comparison_snapshot?: {
    core_revenue: string
    core_profit: string
    guidance: string
    core_driver_quantified: string
    main_risk_quantified: string
    // Legacy fields (kept for backward compat with old data)
    beat_miss?: string
    recommendation?: string
    position_action?: string
    next_quarter_focus?: string
  }
  research_comparison?: {
    consensus_source: string
    key_differences: string[]
    analyst_blind_spots: string
    // Legacy (kept for backward compat)
    beat_miss_summary?: string
  }
  // Legacy fields (kept for backward compat with old data)
  model_impact?: {
    upgrade_factors: string[]
    downgrade_factors: string[]
    logic_chain: string
  }
  final_judgment?: {
    confidence: string
    concerns: string
    watch_list: string
    net_impact: string
    long_term_narrative: string
    recommendation: string
  }
  investment_committee_summary?: string
  metadata?: {
    company_category: string
    analysis_timestamp: string
    prompt_version: string
    has_research_report?: boolean
  }
}

const BLOB_PREFIX = 'analyses/'

function isBlobAvailable(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

/**
 * ★★★ 用户隔离的数据存储 ★★★
 * 
 * 数据路径格式：analyses/user_{userId}/req_{requestId}.json
 * 每个用户只能访问自己的数据
 */
class AnalysisStore {
  private memoryStore: Map<string, StoredAnalysis> = new Map()
  private useBlob: boolean

  constructor() {
    this.useBlob = isBlobAvailable()
    console.log(`[Store] Initialized. Using Blob: ${this.useBlob}`)
  }

  // ★ 生成用户隔离的路径
  private getUserPath(userId: string, requestId: string): string {
    if (!userId) throw new Error('[Store] userId is required')
    return `${BLOB_PREFIX}user_${userId}/req_${requestId}.json`
  }

  private getUserPrefix(userId: string): string {
    if (!userId) throw new Error('[Store] userId is required')
    return `${BLOB_PREFIX}user_${userId}/`
  }

  // ★ 验证用户权限
  private validateAccess(analysis: StoredAnalysis, userId: string): void {
    if (analysis.user_id && analysis.user_id !== userId) {
      console.error(`[Store] Access denied: user ${userId} tried to access user ${analysis.user_id}'s data`)
      throw new Error('Access denied')
    }
  }

  /**
   * ★★★ 原子性添加：使用 requestId 作为唯一标识，userId 作为路径隔离 ★★★
   */
  async addWithRequestId(
    userId: string,
    requestId: string,
    analysis: Omit<StoredAnalysis, 'id' | 'user_id'>
  ): Promise<StoredAnalysis> {
    if (!userId || !requestId) {
      throw new Error('[Store] userId and requestId are required')
    }

    const id = `req_${requestId}`
    const storedAnalysis: StoredAnalysis = {
      id,
      user_id: userId,
      request_id: requestId,
      ...analysis,
    }

    if (this.useBlob) {
      try {
        const blobPath = this.getUserPath(userId, requestId)
        
        await put(blobPath, JSON.stringify(storedAnalysis), {
          access: 'private',
          contentType: 'application/json',
          addRandomSuffix: false,
          allowOverwrite: true,
        })
        
        console.log(`[Store] Added: user=${userId}, request=${requestId}`)
        return storedAnalysis
      } catch (error) {
        console.error('[Store] Failed to add:', error)
        throw error
      }
    }

    // Memory fallback
    this.memoryStore.set(`${userId}:${id}`, storedAnalysis)
    return storedAnalysis
  }

  /**
   * ★★★ 获取用户的所有记录 ★★★
   */
  async getAll(userId: string): Promise<StoredAnalysis[]> {
    if (!userId) {
      console.warn('[Store] getAll called without userId, returning empty array')
      return []
    }

    if (this.useBlob) {
      try {
        const prefix = this.getUserPrefix(userId)
        const { blobs } = await list({ prefix })

        // 去重：只保留每个pathname的最新版本
        const latestMap = new Map<string, typeof blobs[0]>()
        for (const blob of blobs) {
          if (blob.pathname.endsWith('_index.json')) continue
          
          const existing = latestMap.get(blob.pathname)
          if (!existing || new Date(blob.uploadedAt) > new Date(existing.uploadedAt)) {
            latestMap.set(blob.pathname, blob)
          }
        }

        const uniqueBlobs = Array.from(latestMap.values())
        console.log(`[Store] User ${userId}: ${blobs.length} blobs, ${uniqueBlobs.length} unique`)

        const analyses: StoredAnalysis[] = []
        for (const blob of uniqueBlobs) {
          try {
            const fetchUrl = (blob as any).downloadUrl || blob.url
            const response = await fetch(fetchUrl)
            if (response.ok) {
              const analysis = await response.json() as StoredAnalysis
              
              if (!analysis.user_id || analysis.user_id === userId) {
                analyses.push(analysis)
              } else {
                console.error(`[Store] Data corruption! File ${blob.pathname} has wrong user_id`)
              }
            } else {
              console.error(`[Store] Failed to fetch ${blob.pathname}: HTTP ${response.status}`)
            }
          } catch (e) {
            console.error(`[Store] Failed to fetch ${blob.pathname}:`, e)
          }
        }

        analyses.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        console.log(`[Store] User ${userId}: returning ${analyses.length} records`)
        return analyses
      } catch (error) {
        console.error('[Store] getAll failed:', error)
        return []
      }
    }

    // Memory fallback
    return Array.from(this.memoryStore.values())
      .filter(a => a.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  /**
   * ★★★ 兼容旧代码：不传userId时，获取所有数据（仅用于迁移） ★★★
   */
  async getAllLegacy(): Promise<StoredAnalysis[]> {
    if (this.useBlob) {
      try {
        const { blobs } = await list({ prefix: BLOB_PREFIX })
        
        const latestMap = new Map<string, typeof blobs[0]>()
        for (const blob of blobs) {
          if (blob.pathname.endsWith('_index.json')) continue
          const existing = latestMap.get(blob.pathname)
          if (!existing || new Date(blob.uploadedAt) > new Date(existing.uploadedAt)) {
            latestMap.set(blob.pathname, blob)
          }
        }

        const uniqueBlobs = Array.from(latestMap.values())
        const analyses: StoredAnalysis[] = []
        
        for (const blob of uniqueBlobs) {
          try {
            const fetchUrl = (blob as any).downloadUrl || blob.url
            const response = await fetch(fetchUrl)
            if (response.ok) {
              analyses.push(await response.json())
            }
          } catch (e) {
            console.error(`[Store] Error fetching ${blob.pathname}:`, e)
          }
        }
        
        return analyses.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      } catch (error) {
        console.error('[Store] getAllLegacy failed:', error)
        return []
      }
    }
    
    return Array.from(this.memoryStore.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  /**
   * ★★★ 更新记录 ★★★
   */
  async update(
    userId: string,
    id: string,
    updates: Partial<StoredAnalysis>
  ): Promise<StoredAnalysis | undefined> {
    if (!userId) {
      console.warn('[Store] update called without userId')
      return undefined
    }
    
    const existing = await this.get(userId, id)
    if (!existing) {
      console.warn(`[Store] Update failed: record not found user=${userId}, id=${id}`)
      return undefined
    }

    // 不需要再次验证，get 已经验证过了
    const updated = { ...existing, ...updates, user_id: userId }
    
    if (this.useBlob) {
      const requestId = existing.request_id || id.replace('req_', '')
      const blobPath = this.getUserPath(userId, requestId)
      
      await put(blobPath, JSON.stringify(updated), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      
      console.log(`[Store] Updated: user=${userId}, id=${id}`)
      return updated
    }

    this.memoryStore.set(`${userId}:${id}`, updated)
    return updated
  }

  /**
   * ★★★ 获取单个记录 ★★★
   */
  async get(userId: string, id: string): Promise<StoredAnalysis | undefined> {
    if (!userId) {
      console.warn('[Store] get called without userId')
      return undefined
    }

    if (this.useBlob) {
      try {
        const prefix = this.getUserPrefix(userId)
        const { blobs } = await list({ prefix: `${prefix}${id}` })
        if (blobs.length === 0) return undefined

        // 获取最新版本
        const latestBlob = blobs.reduce((latest, blob) => 
          new Date(blob.uploadedAt) > new Date(latest.uploadedAt) ? blob : latest
        )

        const fetchUrl = (latestBlob as any).downloadUrl || latestBlob.url
        const response = await fetch(fetchUrl)
        if (!response.ok) return undefined

        const analysis = await response.json() as StoredAnalysis
        
        // 验证用户权限
        if (analysis.user_id && analysis.user_id !== userId) {
          console.error(`[Store] Access denied for user ${userId}`)
          return undefined
        }
        
        return analysis
      } catch (error) {
        console.error('[Store] get failed:', error)
        return undefined
      }
    }

    return this.memoryStore.get(`${userId}:${id}`)
  }

  /**
   * ★★★ 通过requestId获取 ★★★
   */
  async getByRequestId(userId: string, requestId: string): Promise<StoredAnalysis | undefined> {
    if (!userId || !requestId) return undefined
    return this.get(userId, `req_${requestId}`)
  }

  /**
   * ★★★ 删除记录 ★★★
   */
  async delete(userId: string, id: string): Promise<boolean> {
    if (!userId) {
      console.warn('[Store] delete called without userId')
      return false
    }

    if (this.useBlob) {
      try {
        const prefix = this.getUserPrefix(userId)
        const { blobs } = await list({ prefix: `${prefix}${id}` })
        
        if (blobs.length === 0) return false
        
        // 删除所有版本
        for (const blob of blobs) {
          await del(blob.url)
        }
        
        console.log(`[Store] Deleted: user=${userId}, id=${id}`)
        return true
      } catch (error) {
        console.error('[Store] delete failed:', error)
        return false
      }
    }

    const key = `${userId}:${id}`
    const existed = this.memoryStore.has(key)
    this.memoryStore.delete(key)
    return existed
  }

  /**
   * ★★★ 删除过期的处理中任务 ★★★
   */
  async deleteStale(userId: string, maxAgeMinutes: number = 30): Promise<number> {
    const all = await this.getAll(userId)
    const now = Date.now()
    let deletedCount = 0
    
    for (const analysis of all) {
      if (analysis.processing) {
        const createdAt = new Date(analysis.created_at).getTime()
        const ageMinutes = (now - createdAt) / (1000 * 60)
        
        if (ageMinutes > maxAgeMinutes) {
          const deleted = await this.delete(userId, analysis.id)
          if (deleted) {
            deletedCount++
            console.log(`[Store] Deleted stale: ${analysis.id} (age: ${ageMinutes.toFixed(1)}min)`)
          }
        }
      }
    }
    
    return deletedCount
  }

  /**
   * ★★★ 获取用户统计信息 ★★★
   */
  async getUserStats(userId: string): Promise<{
    total: number
    processing: number
    completed: number
    failed: number
  }> {
    const all = await this.getAll(userId)
    return {
      total: all.length,
      processing: all.filter(a => a.processing).length,
      completed: all.filter(a => a.processed && !a.error).length,
      failed: all.filter(a => a.error).length,
    }
  }

  /**
   * ★★★ 清空用户数据（危险操作） ★★★
   */
  async clearUser(userId: string): Promise<number> {
    if (!userId) return 0
    
    const all = await this.getAll(userId)
    let deletedCount = 0
    
    for (const analysis of all) {
      const deleted = await this.delete(userId, analysis.id)
      if (deleted) deletedCount++
    }
    
    console.log(`[Store] Cleared ${deletedCount} records for user ${userId}`)
    return deletedCount
  }
}

// Singleton instance
export const analysisStore = new AnalysisStore()
