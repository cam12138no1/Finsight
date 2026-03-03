import { NextRequest, NextResponse } from 'next/server'
import { openrouter } from '@/lib/openrouter'
import {
  getTranscriptsWithoutConclusions,
  saveTranscriptConclusions,
  type TranscriptConclusion,
} from '@/lib/db/financial-queries'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const EXTRACTION_PROMPT = `你是一名专业的财报电话会议分析员。从以下Earnings Call Transcript中提取6-8条关键结论。

严格要求：
1. 每条结论必须是管理层的具体表述或承诺，不是你的解读
2. 必须标注发言人姓名
3. 必须包含原文引用（发言人的原话，保留英文）
4. 分类为以下之一：guidance(业绩指引), strategy(战略方向), risk(风险提示), investment(投资/资本支出), performance(业绩表现), other(其他)
5. summary用中文概括，original_quote保留英文原文
6. 绝对禁止任何主观评价，只提取客观事实和管理层原话

输出严格按JSON格式：
[
  {
    "summary": "管理层对下季度收入指引为$XX-XXB",
    "speaker": "CFO Name",
    "category": "guidance",
    "original_quote": "We expect revenue in the range of..."
  }
]`

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 })
    }

    const transcripts = await getTranscriptsWithoutConclusions()
    console.log(`[Extract] Found ${transcripts.length} transcripts without conclusions`)

    let processed = 0
    const errors: string[] = []

    for (const t of transcripts) {
      try {
        // Truncate to fit token limits
        const truncated = t.content.length > 50000 ? t.content.slice(0, 50000) + '\n[TRUNCATED]' : t.content

        const response = await openrouter.chat({
          model: 'anthropic/claude-sonnet-4',
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: `公司: ${t.symbol}\n季度: ${t.fiscal_year} Q${t.fiscal_quarter}\n日期: ${t.transcript_date}\n\n=== Transcript ===\n${truncated}` },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'transcript_conclusions',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  conclusions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        summary: { type: 'string' },
                        speaker: { type: 'string' },
                        category: { type: 'string' },
                        original_quote: { type: 'string' },
                      },
                      required: ['summary', 'speaker', 'category', 'original_quote'],
                    },
                  },
                },
                required: ['conclusions'],
              },
            },
          },
          temperature: 0.2,
          max_tokens: 4000,
        })

        const content = response.choices[0]?.message?.content
        if (!content) continue

        const parsed = JSON.parse(content) as { conclusions: TranscriptConclusion[] }
        if (parsed.conclusions && parsed.conclusions.length > 0) {
          await saveTranscriptConclusions(t.symbol, t.fiscal_year, t.fiscal_quarter, parsed.conclusions)
          processed++
          console.log(`[Extract] ${t.symbol} ${t.fiscal_year}Q${t.fiscal_quarter}: ${parsed.conclusions.length} conclusions`)
        }
      } catch (err: any) {
        errors.push(`${t.symbol} ${t.fiscal_year}Q${t.fiscal_quarter}: ${err.message}`)
        console.error(`[Extract] Error:`, err.message)
      }
    }

    return NextResponse.json({ success: true, processed, total: transcripts.length, errors: errors.length > 0 ? errors : undefined })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
