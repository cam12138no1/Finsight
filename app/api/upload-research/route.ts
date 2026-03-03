import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'
import { extractTextFromDocument } from '@/lib/document-parser'
import { analyzeJsonFinancialData } from '@/lib/ai/analyzer'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/upload-research — Upload research PDF, compare with financial data
 * Results stored in Postgres research_reports table (not Blob).
 *
 * DELETE /api/upload-research?id={id} — Delete a research comparison
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const sessionResult = await validateSession(request, 'Upload Research')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }
    const userId = sessionResult.session.userId
    const sessionId = sessionResult.session.sessionId

    const rateLimit = await checkRateLimit(userId, 'analysis')
    if (!rateLimit.success) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: createRateLimitHeaders(rateLimit) })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const symbol = formData.get('symbol') as string
    const category = (formData.get('category') as string) || 'AI_APPLICATION'
    const fiscalYear = parseInt(formData.get('fiscalYear') as string || '0')
    const fiscalQuarter = parseInt(formData.get('fiscalQuarter') as string || '0')

    if (!file) return NextResponse.json({ error: '未收到研报文件' }, { status: 400 })
    if (!symbol || !fiscalYear || !fiscalQuarter) return NextResponse.json({ error: '缺少公司或季度信息' }, { status: 400 })

    console.log(`[Research] [${sessionId}] ${symbol} ${fiscalYear}Q${fiscalQuarter}: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)

    // Step 1: Extract text from PDF
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const researchText = await extractTextFromDocument(buffer, file.name)
    if (!researchText || researchText.length < 100) {
      return NextResponse.json({ error: '研报PDF文本提取失败' }, { status: 400 })
    }
    console.log(`[Research] [${sessionId}] Extracted ${researchText.length} chars`)

    // Step 2: Save research text to DB
    const { saveResearchReport, updateResearchAnalysis, getFetchedQuarter, ensureFetchedFinancialsTable } = await import('@/lib/db/financial-queries')
    await ensureFetchedFinancialsTable()
    const reportId = await saveResearchReport({ userId, symbol, fiscalYear, fiscalQuarter, researchText, fileName: file.name })
    console.log(`[Research] [${sessionId}] Saved to DB: id=${reportId}`)

    // Step 3: Get financial data
    let financialText = ''
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
    if (!financialText) return NextResponse.json({ error: '该季度财报数据未入库' }, { status: 400 })

    // Step 4: AI comparison
    const { getCompanyBySymbol } = await import('@/lib/companies')
    const companyName = getCompanyBySymbol(symbol)?.name || symbol
    console.log(`[Research] [${sessionId}] Starting AI comparison...`)

    const analysisResult = await analyzeJsonFinancialData(
      financialText,
      { company: companyName, symbol, period: `${fiscalYear} Q${fiscalQuarter}`, fiscalYear, fiscalQuarter, category: category as any },
      researchText
    )

    // Step 5: Store result in DB
    await updateResearchAnalysis(reportId, analysisResult)
    const elapsed = Date.now() - startTime
    console.log(`[Research] [${sessionId}] Done in ${elapsed}ms, reportId=${reportId}`)

    return NextResponse.json({
      success: true,
      report_id: reportId,
      elapsed_ms: elapsed,
    })
  } catch (error: any) {
    console.error(`[Research] Error:`, error.message)
    return NextResponse.json({ error: error.message || '分析失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Delete Research')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '0')
    if (!id) return NextResponse.json({ error: '缺少id' }, { status: 400 })

    const { deleteResearchReport } = await import('@/lib/db/financial-queries')
    const deleted = await deleteResearchReport(id, sessionResult.session.userId)

    return NextResponse.json({ success: deleted })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
