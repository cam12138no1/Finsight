import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'
import { extractTextFromDocument } from '@/lib/document-parser'
import { analyzeJsonFinancialData } from '@/lib/ai/analyzer'
import { analysisStore } from '@/lib/store'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/ratelimit'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/upload-research
 *
 * Receives research report PDF via FormData, uploads to Vercel Blob (private),
 * extracts text server-side, then runs AI comparison with financial data from DB.
 */
/**
 * DELETE /api/upload-research?id={analysis_id}
 *
 * Deletes a research comparison analysis by ID.
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Delete Research')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }
    const userId = sessionResult.session.userId

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: '缺少分析ID' }, { status: 400 })
    }

    const deleted = await analysisStore.delete(userId, id)
    if (!deleted) {
      return NextResponse.json({ error: '未找到该分析记录' }, { status: 404 })
    }

    console.log(`[Research] Deleted analysis ${id} for user ${userId}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Research] Delete error:', error.message)
    return NextResponse.json({ error: error.message || '删除失败' }, { status: 500 })
  }
}

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

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const symbol = formData.get('symbol') as string
    const category = (formData.get('category') as string) || 'AI_APPLICATION'
    const fiscalYear = parseInt(formData.get('fiscalYear') as string || '0')
    const fiscalQuarter = parseInt(formData.get('fiscalQuarter') as string || '0')
    const requestId = (formData.get('requestId') as string) || `research_${Date.now()}`

    if (!file) {
      return NextResponse.json({ error: '未收到研报文件' }, { status: 400 })
    }
    if (!symbol || !fiscalYear || !fiscalQuarter) {
      return NextResponse.json({ error: '缺少公司代码或季度信息' }, { status: 400 })
    }

    console.log(`[Research] [${sessionId}] Received: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)

    // Step 1: Upload PDF to Vercel Blob (private store)
    console.log(`[Research] [${sessionId}] Uploading to Blob...`)
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const blobPath = `research/${symbol}/${timestamp}_${safeName}`

    const blob = await put(blobPath, file, {
      access: 'private',
      contentType: file.type || 'application/pdf',
    })
    console.log(`[Research] [${sessionId}] Blob uploaded: ${blob.url}`)

    // Step 2: Read file content and extract text
    console.log(`[Research] [${sessionId}] Extracting text...`)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const researchText = await extractTextFromDocument(buffer, file.name)

    if (!researchText || researchText.length < 100) {
      return NextResponse.json({ error: '研报PDF文本提取失败，请确认文件内容正确' }, { status: 400 })
    }
    console.log(`[Research] [${sessionId}] Extracted ${researchText.length} chars`)

    // Step 3: Store research text in DB
    if (process.env.DATABASE_URL) {
      try {
        const { saveResearchReport, ensureFetchedFinancialsTable } = await import('@/lib/db/financial-queries')
        await ensureFetchedFinancialsTable()
        await saveResearchReport({ userId, symbol, fiscalYear, fiscalQuarter, researchText, fileName: file.name })
        console.log(`[Research] [${sessionId}] Saved to DB`)
      } catch (dbErr: any) {
        console.warn(`[Research] [${sessionId}] DB save warning:`, dbErr.message)
      }
    }

    // Step 4: Get financial data from DB
    console.log(`[Research] [${sessionId}] Fetching financial data...`)
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
      console.error(`[Research] [${sessionId}] DB read error:`, dbErr.message)
    }

    if (!financialText) {
      return NextResponse.json({ error: '该季度的财报数据尚未入库，请等待数据同步后重试' }, { status: 400 })
    }
    console.log(`[Research] [${sessionId}] Financial data: ${financialText.length} chars`)

    // Step 5: Create processing record
    const { getCompanyBySymbol } = await import('@/lib/companies')
    const companyInfo = getCompanyBySymbol(symbol)
    const companyName = companyInfo?.name || symbol
    const period = `${fiscalYear} Q${fiscalQuarter}`

    const processingEntry = await analysisStore.addWithRequestId(userId, requestId, {
      company_name: companyName, company_symbol: symbol, report_type: '10-Q',
      fiscal_year: fiscalYear, fiscal_quarter: fiscalQuarter, period,
      category, filing_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(), processed: false, processing: true,
      has_research_report: true,
    })
    processingId = processingEntry.id

    // Step 6: AI comparison
    console.log(`[Research] [${sessionId}] Starting AI comparison...`)
    const analysisResult = await analyzeJsonFinancialData(
      financialText,
      { company: companyName, symbol, period, fiscalYear, fiscalQuarter, category: category as any },
      researchText
    )
    console.log(`[Research] [${sessionId}] AI complete`)

    // Step 7: Store result
    await analysisStore.update(userId, processingId, {
      processed: true, processing: false, has_research_report: true, ...analysisResult,
    })

    const elapsed = Date.now() - startTime
    console.log(`[Research] [${sessionId}] Done in ${elapsed}ms`)

    return NextResponse.json({
      success: true, analysis_id: processingId,
      metadata: { company_name: companyName, company_symbol: symbol, period },
      elapsed_ms: elapsed,
    })
  } catch (error: any) {
    console.error(`[Research] Error:`, error.message)
    if (processingId && userId) {
      try { await analysisStore.update(userId, processingId, { processing: false, error: error.message }) } catch {}
    }
    return NextResponse.json({ error: error.message || '分析失败' }, { status: 500 })
  }
}
