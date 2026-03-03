import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'
import { extractTextFromDocument } from '@/lib/document-parser'
import { analyzeJsonFinancialData } from '@/lib/ai/analyzer'
import { analysisStore } from '@/lib/store'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/upload-research
 *
 * Complete research report analysis in one request:
 * 1. Receive PDF via multipart form
 * 2. Extract text server-side
 * 3. Fetch financial data from DB
 * 4. Send both to AI for comparison
 * 5. Store result
 *
 * No Blob storage needed — everything happens server-side.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let userId: string | null = null
  let processingId: string | null = null

  try {
    const sessionResult = await validateSession(request, 'Upload Research')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }
    userId = sessionResult.session.userId
    const sessionId = sessionResult.session.sessionId

    const rateLimit = await checkRateLimit(userId, 'analysis')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        { status: 429, headers: createRateLimitHeaders(rateLimit) }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const symbol = formData.get('symbol') as string | null
    const category = (formData.get('category') as string) || 'AI_APPLICATION'
    const fiscalYear = parseInt(formData.get('fiscalYear') as string || '0')
    const fiscalQuarter = parseInt(formData.get('fiscalQuarter') as string || '0')
    const requestId = (formData.get('requestId') as string) || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    if (!file) {
      return NextResponse.json({ error: '未找到研报文件' }, { status: 400 })
    }
    if (!symbol || !fiscalYear || !fiscalQuarter) {
      return NextResponse.json({ error: '缺少公司代码或季度信息' }, { status: 400 })
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小超过50MB限制' }, { status: 400 })
    }

    console.log(`[Research] [${sessionId}] ${symbol} ${fiscalYear}Q${fiscalQuarter}: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)

    // Check duplicate
    const existing = await analysisStore.getByRequestId(userId, requestId)
    if (existing?.one_line_conclusion) {
      return NextResponse.json({ success: true, analysis_id: existing.id, analysis: existing, duplicate: true })
    }

    // Step 1: Extract text from research report PDF
    console.log(`[Research] [${sessionId}] Extracting text from PDF...`)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const researchText = await extractTextFromDocument(buffer, file.name)
    console.log(`[Research] [${sessionId}] Research text: ${researchText.length} chars`)

    if (!researchText || researchText.length < 100) {
      return NextResponse.json({ error: '研报文本提取失败或内容过少，请确认PDF格式正确' }, { status: 400 })
    }

    // Step 2: Get financial data from DB
    console.log(`[Research] [${sessionId}] Fetching financial data from DB...`)
    let financialText = ''
    try {
      const { getFetchedQuarter } = await import('@/lib/db/financial-queries')
      const dbRecord = await getFetchedQuarter(symbol, fiscalYear, fiscalQuarter)
      if (dbRecord?.report_text) {
        financialText = dbRecord.report_text
      } else if (dbRecord?.revenue || dbRecord?.net_income) {
        financialText = JSON.stringify({
          revenue: dbRecord.revenue, revenue_yoy: dbRecord.revenue_yoy,
          net_income: dbRecord.net_income, net_income_yoy: dbRecord.net_income_yoy,
          eps: dbRecord.eps, eps_yoy: dbRecord.eps_yoy,
          operating_margin: dbRecord.operating_margin, gross_margin: dbRecord.gross_margin,
        }, null, 2)
      }
    } catch (dbErr: any) {
      console.error(`[Research] [${sessionId}] DB error:`, dbErr.message)
    }

    if (!financialText) {
      return NextResponse.json({ error: '该季度的财报数据尚未入库，请等待数据同步后重试' }, { status: 400 })
    }
    console.log(`[Research] [${sessionId}] Financial data: ${financialText.length} chars`)

    // Step 3: Get company info
    const { getCompanyBySymbol } = await import('@/lib/companies')
    const companyInfo = getCompanyBySymbol(symbol)
    const companyName = companyInfo?.name || symbol
    const period = `${fiscalYear} Q${fiscalQuarter}`

    // Step 4: Create processing record
    const processingEntry = await analysisStore.addWithRequestId(userId, requestId, {
      company_name: companyName,
      company_symbol: symbol,
      report_type: '10-Q',
      fiscal_year: fiscalYear,
      fiscal_quarter: fiscalQuarter,
      period,
      category,
      filing_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      processed: false,
      processing: true,
      has_research_report: true,
    })
    processingId = processingEntry.id
    console.log(`[Research] [${sessionId}] Processing record: ${processingId}`)

    // Step 5: AI analysis — compare financial data with research report
    console.log(`[Research] [${sessionId}] Starting AI comparison...`)
    const analysisResult = await analyzeJsonFinancialData(
      financialText,
      {
        company: companyName,
        symbol,
        period,
        fiscalYear,
        fiscalQuarter,
        category: category as any,
      },
      researchText
    )
    console.log(`[Research] [${sessionId}] AI analysis complete`)

    // Step 6: Update record with results
    await analysisStore.update(userId, processingId, {
      processed: true,
      processing: false,
      has_research_report: true,
      ...analysisResult,
    })

    const elapsed = Date.now() - startTime
    console.log(`[Research] [${sessionId}] Done in ${elapsed}ms`)

    return NextResponse.json({
      success: true,
      analysis_id: processingId,
      metadata: { company_name: companyName, company_symbol: symbol, period },
      elapsed_ms: elapsed,
    })
  } catch (error: any) {
    console.error(`[Research] Error:`, error.message)

    if (processingId && userId) {
      try {
        await analysisStore.update(userId, processingId, { processing: false, error: error.message })
      } catch {}
    }

    return NextResponse.json({ error: error.message || '分析失败' }, { status: 500 })
  }
}
