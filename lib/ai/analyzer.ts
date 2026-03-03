import { openrouter } from '../openrouter'
import { getCompanyCategory, COMPANY_CATEGORIES } from './prompts'

export interface ReportMetadata {
  company: string
  symbol: string
  period: string
  fiscalYear: number
  fiscalQuarter?: number
  consensus?: {
    revenue?: number
    eps?: number
    operatingIncome?: number
  }
  // Optional category override from user selection
  category?: 'AI_APPLICATION' | 'AI_SUPPLY_CHAIN' | 'CONSUMER_GOODS' | null
}

// Results table row structure - objective data only
export interface ResultsTableRow {
  metric: string           // 指标名称
  actual: string           // 实际值
  consensus: string        // 市场预期（无研报时填"-"）
  delta: string            // YoY变化 或 vs预期差异
  assessment: string       // 客观描述：如"+18.00% YoY"（禁止beat/miss）
  importance?: string      // 数据意义的客观说明
}

// Driver detail structure
export interface DriverDetail {
  title: string            // 标题
  metrics?: string         // 相关指标
  change: string           // 变化描述
  magnitude: string        // 幅度
  reason: string           // 原因分析
}

// Complete analysis result - objective data extraction
export interface AnalysisResult {
  // 核心数据摘要（客观）
  one_line_conclusion: string

  // 结果层 - 客观数据表格
  results_summary: string
  results_table: ResultsTableRow[]
  results_explanation: string

  // 驱动层（客观数据）
  drivers_summary: string
  drivers: {
    demand: DriverDetail
    monetization: DriverDetail
    efficiency: DriverDetail
  }

  // 投入与资本支出数据
  investment_roi: {
    capex_change: string
    opex_change: string
    investment_direction: string
    roi_evidence: string[]
    management_commitment: string
  }

  // 风险因素（客观事实）
  sustainability_risks: {
    sustainable_drivers: string[]
    main_risks: string[]
    checkpoints: string[]
  }

  // 关键数据快照（用于横向对比）
  comparison_snapshot?: {
    core_revenue: string
    core_profit: string
    guidance: string
    core_driver_quantified: string
    main_risk_quantified: string
    // Legacy fields (deprecated - kept for backward compat with old data)
    beat_miss?: string
    recommendation?: string
    position_action?: string
    next_quarter_focus?: string
  }

  // 研报对比（仅当上传研报时）
  research_comparison?: {
    consensus_source: string
    key_differences: string[]
    analyst_blind_spots: string
    // Legacy (deprecated)
    beat_miss_summary?: string
  }

  // Legacy fields (deprecated - kept for backward compat with old data)
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

  // 元数据
  metadata?: {
    company_category: string
    analysis_timestamp: string
    prompt_version: string
    has_research_report?: boolean
  }
}

// ============================================================
// 客观数据提取系统提示词
// ============================================================

const OBJECTIVE_EXTRACTION_SYSTEM_PROMPT = `你是一名专业的财务数据提取分析员。你的唯一任务是从财报中客观提取核心财务数据，并进行数据计算和结构化呈现。

██████████████████████████████████████████████████████████████
███  严格禁止事项 - 违反将导致输出被拒绝  ███
██████████████████████████████████████████████████████████████

❌ 绝对禁止的内容：
1. "beat"、"miss"、"strong beat"、"moderate beat"、"inline"等评价性判断
2. "超预期"、"不及预期"、"低于预期"、"符合预期"等中文评价
3. 投资建议如"超配"、"低配"、"标配"、"加仓"、"减仓"、"持有"
4. 主观形容词如"强劲"、"亮眼"、"疲软"、"惊人"、"出色"
5. 对未来走势的预测性判断
6. 任何投资评级或仓位建议
7. 任何形式的打分或评级（如Strong Beat / Moderate Miss等）

✓ 只允许的内容：
1. 从财报文档中直接提取的客观数值
2. 基于财报数据计算的同比/环比变化
3. 管理层原话引用（标注为"管理层表述"）
4. 客观事实描述（如"CapEx为$XX.XXB，同比增长XX.XX%"）

【数据格式要求】
⚠️ 十亿级金额：$XX.XXB（必须两位小数）
  ✓ $113.83B  ✓ $17.66B  ✓ $2.10B
  ✗ $113.8B   ✗ $17.7B   ✗ $2.1B

⚠️ 百分比：XX.XX%（必须两位小数，正数带+号）
  ✓ +18.00%  ✓ +2.74%  ✓ -0.53%
  ✗ +18.0%   ✗ +2.7%   ✗ -0.5%

⚠️ EPS：$X.XX（两位小数）
  ✓ $2.82  ✓ $6.43
  ✗ $2.8   ✗ $6.4

【数据来源优先级】
1. 财报原文（Earnings Release/10-Q/10-K）中的数字
2. Non-GAAP Reconciliation表
3. 如数据未在文档中披露，填写"数据未披露"
4. 禁止推测、估算、或使用外部知识

【YoY计算规则】
YoY% = (本期值 - 去年同期值) / |去年同期值| × 100%
结果必须两位小数，如 +16.00%

【GAAP vs Non-GAAP】
- 默认使用Non-GAAP（Street对比基准）
- 首次出现时标注"(Non-GAAP)"或"(GAAP)"
- 如只有GAAP数据，使用GAAP并注明`

// AI应用公司专用提示
const AI_APPLICATION_CONTEXT = `【公司类型：AI应用公司】
重点关注维度：
- 用户增长与活跃度（DAU/MAU/DAP）
- 变现效率（ARPU/广告价格/转化率）
- AI对产品的赋能效果（推荐系统/内容生成/广告定向）
- 内容生态与用户时长
- 分部收入（广告/云/订阅/硬件）`

// AI供应链公司专用提示
const AI_SUPPLY_CHAIN_CONTEXT = `【公司类型：AI供应链公司】
重点关注维度：
- 算力需求与供给（GPU出货/云订单/数据中心扩张）
- 产品周期与ASP（新品发布/定价权/库存周期）
- 客户集中度与订单可见性
- 供应链瓶颈（CoWoS/HBM/先进封装）
- 分部收入（Data Center/Gaming/Auto等）`

// 消费品公司专用提示 — 涵盖奢侈品、服饰、鞋履等
const CONSUMER_GOODS_CONTEXT = `【公司类型：消费品/奢侈品公司】

重点关注维度（按优先级排序）：

1. 收入增长拆解
   - 有机增长 vs 汇率影响 vs 并购贡献（必须拆分）
   - 量价拆分：销量增长 vs 价格/产品组合升级贡献
   - 品类结构：皮具/成衣/香水/珠宝/酒类/鞋履各品类增速差异
   - 同店增长（SSS/Comparable store sales）vs 新店扩张

2. 地区结构深度拆解
   - 中国/亚太市场（消费复苏节奏、旅游零售/代购影响）
   - 欧洲市场（本地客 vs 旅游客占比变化）
   - 美国市场（消费分层、折扣渠道压力）
   - 中东/印度等新兴市场增量

3. 品牌力与定价权
   - 年度提价幅度与频率
   - ASP（平均售价）变化趋势
   - 全价销售占比 vs 折扣/outlet占比
   - 品牌热度指标（等候名单、限量款溢价）

4. 渠道与数字化
   - DTC（直营零售+电商）vs 批发渠道占比变化
   - 线上渗透率与线上增速
   - 门店数量净增减、坪效变化

5. 成本与利润率
   - 毛利率驱动：原材料成本/产品组合/定价
   - 营业利润率：营销投入/租金/人力成本杠杆
   - 汇率对收入和利润的影响（constant currency vs reported）

6. 库存与运营效率
   - 库存周转天数/DIO变化
   - 产能利用率（自有工厂 vs 外包）
   - 供应链投资（物流中心、数字化）`

// ============================================================
// JSON输出格式 - 客观数据提取（无研报）
// ============================================================

const OBJECTIVE_JSON_OUTPUT = `

请严格按照以下JSON格式输出，所有内容使用中文，所有数据必须客观准确。
禁止任何beat/miss、投资建议、主观评价。

{
  "one_line_conclusion": "核心财务数据概要：Revenue $XX.XXB (YoY +XX.XX%), Net Income $XX.XXB (YoY +XX.XX%), EPS $X.XX (YoY +XX.XX%)",

  "results_summary": "收入变化的客观拆解：各业务板块或地区的贡献情况（必须量化）",

  "results_table": [
    {"metric": "Revenue", "actual": "$XX.XXB", "consensus": "-", "delta": "+XX.XX% YoY", "assessment": "+XX.XX% YoY", "importance": "客观说明此数据的意义"},
    {"metric": "Operating Income (Non-GAAP)", "actual": "$XX.XXB", "consensus": "-", "delta": "+XX.XX% YoY", "assessment": "+XX.XX% YoY"},
    {"metric": "Operating Margin", "actual": "XX.XX%", "consensus": "-", "delta": "+/-XX bps YoY", "assessment": "扩张/收窄 XX bps"},
    {"metric": "Net Income", "actual": "$XX.XXB", "consensus": "-", "delta": "+XX.XX% YoY", "assessment": "+XX.XX% YoY"},
    {"metric": "EPS (Diluted)", "actual": "$X.XX", "consensus": "-", "delta": "+XX.XX% YoY", "assessment": "+XX.XX% YoY"},
    {"metric": "下季指引 Revenue", "actual": "$XX-XXB", "consensus": "-", "delta": "vs上季指引变化", "assessment": "管理层给出的指引范围"}
  ],

  "results_explanation": "关键数据变化的客观解读（引用管理层表述，禁止主观评价）",

  "drivers_summary": "三大驱动因素的客观数据汇总",

  "drivers": {
    "demand": {
      "title": "A. 需求/量",
      "metrics": "与需求相关的核心指标名称",
      "change": "指标的客观变化描述（含具体数值）",
      "magnitude": "+XX.XX% YoY",
      "reason": "管理层归因或客观原因"
    },
    "monetization": {
      "title": "B. 变现/单价",
      "metrics": "与变现相关的核心指标",
      "change": "客观变化描述（含具体数值）",
      "magnitude": "+XX.XX%",
      "reason": "原因"
    },
    "efficiency": {
      "title": "C. 内部效率",
      "metrics": "与效率相关的核心指标",
      "change": "客观变化描述（含具体数值）",
      "magnitude": "+XX.XX%",
      "reason": "原因"
    }
  },

  "investment_roi": {
    "capex_change": "本期CapEx客观数据及同比变化",
    "opex_change": "Opex客观数据及增长主因拆解",
    "investment_direction": "管理层表述的投入方向",
    "roi_evidence": ["已体现的ROI数据1（量化）", "ROI数据2（量化）"],
    "management_commitment": "管理层原话中的财务承诺或目标"
  },

  "sustainability_risks": {
    "sustainable_drivers": ["基于数据的可持续因素1", "因素2", "因素3"],
    "main_risks": ["风险因素1（含数据或事实依据+时间窗口）", "风险因素2", "风险因素3"],
    "checkpoints": ["下季需关注的数据指标1", "指标2", "指标3"]
  },

  "comparison_snapshot": {
    "core_revenue": "$XX.XXB (+XX.XX% YoY)",
    "core_profit": "$XX.XXB (+XX.XX% YoY)",
    "guidance": "管理层给出的下季/全年指引",
    "core_driver_quantified": "核心驱动的量化数据",
    "main_risk_quantified": "主要风险的量化数据"
  }
}

【关键规则】
1. results_table只保留5-7行最关键的财务指标
2. assessment字段只填写客观的YoY变化方向和幅度，严禁beat/miss
3. consensus字段在无研报时填写"-"
4. 每个驱动必须有具体数据支撑
5. 所有金额$XX.XXB格式，百分比XX.XX%格式
6. 严禁任何主观评价、投资建议、beat/miss判断
7. 所有输出内容不要使用大括号{}作为占位符，直接填入具体内容`

// ============================================================
// JSON输出格式 - 研报对比版本（有研报时）
// ============================================================

const COMPARISON_JSON_OUTPUT = `

请严格按照以下JSON格式输出，将财报实际数据与研报预期进行客观对比。
重要：只展示数据差异，不做主观评价判断。禁止beat/miss等评价词。

{
  "one_line_conclusion": "核心数据对比：Revenue $XX.XXB (YoY +XX.XX%), 研报预期 $XX.XXB (差异 +XX.XX%); EPS $X.XX, 研报预期 $X.XX (差异 +XX.XX%)",

  "results_summary": "实际数据与研报预期差异的客观描述（量化各项差异）",

  "results_table": [
    {"metric": "Revenue", "actual": "$XX.XXB", "consensus": "$XX.XXB (来源机构)", "delta": "+XX.XX%（vs预期）", "assessment": "YoY +XX.XX%, vs预期差异 +XX.XX%", "importance": "差异原因的客观说明"},
    {"metric": "Operating Income", "actual": "$XX.XXB", "consensus": "$XX.XXB (来源)", "delta": "+XX.XX%（vs预期）", "assessment": "YoY +XX.XX%, vs预期差异 +XX.XX%"},
    {"metric": "Operating Margin", "actual": "XX.XX%", "consensus": "XX.XX% (来源)", "delta": "+/-XX bps（vs预期）", "assessment": "YoY变化 +/-XX bps, vs预期差异 XX bps"},
    {"metric": "EPS (Diluted)", "actual": "$X.XX", "consensus": "$X.XX (来源)", "delta": "+XX.XX%（vs预期）", "assessment": "YoY +XX.XX%, vs预期差异 +XX.XX%"},
    {"metric": "Net Income", "actual": "$XX.XXB", "consensus": "$XX.XXB (来源)", "delta": "+XX.XX%（vs预期）", "assessment": "YoY +XX.XX%, vs预期差异 +XX.XX%"},
    {"metric": "下季指引 Revenue", "actual": "$XX-XXB", "consensus": "$XXB (来源隐含)", "delta": "+XX%（vs预期）", "assessment": "指引范围 vs 研报预期差异"}
  ],

  "results_explanation": "实际数据与预期差异的客观解释，引用管理层表述",

  "drivers_summary": "驱动因素数据汇总",

  "drivers": {
    "demand": {
      "title": "A. 需求/量",
      "metrics": "与需求相关的核心指标",
      "change": "客观变化描述（含数值）",
      "magnitude": "+XX.XX% YoY",
      "reason": "原因"
    },
    "monetization": {
      "title": "B. 变现/单价",
      "metrics": "与变现相关的核心指标",
      "change": "客观变化描述（含数值）",
      "magnitude": "+XX.XX%",
      "reason": "原因"
    },
    "efficiency": {
      "title": "C. 内部效率",
      "metrics": "与效率相关的核心指标",
      "change": "客观变化描述（含数值）",
      "magnitude": "+XX.XX%",
      "reason": "原因"
    }
  },

  "investment_roi": {
    "capex_change": "本期CapEx客观数据及变化",
    "opex_change": "Opex客观数据及变化",
    "investment_direction": "管理层表述的投入方向",
    "roi_evidence": ["ROI数据1（量化）", "ROI数据2（量化）"],
    "management_commitment": "管理层财务承诺原话"
  },

  "sustainability_risks": {
    "sustainable_drivers": ["可持续因素1（数据支撑）", "因素2", "因素3"],
    "main_risks": ["风险因素1（含时间窗口）", "风险因素2", "风险因素3"],
    "checkpoints": ["下季关注指标1", "指标2", "指标3"]
  },

  "comparison_snapshot": {
    "core_revenue": "$XX.XXB (YoY +XX.XX%, vs预期差异 +XX.XX%)",
    "core_profit": "$XX.XXB (YoY +XX.XX%)",
    "guidance": "管理层指引 vs 研报预期",
    "core_driver_quantified": "核心驱动量化",
    "main_risk_quantified": "主要风险量化"
  },

  "research_comparison": {
    "consensus_source": "研报来源机构名称",
    "key_differences": [
      "Revenue实际$XX.XXB vs 预期$XX.XXB，差异+XX.XX%",
      "EPS实际$X.XX vs 预期$X.XX，差异+XX.XX%",
      "其他重要差异项..."
    ],
    "analyst_blind_spots": "研报中未覆盖但财报中出现的重要数据点"
  }
}

【关键规则】
1. 对比数据必须标注来源机构名称
2. delta字段展示vs预期的百分比差异
3. 严禁使用beat/miss/inline/超预期/不及预期等评价词
4. assessment字段只写：YoY变化 + vs预期差异百分比
5. 所有对比必须客观，只展示数据差异和变化方向
6. 所有金额$XX.XXB格式，百分比XX.XX%格式
7. 所有输出内容不要使用大括号{}作为占位符，直接填入具体内容`

// ============================================================
// 分析函数 - 处理PDF/文本格式的财报
// ============================================================

export async function analyzeFinancialReport(
  reportText: string,
  metadata: ReportMetadata,
  researchReportText?: string  // 可选的研报文本
): Promise<AnalysisResult> {
  // Determine company category
  let companyInfo: {
    category: 'AI_APPLICATION' | 'AI_SUPPLY_CHAIN' | 'CONSUMER_GOODS' | 'UNKNOWN'
    categoryName: string
    categoryNameEn: string
    prompt: string
    company?: {
      symbol: string
      name: string
      nameZh: string
    }
  }

  if (metadata.category && (metadata.category === 'AI_APPLICATION' || metadata.category === 'AI_SUPPLY_CHAIN' || metadata.category === 'CONSUMER_GOODS')) {
    const categoryConfig = COMPANY_CATEGORIES[metadata.category]
    companyInfo = {
      category: metadata.category,
      categoryName: categoryConfig.name,
      categoryNameEn: categoryConfig.nameEn,
      prompt: categoryConfig.prompt,
    }
    console.log(`使用用户选择的分类: ${metadata.category}`)
  } else {
    companyInfo = getCompanyCategory(metadata.symbol || metadata.company)
  }

  const hasResearchReport = !!researchReportText && researchReportText.length > 100

  // Truncate text to avoid token limits
  const MAX_FINANCIAL_TEXT = 200000
  const MAX_RESEARCH_TEXT = 100000

  let truncatedReportText = reportText
  if (reportText.length > MAX_FINANCIAL_TEXT) {
    console.log(`财报文本过长 (${reportText.length} 字符), 截断至 ${MAX_FINANCIAL_TEXT} 字符`)
    truncatedReportText = reportText.substring(0, MAX_FINANCIAL_TEXT) + '\n\n[财报内容已截断]'
  }

  let truncatedResearchText = researchReportText || ''
  if (truncatedResearchText.length > MAX_RESEARCH_TEXT) {
    console.log(`研报文本过长 (${truncatedResearchText.length} 字符), 截断至 ${MAX_RESEARCH_TEXT} 字符`)
    truncatedResearchText = truncatedResearchText.substring(0, MAX_RESEARCH_TEXT) + '\n\n[研报内容已截断]'
  }

  console.log(`正在分析 ${metadata.company} (${metadata.symbol})，分类为 ${companyInfo.categoryName}，${hasResearchReport ? '包含研报对比' : '无研报'}`)
  console.log(`财报文本: ${truncatedReportText.length} 字符, 研报文本: ${truncatedResearchText.length} 字符`)

  // Build category-specific context
  const categoryContext = companyInfo.category === 'AI_APPLICATION'
    ? AI_APPLICATION_CONTEXT
    : companyInfo.category === 'CONSUMER_GOODS'
    ? CONSUMER_GOODS_CONTEXT
    : AI_SUPPLY_CHAIN_CONTEXT

  // Build complete system prompt - always objective
  const jsonInstruction = hasResearchReport ? COMPARISON_JSON_OUTPUT : OBJECTIVE_JSON_OUTPUT
  const systemPrompt = OBJECTIVE_EXTRACTION_SYSTEM_PROMPT + '\n\n' + categoryContext + jsonInstruction

  // Build user message
  let userMessage = `公司：${metadata.company} (${metadata.symbol})
报告期：${metadata.period}
公司分类：${companyInfo.categoryName}

=== 财报内容 ===
${truncatedReportText}`

  if (hasResearchReport) {
    userMessage += `

=== 研报内容（市场预期数据来源）===
${truncatedResearchText}

请客观对比财报实际数据与研报中的预期数据，计算各项差异百分比。在results_table的consensus列中标注研报来源。
注意：只展示数据差异，禁止使用beat/miss等评价词。`
  }

  userMessage += `

请严格按JSON格式输出完整分析。
- results_table必须包含5-7行关键财务指标
- 每个字段都必须有详细的客观数据
- 所有内容使用中文
- 严禁任何beat/miss/超预期/投资建议等主观评价`

  // Build JSON schema
  const baseSchema = {
    type: 'object' as const,
    properties: {
      one_line_conclusion: { type: 'string' as const },
      results_summary: { type: 'string' as const },
      results_table: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            metric: { type: 'string' as const },
            actual: { type: 'string' as const },
            consensus: { type: 'string' as const },
            delta: { type: 'string' as const },
            assessment: { type: 'string' as const },
            importance: { type: 'string' as const },
          },
          required: ['metric', 'actual', 'consensus', 'delta', 'assessment'] as const,
        },
      },
      results_explanation: { type: 'string' as const },
      drivers_summary: { type: 'string' as const },
      drivers: {
        type: 'object' as const,
        properties: {
          demand: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              metrics: { type: 'string' as const },
              change: { type: 'string' as const },
              magnitude: { type: 'string' as const },
              reason: { type: 'string' as const },
            },
            required: ['title', 'change', 'magnitude', 'reason'] as const,
          },
          monetization: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              metrics: { type: 'string' as const },
              change: { type: 'string' as const },
              magnitude: { type: 'string' as const },
              reason: { type: 'string' as const },
            },
            required: ['title', 'change', 'magnitude', 'reason'] as const,
          },
          efficiency: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              metrics: { type: 'string' as const },
              change: { type: 'string' as const },
              magnitude: { type: 'string' as const },
              reason: { type: 'string' as const },
            },
            required: ['title', 'change', 'magnitude', 'reason'] as const,
          },
        },
        required: ['demand', 'monetization', 'efficiency'] as const,
      },
      investment_roi: {
        type: 'object' as const,
        properties: {
          capex_change: { type: 'string' as const },
          opex_change: { type: 'string' as const },
          investment_direction: { type: 'string' as const },
          roi_evidence: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          management_commitment: { type: 'string' as const },
        },
        required: ['capex_change', 'opex_change', 'investment_direction', 'roi_evidence', 'management_commitment'] as const,
      },
      sustainability_risks: {
        type: 'object' as const,
        properties: {
          sustainable_drivers: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          main_risks: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          checkpoints: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
        },
        required: ['sustainable_drivers', 'main_risks', 'checkpoints'] as const,
      },
      comparison_snapshot: {
        type: 'object' as const,
        properties: {
          core_revenue: { type: 'string' as const },
          core_profit: { type: 'string' as const },
          guidance: { type: 'string' as const },
          core_driver_quantified: { type: 'string' as const },
          main_risk_quantified: { type: 'string' as const },
        },
        required: ['core_revenue', 'core_profit', 'guidance', 'core_driver_quantified', 'main_risk_quantified'] as const,
      },
    },
    required: [
      'one_line_conclusion',
      'results_summary',
      'results_table',
      'results_explanation',
      'drivers_summary',
      'drivers',
      'investment_roi',
      'sustainability_risks',
      'comparison_snapshot',
    ] as const,
  }

  // Add research_comparison to schema if we have research report
  if (hasResearchReport) {
    (baseSchema.properties as any).research_comparison = {
      type: 'object' as const,
      properties: {
        consensus_source: { type: 'string' as const },
        key_differences: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        analyst_blind_spots: { type: 'string' as const },
      },
      required: ['consensus_source', 'key_differences', 'analyst_blind_spots'] as const,
    };
    (baseSchema.required as any).push('research_comparison')
  }

  const response = await openrouter.chat({
    model: 'google/gemini-3-pro-preview',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'financial_analysis',
        strict: true,
        schema: baseSchema,
      },
    },
    temperature: 0.3,
    max_tokens: 16000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('AI分析返回空结果')
  }

  try {
    const result = JSON.parse(content) as AnalysisResult

    // Add metadata
    result.metadata = {
      company_category: companyInfo.categoryName,
      analysis_timestamp: new Date().toISOString(),
      prompt_version: hasResearchReport ? '4.0-objective-comparison' : '4.0-objective',
      has_research_report: hasResearchReport,
    }

    return result
  } catch (parseError) {
    console.error('解析AI响应失败:', parseError)
    console.error('原始响应:', content)
    throw new Error('解析AI分析结果失败')
  }
}

// ============================================================
// 分析函数 - 处理JSON格式的财务数据（来自数据团队API）
// ============================================================

export async function analyzeJsonFinancialData(
  jsonData: string | object,
  metadata: ReportMetadata,
  researchReportText?: string
): Promise<AnalysisResult> {
  const dataText = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2)

  // Determine company category
  let companyInfo: {
    category: 'AI_APPLICATION' | 'AI_SUPPLY_CHAIN' | 'CONSUMER_GOODS' | 'UNKNOWN'
    categoryName: string
    categoryNameEn: string
    prompt: string
  }

  if (metadata.category && (metadata.category === 'AI_APPLICATION' || metadata.category === 'AI_SUPPLY_CHAIN' || metadata.category === 'CONSUMER_GOODS')) {
    const categoryConfig = COMPANY_CATEGORIES[metadata.category]
    companyInfo = {
      category: metadata.category,
      categoryName: categoryConfig.name,
      categoryNameEn: categoryConfig.nameEn,
      prompt: categoryConfig.prompt,
    }
  } else {
    companyInfo = getCompanyCategory(metadata.symbol || metadata.company)
  }

  const hasResearchReport = !!researchReportText && researchReportText.length > 100

  // Build category-specific context
  const categoryContext = companyInfo.category === 'AI_APPLICATION'
    ? AI_APPLICATION_CONTEXT
    : companyInfo.category === 'CONSUMER_GOODS'
    ? CONSUMER_GOODS_CONTEXT
    : AI_SUPPLY_CHAIN_CONTEXT

  const jsonInputInstruction = `
【输入数据格式说明】
输入数据为JSON格式的财务数据（由数据团队API提供，每日更新）。
请从JSON数据中识别并提取核心财务指标，包括但不限于：
- Revenue / 收入
- Net Income / 净利润
- Operating Income / 营业利润
- EPS / 每股收益
- Operating Margin / 营业利润率
- Gross Margin / 毛利率
- CapEx / 资本支出
- 各业务分部收入
- 指引数据（Guidance）

注意：JSON中的字段名称可能是英文或中文，金额单位可能是百万/十亿/元/美元，请根据上下文正确识别和转换。`

  const jsonInstruction = hasResearchReport ? COMPARISON_JSON_OUTPUT : OBJECTIVE_JSON_OUTPUT
  const systemPrompt = OBJECTIVE_EXTRACTION_SYSTEM_PROMPT + '\n\n' + categoryContext + '\n\n' + jsonInputInstruction + jsonInstruction

  let userMessage = `公司：${metadata.company} (${metadata.symbol})
报告期：${metadata.period}
公司分类：${companyInfo.categoryName}

=== 财务数据（JSON格式，来自数据团队API）===
${dataText}`

  if (hasResearchReport) {
    const truncatedResearch = researchReportText!.length > 100000
      ? researchReportText!.substring(0, 100000) + '\n\n[研报内容已截断]'
      : researchReportText!

    userMessage += `

=== 研报内容（市场预期数据来源）===
${truncatedResearch}

请客观对比JSON中的财务数据与研报预期数据，计算各项差异百分比。
注意：只展示数据差异，禁止beat/miss等评价词。`
  }

  userMessage += `

请从以上JSON数据中提取核心财务指标，严格按JSON格式输出。
- results_table必须包含5-7行关键财务指标
- 所有内容使用中文
- 严禁任何beat/miss/超预期/投资建议等主观评价`

  console.log(`[JSON分析] 正在处理 ${metadata.company} (${metadata.symbol})，分类为 ${companyInfo.categoryName}`)
  console.log(`[JSON分析] JSON数据: ${dataText.length} 字符，${hasResearchReport ? '包含研报对比' : '无研报'}`)

  // Use the same schema as analyzeFinancialReport
  const baseSchema = {
    type: 'object' as const,
    properties: {
      one_line_conclusion: { type: 'string' as const },
      results_summary: { type: 'string' as const },
      results_table: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            metric: { type: 'string' as const },
            actual: { type: 'string' as const },
            consensus: { type: 'string' as const },
            delta: { type: 'string' as const },
            assessment: { type: 'string' as const },
            importance: { type: 'string' as const },
          },
          required: ['metric', 'actual', 'consensus', 'delta', 'assessment'] as const,
        },
      },
      results_explanation: { type: 'string' as const },
      drivers_summary: { type: 'string' as const },
      drivers: {
        type: 'object' as const,
        properties: {
          demand: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              metrics: { type: 'string' as const },
              change: { type: 'string' as const },
              magnitude: { type: 'string' as const },
              reason: { type: 'string' as const },
            },
            required: ['title', 'change', 'magnitude', 'reason'] as const,
          },
          monetization: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              metrics: { type: 'string' as const },
              change: { type: 'string' as const },
              magnitude: { type: 'string' as const },
              reason: { type: 'string' as const },
            },
            required: ['title', 'change', 'magnitude', 'reason'] as const,
          },
          efficiency: {
            type: 'object' as const,
            properties: {
              title: { type: 'string' as const },
              metrics: { type: 'string' as const },
              change: { type: 'string' as const },
              magnitude: { type: 'string' as const },
              reason: { type: 'string' as const },
            },
            required: ['title', 'change', 'magnitude', 'reason'] as const,
          },
        },
        required: ['demand', 'monetization', 'efficiency'] as const,
      },
      investment_roi: {
        type: 'object' as const,
        properties: {
          capex_change: { type: 'string' as const },
          opex_change: { type: 'string' as const },
          investment_direction: { type: 'string' as const },
          roi_evidence: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          management_commitment: { type: 'string' as const },
        },
        required: ['capex_change', 'opex_change', 'investment_direction', 'roi_evidence', 'management_commitment'] as const,
      },
      sustainability_risks: {
        type: 'object' as const,
        properties: {
          sustainable_drivers: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          main_risks: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          checkpoints: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
        },
        required: ['sustainable_drivers', 'main_risks', 'checkpoints'] as const,
      },
      comparison_snapshot: {
        type: 'object' as const,
        properties: {
          core_revenue: { type: 'string' as const },
          core_profit: { type: 'string' as const },
          guidance: { type: 'string' as const },
          core_driver_quantified: { type: 'string' as const },
          main_risk_quantified: { type: 'string' as const },
        },
        required: ['core_revenue', 'core_profit', 'guidance', 'core_driver_quantified', 'main_risk_quantified'] as const,
      },
    },
    required: [
      'one_line_conclusion',
      'results_summary',
      'results_table',
      'results_explanation',
      'drivers_summary',
      'drivers',
      'investment_roi',
      'sustainability_risks',
      'comparison_snapshot',
    ] as const,
  }

  if (hasResearchReport) {
    (baseSchema.properties as any).research_comparison = {
      type: 'object' as const,
      properties: {
        consensus_source: { type: 'string' as const },
        key_differences: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        analyst_blind_spots: { type: 'string' as const },
      },
      required: ['consensus_source', 'key_differences', 'analyst_blind_spots'] as const,
    };
    (baseSchema.required as any).push('research_comparison')
  }

  const response = await openrouter.chat({
    model: 'google/gemini-3-pro-preview',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'financial_analysis',
        strict: true,
        schema: baseSchema,
      },
    },
    temperature: 0.3,
    max_tokens: 16000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('AI分析返回空结果')
  }

  try {
    const result = JSON.parse(content) as AnalysisResult

    result.metadata = {
      company_category: companyInfo.categoryName,
      analysis_timestamp: new Date().toISOString(),
      prompt_version: hasResearchReport ? '4.0-json-comparison' : '4.0-json-objective',
      has_research_report: hasResearchReport,
    }

    return result
  } catch (parseError) {
    console.error('解析AI响应失败:', parseError)
    console.error('原始响应:', content)
    throw new Error('解析AI分析结果失败')
  }
}
