import { NextRequest, NextResponse } from 'next/server'
import { openrouter } from '@/lib/openrouter'
import {
  getTranscriptsWithoutConclusions,
  saveTranscriptConclusions,
  getFetchedQuarter,
  resetAllConclusions,
  type TranscriptConclusion,
} from '@/lib/db/financial-queries'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const DEEP_ANALYSIS_PROMPT = `你是一名资深买方分析师，负责从Earnings Call中提取深度洞察。你需要结合本季度的财报数据和管理层在电话会议中的表态，提炼出6-10条有深度的关键发现。

【你的分析目标】
不是简单摘抄管理层说了什么，而是要：
1. 将财报数字变化与管理层解释建立因果链条
2. 识别管理层表态中隐含的战略转向信号
3. 发现财报数据与管理层叙事之间的一致性或矛盾
4. 提炼出对未来2-3个季度有预判价值的关键变量

【每条发现必须包含】
- summary：深度分析结论（中文，2-3句话）。要求：
  · 第一句点明核心发现
  · 第二句引用具体财报数据作为证据
  · 第三句说明这个发现对未来的意义或需要关注的变量
- speaker：发言人姓名
- category：分类（见下）
- original_quote：管理层的英文原话（选取最能支撑该结论的一段原文，50-150词）

【分类标准】
- guidance：业绩指引 — 管理层对下季/全年的具体数字指引或范围
- strategy：战略转向 — 业务重心变化、新赛道布局、组织架构调整
- risk：风险信号 — 管理层主动或被动提及的挑战、不确定性、下行压力
- investment：资本配置 — CapEx计划、研发投入方向、并购/回购/分红
- performance：业绩归因 — 管理层对本季度核心数字变化的解释和归因
- other：其他重要发现

【深度分析示例】
❌ 浅层："CEO表示AI业务增长强劲"
✅ 深度："云业务收入同比增长35%至$XX.XXB，CEO将增长归因于企业AI工作负载迁移加速。值得关注的是，管理层首次披露AI相关收入已占云业务的XX%以上，暗示AI货币化已从试验阶段进入规模化阶段。下季需验证这一增速是否可持续，以及AI收入占比能否继续提升。"

【语言要求】
- overall_summary 和每条 conclusion 的 summary 字段必须使用中文
- original_quote 保留英文原文
- speaker 保留英文姓名

【严格禁止】
- 禁止使用"beat/miss/超预期/不及预期"等评价性语言
- 禁止给出投资建议（超配/低配/买入/卖出）
- 所有数据引用必须来自提供的财报数据或管理层原话
- 不得编造或推测未在材料中出现的信息
- 禁止使用英文输出 summary 和 overall_summary

【输出格式】
输出JSON，包含：
1. overall_summary：3-4句话的电话会议整体结论（中文），概括管理层传递的核心信息和最值得关注的变化
2. conclusions：6-10条具体发现的数组

格式：
{
  "overall_summary": "本次电话会议核心信息：...",
  "conclusions": [...]
}
`

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

    // Support reset param to re-extract all with new prompt
    const url = new URL(request.url)
    if (url.searchParams.get('reset') === 'true') {
      const resetCount = await resetAllConclusions()
      console.log(`[Extract] Reset ${resetCount} existing conclusions`)
    }

    const allTranscripts = await getTranscriptsWithoutConclusions()
    const transcripts = allTranscripts.slice(0, 3) // Deeper analysis = more tokens, process fewer per batch
    console.log(`[Extract] Found ${allTranscripts.length} without conclusions, processing ${transcripts.length} this batch`)

    let processed = 0
    const errors: string[] = []

    for (const t of transcripts) {
      try {
        // Fetch matching financial data for context
        let financialContext = ''
        try {
          const financialRecord = await getFetchedQuarter(t.symbol, t.fiscal_year, t.fiscal_quarter)
          if (financialRecord?.report_text) {
            financialContext = `\n\n=== 本季度财报核心数据 ===\n${financialRecord.report_text}`
          }
          if (financialRecord) {
            const metrics = [
              financialRecord.revenue && `Revenue: ${financialRecord.revenue} (YoY: ${financialRecord.revenue_yoy || 'N/A'})`,
              financialRecord.net_income && `Net Income: ${financialRecord.net_income} (YoY: ${financialRecord.net_income_yoy || 'N/A'})`,
              financialRecord.eps && `EPS: ${financialRecord.eps} (YoY: ${financialRecord.eps_yoy || 'N/A'})`,
              financialRecord.operating_margin && `Operating Margin: ${financialRecord.operating_margin}`,
              financialRecord.gross_margin && `Gross Margin: ${financialRecord.gross_margin}`,
            ].filter(Boolean).join('\n')
            if (metrics) {
              financialContext = `\n\n=== 本季度财报关键指标 ===\n${metrics}${financialContext}`
            }
          }
        } catch {
          // Financial data unavailable, proceed with transcript only
        }

        const truncatedTranscript = t.content.length > 45000
          ? t.content.slice(0, 45000) + '\n[TRUNCATED]'
          : t.content

        const userMessage = `公司: ${t.symbol}
季度: ${t.fiscal_year} Q${t.fiscal_quarter}
电话会议日期: ${t.transcript_date}
${financialContext}

=== Earnings Call Transcript ===
${truncatedTranscript}

请结合财报数据和电话会议内容，提炼6-10条有深度的关键发现。每条都要建立数据与管理层表态之间的逻辑链条。
输出JSON格式：{"conclusions": [...]}`

        const response = await openrouter.chat({
          model: 'openai/gpt-4o',
          messages: [
            { role: 'system', content: DEEP_ANALYSIS_PROMPT },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 6000,
        })

        const content = response.choices[0]?.message?.content
        if (!content) continue

        const parsed = JSON.parse(content) as { overall_summary?: string; conclusions: TranscriptConclusion[] }
        if (parsed.conclusions && parsed.conclusions.length > 0) {
          // Prepend overall_summary as a special conclusion entry
          const allConclusions: TranscriptConclusion[] = []
          if (parsed.overall_summary) {
            allConclusions.push({
              summary: parsed.overall_summary,
              speaker: '',
              category: 'overall_summary' as any,
              original_quote: '',
            })
          }
          allConclusions.push(...parsed.conclusions)
          await saveTranscriptConclusions(t.symbol, t.fiscal_year, t.fiscal_quarter, allConclusions)
          processed++
          console.log(`[Extract] ${t.symbol} ${t.fiscal_year}Q${t.fiscal_quarter}: ${parsed.conclusions.length} conclusions + summary`)
        }
      } catch (err: any) {
        errors.push(`${t.symbol} ${t.fiscal_year}Q${t.fiscal_quarter}: ${err.message}`)
        console.error(`[Extract] Error:`, err.message)
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      batch_size: transcripts.length,
      remaining: allTranscripts.length - transcripts.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
