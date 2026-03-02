import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'
import { extractTextFromDocument } from '@/lib/document-parser'
import { analyzeFinancialReport } from '@/lib/ai/analyzer'
import { extractMetadataFromReport } from '@/lib/ai/extractor'
import { analysisStore } from '@/lib/store'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/ratelimit'
import { fetchWithRetry } from '@/lib/fetch-retry'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

interface UploadedFile {
  url: string
  pathname: string
  originalName: string
}

interface AnalyzeRequest {
  financialFiles: UploadedFile[]
  researchFiles: UploadedFile[]
  category: 'AI_APPLICATION' | 'AI_SUPPLY_CHAIN' | 'CONSUMER_GOODS'
  requestId: string
  fiscalYear: number
  fiscalQuarter: number
  useDbFinancialData?: boolean
  companySymbol?: string
}

/**
 * 分析API - 从 Vercel Blob URL 读取文件并进行分析
 * 
 * ★★★ 增强的用户隔离 ★★★
 * - 使用增强的Session验证
 * - 每次请求都重新验证用户身份
 * - 详细的日志记录用于调试
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let processingId: string | null = null
  let userId: string | null = null
  let sessionId: string | null = null
  
  try {
    console.log('========================================')
    console.log('[分析API] 收到新请求', new Date().toISOString())
    
    // ★★★ 1. 增强的Session验证 ★★★
    const sessionResult = await validateSession(request, '分析API')
    if (!sessionResult.valid) {
      return NextResponse.json(
        { error: sessionResult.error, code: sessionResult.code },
        { status: sessionResult.status }
      )
    }
    
    userId = sessionResult.session.userId
    sessionId = sessionResult.session.sessionId
    
    console.log(`[分析API] [${sessionId}] 用户已认证:`, {
      userId,
      email: sessionResult.session.userEmail,
    })

    // ★★★ 2. 速率限制检查 ★★★
    const rateLimit = await checkRateLimit(userId, 'analysis')
    if (!rateLimit.success) {
      console.warn(`[分析API] [${sessionId}] 用户 ${userId} 超出速率限制`)
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimit),
        }
      )
    }

    // 解析JSON请求体
    const body: AnalyzeRequest = await request.json()
    
    const { financialFiles, researchFiles, category, fiscalYear, fiscalQuarter, useDbFinancialData, companySymbol } = body
    const requestId = body.requestId
    
    console.log(`[分析API] [${sessionId}] 请求参数:`)
    console.log(`  - userId: ${userId}`)
    console.log(`  - requestId: ${requestId}`)
    console.log(`  - category: ${category}`)
    console.log(`  - fiscalYear: ${fiscalYear}`)
    console.log(`  - fiscalQuarter: ${fiscalQuarter}`)
    console.log(`  - 财报文件数: ${financialFiles?.length || 0}`)
    console.log(`  - 研报文件数: ${researchFiles?.length || 0}`)
    console.log(`  - 使用DB财报数据: ${useDbFinancialData || false}`)

    if (!requestId) {
      return NextResponse.json({ error: '缺少requestId' }, { status: 400 })
    }

    if ((!financialFiles || financialFiles.length === 0) && !useDbFinancialData) {
      return NextResponse.json({ error: '请上传财报文件' }, { status: 400 })
    }

    // ★★★ 3. 再次验证Session（防止并发请求时Session变化） ★★★
    const revalidateResult = await validateSession(request, '分析API-重验证')
    if (!revalidateResult.valid) {
      console.error(`[分析API] [${sessionId}] ❌ Session重验证失败`)
      return NextResponse.json(
        { error: revalidateResult.error },
        { status: revalidateResult.status }
      )
    }
    
    // 确保userId没有变化
    if (revalidateResult.session.userId !== userId) {
      console.error(`[分析API] [${sessionId}] ❌ Session用户ID变化！原: ${userId}, 新: ${revalidateResult.session.userId}`)
      return NextResponse.json(
        { error: '会话状态异常，请刷新页面重新登录' },
        { status: 401 }
      )
    }

    // ★★★ 4. 检查是否已存在此requestId的记录 ★★★
    const existingByRequestId = await analysisStore.getByRequestId(userId, requestId)
    if (existingByRequestId) {
      console.log(`[分析API] [${sessionId}] 发现已存在的记录:`, existingByRequestId.id)
      if (!existingByRequestId.processing && existingByRequestId.one_line_conclusion) {
        console.log(`[分析API] [${sessionId}] 返回已完成的分析结果`)
        return NextResponse.json({
          success: true,
          analysis_id: existingByRequestId.id,
          analysis: existingByRequestId,
          duplicate: true,
        })
      }
      if (existingByRequestId.processing) {
        return NextResponse.json({
          success: false,
          analysis_id: existingByRequestId.id,
          message: '请求正在处理中',
          duplicate: true,
          processing: true,
        }, { status: 202 })
      }
    }

    // ★★★ 5. 获取财报文本 ★★★
    let financialText = ''

    if (useDbFinancialData && companySymbol && fiscalYear && fiscalQuarter) {
      // Pull financial report text from database (cron-fetched data)
      console.log(`[分析API] [${sessionId}] 从数据库获取财报文本: ${companySymbol} ${fiscalYear} Q${fiscalQuarter}`)
      try {
        const { getFetchedQuarter } = await import('@/lib/db/financial-queries')
        const dbRecord = await getFetchedQuarter(companySymbol, fiscalYear, fiscalQuarter)
        if (dbRecord?.report_text) {
          financialText = dbRecord.report_text
          console.log(`[分析API] [${sessionId}] 从DB获取财报文本: ${financialText.length} 字符`)
        } else {
          return NextResponse.json({ error: '该季度的财报原文尚未入库，无法进行研报对比' }, { status: 400 })
        }
      } catch (dbErr: any) {
        console.error(`[分析API] [${sessionId}] DB读取失败:`, dbErr.message)
        return NextResponse.json({ error: '读取财报数据失败: ' + dbErr.message }, { status: 500 })
      }
    } else {
      // Download financial files from Blob URLs (user-uploaded)
      console.log(`[分析API] [${sessionId}] 开始从Blob下载文件...`)
      const financialBuffers: { buffer: Buffer; name: string }[] = []
      for (const file of (financialFiles || [])) {
        console.log(`[分析API] [${sessionId}] 下载财报: ${file.originalName}`)
        const response = await fetchWithRetry(file.url, { maxRetries: 3 })
        const arrayBuffer = await response.arrayBuffer()
        financialBuffers.push({ buffer: Buffer.from(arrayBuffer), name: file.originalName })
      }
      for (const { buffer, name } of financialBuffers) {
        const text = await extractTextFromDocument(buffer, name)
        financialText += text + '\n\n'
      }
      console.log(`[分析API] [${sessionId}] 财报文本提取完成: ${financialText.length} 字符`)
    }

    // ★★★ 6. 下载并提取研报文本 ★★★
    let researchText = ''
    const researchBuffers: { buffer: Buffer; name: string }[] = []
    for (const file of (researchFiles || [])) {
      console.log(`[分析API] [${sessionId}] 下载研报: ${file.originalName}`)
      const response = await fetchWithRetry(file.url, { maxRetries: 3 })
      const arrayBuffer = await response.arrayBuffer()
      researchBuffers.push({ buffer: Buffer.from(arrayBuffer), name: file.originalName })
    }
    for (const { buffer, name } of researchBuffers) {
      const text = await extractTextFromDocument(buffer, name)
      researchText += text + '\n\n'
    }
    if (researchText) {
      console.log(`[分析API] [${sessionId}] 研报文本提取完成: ${researchText.length} 字符`)
    }

    // ★★★ 7. 提取元数据 ★★★
    console.log(`[分析API] [${sessionId}] 开始提取元数据...`)
    let metadata: any
    if (useDbFinancialData && companySymbol) {
      const { getCompanyBySymbol: getCompany } = await import('@/lib/companies')
      const companyInfo = getCompany(companySymbol)
      metadata = {
        company_name: companyInfo?.name || companySymbol,
        company_symbol: companySymbol,
        report_type: '10-Q',
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        filing_date: new Date().toISOString().split('T')[0],
      }
    } else {
      metadata = await extractMetadataFromReport(financialText)
    }
    console.log(`[分析API] [${sessionId}] 元数据:`, JSON.stringify(metadata, null, 2))

    // 使用用户选择的年份和季度
    const finalFiscalYear = fiscalYear || metadata.fiscal_year || new Date().getFullYear()
    const finalFiscalQuarter = fiscalQuarter || metadata.fiscal_quarter || 4
    const period = `${finalFiscalYear} Q${finalFiscalQuarter}`

    // ★★★ 8. 第三次验证Session（在创建记录前） ★★★
    const finalValidation = await validateSession(request, '分析API-最终验证')
    if (!finalValidation.valid || finalValidation.session.userId !== userId) {
      console.error(`[分析API] [${sessionId}] ❌ 最终Session验证失败或userId变化`)
      return NextResponse.json(
        { error: '会话状态异常，请刷新页面重新登录' },
        { status: 401 }
      )
    }
    
    console.log(`[分析API] [${sessionId}] ✓ 最终Session验证通过，userId确认: ${userId}`)

    // ★★★ 9. 再次检查是否已存在（防止并发） ★★★
    const doubleCheck = await analysisStore.getByRequestId(userId, requestId)
    if (doubleCheck) {
      console.log(`[分析API] [${sessionId}] 二次检查发现已存在记录:`, doubleCheck.id)
      if (!doubleCheck.processing && doubleCheck.one_line_conclusion) {
        return NextResponse.json({
          success: true,
          analysis_id: doubleCheck.id,
          analysis: doubleCheck,
          duplicate: true,
        })
      }
      if (doubleCheck.processing) {
        return NextResponse.json({
          success: false,
          analysis_id: doubleCheck.id,
          message: '请求正在处理中',
          duplicate: true,
          processing: true,
        }, { status: 202 })
      }
    }

    // ★★★ 10. 创建处理记录（使用验证过的userId） ★★★
    console.log(`[分析API] [${sessionId}] 创建处理记录，userId: ${userId}`)
    const processingEntry = await analysisStore.addWithRequestId(userId, requestId, {
      company_name: metadata.company_name,
      company_symbol: metadata.company_symbol,
      report_type: metadata.report_type,
      fiscal_year: finalFiscalYear,
      fiscal_quarter: finalFiscalQuarter || undefined,
      period: period,
      category: category || undefined,
      filing_date: metadata.filing_date,
      created_at: new Date().toISOString(),
      processed: false,
      processing: true,
    })
    processingId = processingEntry.id
    console.log(`[分析API] [${sessionId}] 处理记录已创建: ${processingId}，user_id: ${userId}`)

    // ★★★ 11. AI分析 ★★★
    console.log(`[分析API] [${sessionId}] 开始AI分析...`)
    const analysisResult = await analyzeFinancialReport(
      financialText,
      {
        company: metadata.company_name,
        symbol: metadata.company_symbol,
        period: period,
        fiscalYear: finalFiscalYear,
        fiscalQuarter: finalFiscalQuarter,
        category: category,
      },
      researchText || undefined
    )
    console.log(`[分析API] [${sessionId}] AI分析完成`)

    // ★★★ 12. 更新记录（使用验证过的userId） ★★★
    console.log(`[分析API] [${sessionId}] 更新记录，userId: ${userId}`)
    await analysisStore.update(userId, processingId, {
      processed: true,
      processing: false,
      error: undefined,
      ...analysisResult,
    })
    console.log(`[分析API] [${sessionId}] 记录更新完成`)

    const duration = Date.now() - startTime
    console.log(`[分析API] [${sessionId}] ✓ 完成，用户: ${userId}，耗时: ${duration}ms`)
    console.log('========================================')

    return NextResponse.json({
      success: true,
      analysis_id: processingId,
      metadata: {
        company_name: metadata.company_name,
        company_symbol: metadata.company_symbol,
        period: period,
      },
      analysis: analysisResult,
    })

  } catch (error: any) {
    console.error(`[分析API] [${sessionId || 'unknown'}] ✗ 错误:`, error.message)
    console.error(`[分析API] [${sessionId || 'unknown'}] 错误堆栈:`, error.stack)
    
    // 更新记录为失败状态
    if (processingId && userId) {
      try {
        await analysisStore.update(userId, processingId, {
          processing: false,
          error: error.message,
        })
        console.log(`[分析API] [${sessionId || 'unknown'}] 已更新记录为失败状态`)
      } catch (updateError) {
        console.error(`[分析API] [${sessionId || 'unknown'}] 更新失败状态时出错:`, updateError)
      }
    }
    
    return NextResponse.json(
      { error: error.message || '分析失败' },
      { status: 500 }
    )
  }
}
