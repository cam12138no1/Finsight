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

// Results table row structure
export interface ResultsTableRow {
  metric: string           // 指标名称
  actual: string           // 实际值
  consensus: string        // 市场预期
  delta: string            // 差异
  assessment: string       // 评估 (Beat/Miss/Inline)
  importance?: string      // 重要性说明
}

// Driver detail structure
export interface DriverDetail {
  title: string            // 标题
  metrics?: string         // 相关指标
  change: string           // 变化描述
  magnitude: string        // 幅度
  reason: string           // 原因分析
}

// Complete analysis result
export interface AnalysisResult {
  // 0) 一句话结论
  one_line_conclusion: string
  
  // 1) 结果层 - 表格形式
  results_summary: string  // 业绩概要
  results_table: ResultsTableRow[]
  results_explanation: string  // 关键解释（指引 vs 预期 + 管理层框架）
  
  // 2) 驱动层
  drivers_summary: string  // 驱动概要
  drivers: {
    demand: DriverDetail      // A. 需求/量
    monetization: DriverDetail // B. 变现/单价
    efficiency: DriverDetail   // C. 内部效率
  }
  
  // 3) 投入与ROI
  investment_roi: {
    capex_change: string       // CapEx变化
    opex_change: string        // Opex变化
    investment_direction: string // 投入方向
    roi_evidence: string[]     // ROI证据列表
    management_commitment: string // 管理层承诺
  }
  
  // 4) 可持续性与风险
  sustainability_risks: {
    sustainable_drivers: string[]
    main_risks: string[]
    checkpoints: string[]
  }
  
  // 5) 模型影响
  model_impact: {
    upgrade_factors: string[]    // 上调因素
    downgrade_factors: string[]  // 下调因素
    logic_chain: string          // 逻辑链
  }
  
  // 6) 投委会判断
  final_judgment: {
    confidence: string          // 更有信心的点
    concerns: string            // 更担心的点
    watch_list: string          // 接下来要盯什么
    net_impact: string          // 净影响 (Strong Beat/Moderate Beat/Inline/Moderate Miss/Strong Miss)
    long_term_narrative: string // 对长期叙事的影响
    recommendation: string      // 建议
  }
  
  // 投委会总结段落
  investment_committee_summary: string
  
  // 7) 横向对比快照 (用于投委会表格)
  comparison_snapshot?: {
    core_revenue: string
    core_profit: string
    guidance: string
    beat_miss: string
    core_driver_quantified: string
    main_risk_quantified: string
    recommendation: string
    position_action: string
    next_quarter_focus: string
  }
  
  // 8) 研报对比分析 (可选，仅当有研报时)
  research_comparison?: {
    consensus_source: string     // 预期来源（研报机构）
    key_differences: string[]    // 关键差异点
    beat_miss_summary: string    // Beat/Miss总结
    analyst_blind_spots: string  // 分析师盲点
  }
  
  // 元数据
  metadata?: {
    company_category: string
    analysis_timestamp: string
    prompt_version: string
    has_research_report?: boolean
  }
}

// 投委会级别分析系统提示词
const INVESTMENT_COMMITTEE_SYSTEM_PROMPT = `你是一名顶级美股/科技股研究分析师（sell-side 写作风格），要产出一份可给投委会/董事会阅读的财报分析。

你的目标不是复述财报，而是回答：
"本次财报是否改变了我们对未来 2–3 年现金流与竞争力的判断？"

【强制写作风格约束】
1. 必须 vs 预期（没有预期就说明并用"隐含预期/历史区间"替代）
2. 必须把 AI/技术从"故事"落到 指标→机制→财务变量
3. 必须识别并剥离 一次性因素（罚款、诉讼、重组、资产减值等）
4. 不允许空泛形容词（"强劲""亮眼"）不带指标
5. 所有结论必须有数据支撑，格式为：指标 + 方向 + 幅度 + 原因`

// AI应用公司专用提示
const AI_APPLICATION_CONTEXT = `【公司类型：AI应用公司】
重点关注维度：
- 用户增长与活跃度（DAU/MAU/DAP）
- 变现效率（ARPU/广告价格/转化率）
- AI对产品的赋能效果（推荐系统/内容生成/广告定向）
- 内容生态与用户时长
- 监管风险（隐私/反垄断/内容审核）`

// AI供应链公司专用提示
const AI_SUPPLY_CHAIN_CONTEXT = `【公司类型：AI供应链公司】
重点关注维度：
- 算力需求与供给（GPU出货/云订单/数据中心扩张）
- 产品周期与ASP（新品发布/定价权/库存周期）
- 客户集中度与订单可见性
- 供应链瓶颈（CoWoS/HBM/先进封装）
- 竞争格局变化（AMD/Intel/自研芯片）`

// 消费品公司专用提示
const CONSUMER_GOODS_CONTEXT = `【公司类型：消费品公司】
重点关注维度：
- 收入增长拆解（量价拆分/同店增长/新店贡献）
- 品牌力与定价权（提价幅度/品牌溢价变化）
- 渠道结构变化（DTC/批发/线上占比）
- 地区结构变化（中国/欧洲/美国/亚太增速差异）
- 库存与供应链效率（库存周转天数/DIO变化）
- 毛利率与成本结构（原材料/物流/汇率影响）
- 消费者行为趋势（消费降级/升级/品类轮换）`

// JSON输出格式 - 无研报版本
const JSON_OUTPUT_INSTRUCTION = `

请严格按照以下JSON格式输出分析结果，所有内容必须使用中文：

{
  "one_line_conclusion": "【一句话结论】核心收入超预期（vs XX预期），增长由XX+XX带动；但XX可能在未来6-12个月压制利润/FCF。注意：不要使用大括号，直接填入具体内容。",
  
  "results_summary": "差异来源拆解：需求端/供给成本端/非经常性因素各贡献多少",
  
  "results_table": [
    {"metric": "Revenue", "actual": "$XX.Xbn", "consensus": "~$XX.Xbn (来源)", "delta": "+X.X%", "assessment": "Beat/Miss/Inline", "importance": "重要性：确认XX并非短期脉冲"},
    {"metric": "Operating Income", "actual": "$XX.Xbn", "consensus": "~$XX.Xbn", "delta": "+X.X%", "assessment": "Beat/Miss/Inline", "importance": "主因：XX"},
    {"metric": "Operating Margin", "actual": "XX.X%", "consensus": "~XX.X%", "delta": "+/-XXbps", "assessment": "扩张/收窄"},
    {"metric": "EPS", "actual": "$X.XX", "consensus": "~$X.XX", "delta": "+X.X%", "assessment": "Beat/Miss/Inline"},
    {"metric": "下季指引 Revenue", "actual": "$XX-XXbn", "consensus": "~$XXbn (隐含)", "delta": "+X%", "assessment": "超/符合/低于预期"},
    {"metric": "FY CapEx 指引", "actual": "$XX-XXbn", "consensus": "~$XXbn", "delta": "+XX%", "assessment": "大幅上调/符合"}
  ],
  
  "results_explanation": "指引 vs 市场隐含预期的关键差异。管理层框架：如'OI绝对值增长'承诺但不设利润率下限。结论：收入与增长节奏好于预期，但XX被主动牺牲以换取XX。",
  
  "drivers_summary": "三大驱动的综合判断",
  
  "drivers": {
    "demand": {
      "title": "A. 需求/量",
      "metrics": "用户/使用量/订单量/出货量/广告展示等（选最相关2-3个）",
      "change": "发生了什么变化：如'广告展示量 +18% YoY，DAP +7% YoY'",
      "magnitude": "+XX% YoY",
      "reason": "为什么：如'推荐系统架构简化 → 可扩展更长行为序列；内容新鲜度权重提升'"
    },
    "monetization": {
      "title": "B. 变现/单价",
      "metrics": "ARPU/价格/转化率/Take rate/毛利率/广告价格等",
      "change": "发生了什么变化：如'平均广告价格 +6% YoY，转化率 +3.5%'",
      "magnitude": "+XX%",
      "reason": "为什么：如'GEM基础模型扩展至Reels；增量归因模型 → 转化+24%'"
    },
    "efficiency": {
      "title": "C. 内部效率",
      "metrics": "人效/算力效率/履约成本/研发效率/单位成本趋势",
      "change": "发生了什么变化：如'工程师人效 +30% YoY；算力效率 近3x'",
      "magnitude": "+XX%",
      "reason": "为什么：如'Agentic coding工具放量；模型整合减少重复算力'"
    }
  },
  
  "investment_roi": {
    "capex_change": "本期CapEx变化及指引：如'FY25 $72bn → FY26指引 $115-135bn (+60%+)'",
    "opex_change": "Opex增长主因拆解：如'基础设施（云+折旧）；AI技术人才（薪酬增速>人头增速）'",
    "investment_direction": "投入指向：如'超大规模训练算力（自建+公有云）；自研芯片MTIA；Meta Superintelligence Labs'",
    "roi_evidence": [
      "已体现的ROI证据1：如'转化率与广告点击提升（直接反映在价格与收入）'",
      "已体现的ROI证据2：如'视频生成工具收入 run-rate $10bn'",
      "已体现的ROI证据3：如'内部生产率提升 → 抑制长期人头膨胀'"
    ],
    "management_commitment": "管理层底线框架：如'仅承诺OI绝对值增长；未承诺FCF正增长/利润率区间 → 现金流可见性缺口仍在'"
  },
  
  "sustainability_risks": {
    "sustainable_drivers": [
      "可持续驱动1：如'推荐系统×LLM融合仍处早期'",
      "可持续驱动2：如'Reels/Threads/WhatsApp广告尚未完全变现'",
      "可持续驱动3：如'AI工具对内降本、对外提效的复利效应'"
    ],
    "main_risks": [
      "风险1：如'资本强度风险：CapEx高位若常态化，FCF中枢下移'",
      "风险2：如'监管风险：EU Less Personalized Ads影响在2H26放大'",
      "风险3：如'边际ROI风险：算力扩张是否仍具高回报尚未验证'"
    ],
    "checkpoints": [
      "检查点1：如'1H26：广告转化率与价格是否继续双升'",
      "检查点2：如'2H26：CapEx实际落点 vs 指引上限'",
      "检查点3：如'FY26：FCF是否仍为正'"
    ]
  },
  
  "model_impact": {
    "upgrade_factors": [
      "上调：如'中期收入CAGR（广告转化与AI工具）'",
      "上调：如'长期竞争壁垒（数据×模型×分发）'"
    ],
    "downgrade_factors": [
      "下调：如'2026-27 FCF'",
      "下调：如'近端利润率'"
    ],
    "logic_chain": "逻辑链：如'财报显示ROI → 上调收入 → 但CapEx前置 → 估值更多依赖终值假设而非近端现金流'"
  },
  
  "final_judgment": {
    "confidence": "我们更有信心的点：如'核心广告业务竞争力与AI驱动增长机制，尤其是转化效率与内容分发层面的系统性优势'",
    "concerns": "我们更担心的点：如'公司主动选择进入高资本强度、低短期现金回报的阶段，未来2-3年FCF确定性下降'",
    "watch_list": "接下来要盯：如'算力与模型规模扩张的边际ROI能否持续高于资本成本'",
    "net_impact": "Strong Beat / Moderate Beat / Inline / Moderate Miss / Strong Miss",
    "long_term_narrative": "对长期叙事的净影响：更强/更弱/不变，以及原因",
    "recommendation": "投资建议：如'超配，但需承受短期现金流波动；更像一只长期看多、短期需承受波动的结构性资产'"
  },
  
  "investment_committee_summary": "【投委会结论】4-6句话收束。示例：本次财报强化了我们对XX核心业务竞争力与AI驱动增长机制的信心，尤其是在XX层面的系统性优势。但同时，公司主动选择进入一个高资本强度、低短期现金回报的阶段，未来2-3年的自由现金流确定性下降。投资判断的关键不在于'AI叙事是否成立'，而在于XX的边际ROI能否持续高于资本成本。在此之前，XX更像一只长期看多、短期需承受现金流波动的结构性资产。",
  
  "comparison_snapshot": {
    "core_revenue": "如'$42.3B (+25% YoY)'",
    "core_profit": "如'$18.2B (+35% YoY)'",
    "guidance": "如'Q1 Rev $43-45B / FY Rev $180-190B'",
    "beat_miss": "Strong Beat / Moderate Beat / Inline / Moderate Miss / Strong Miss",
    "core_driver_quantified": "如'用户+15% + ARPU+8%'",
    "main_risk_quantified": "如'CapEx+40%，ROI待验证'",
    "recommendation": "超配/标配/低配",
    "position_action": "如'加仓5%' / '持有' / '减仓5%'",
    "next_quarter_focus": "如'AI变现率、CapEx ROI'"
  }
}

【关键规则】
1. results_table只保留"能改变判断"的数字（5-7行），不要堆砌所有指标
2. 每个驱动必须回答：发生了什么变化（指标+方向+幅度）+ 为什么
3. ROI证据必须量化，用已经体现的结果证明
4. 风险必须给出时间窗口
5. 检查点必须是可验证/可证伪的具体指标或事件
6. 最终判断必须明确：更强/更弱/不变
7. investment_committee_summary必须是完整的4-6句话段落，可直接用于投委会报告
8. 【重要】所有输出内容不要使用大括号{}作为占位符，直接填入具体内容`

// JSON输出格式 - 有研报对比版本
const JSON_OUTPUT_INSTRUCTION_WITH_RESEARCH = `

请严格按照以下JSON格式输出分析结果，所有内容必须使用中文。
重要：你需要将财报实际数据与研报中的市场预期进行对比分析。

{
  "one_line_conclusion": "【一句话结论】核心收入超预期（vs Morgan Stanley预期），增长由用户增长+ARPU提升带动；但CapEx大幅增加可能在未来6-12个月压制FCF。注意：不要使用大括号，直接填入具体内容。",
  
  "results_summary": "差异来源拆解：需求端/供给成本端/非经常性因素各贡献多少（对比研报预期）",
  
  "results_table": [
    {"metric": "Revenue", "actual": "$XX.Xbn", "consensus": "$XX.Xbn (Morgan Stanley预期)", "delta": "+X.X%", "assessment": "Beat", "importance": "确认XX并非短期脉冲"},
    {"metric": "Operating Income", "actual": "$XX.Xbn", "consensus": "$XX.Xbn (研报预期)", "delta": "-X.X%", "assessment": "Miss", "importance": "低于预期，主因Opex前置"},
    {"metric": "Operating Margin", "actual": "XX.X%", "consensus": "XX.X% (研报预期)", "delta": "-XXbps", "assessment": "收窄"},
    {"metric": "EPS", "actual": "$X.XX", "consensus": "$X.XX (研报预期)", "delta": "+X.X%", "assessment": "Inline"},
    {"metric": "下季指引 Revenue", "actual": "$XX-XXbn", "consensus": "~$XXbn (研报隐含)", "delta": "+X%", "assessment": "超预期"},
    {"metric": "FY CapEx 指引", "actual": "$XX-XXbn", "consensus": "$XXbn (研报预期)", "delta": "+XX%", "assessment": "大幅上调"}
  ],
  
  "results_explanation": "指引 vs 研报预期的关键差异。管理层框架。结论：收入与增长节奏好于研报预期，但XX被主动牺牲。",
  
  "drivers_summary": "三大驱动的综合判断",
  
  "drivers": {
    "demand": {
      "title": "A. 需求/量",
      "metrics": "用户/使用量/订单量/出货量/广告展示等",
      "change": "发生了什么变化",
      "magnitude": "+XX% YoY",
      "reason": "为什么"
    },
    "monetization": {
      "title": "B. 变现/单价",
      "metrics": "ARPU/价格/转化率/Take rate/毛利率/广告价格等",
      "change": "发生了什么变化",
      "magnitude": "+XX%",
      "reason": "为什么"
    },
    "efficiency": {
      "title": "C. 内部效率",
      "metrics": "人效/算力效率/履约成本/研发效率/单位成本趋势",
      "change": "发生了什么变化",
      "magnitude": "+XX%",
      "reason": "为什么"
    }
  },
  
  "investment_roi": {
    "capex_change": "本期CapEx变化及指引",
    "opex_change": "Opex增长主因拆解",
    "investment_direction": "投入指向",
    "roi_evidence": ["ROI证据1", "ROI证据2", "ROI证据3"],
    "management_commitment": "管理层底线框架"
  },
  
  "sustainability_risks": {
    "sustainable_drivers": ["可持续驱动1", "可持续驱动2", "可持续驱动3"],
    "main_risks": ["风险1：类型+时间窗口", "风险2", "风险3"],
    "checkpoints": ["检查点1：时间+指标", "检查点2", "检查点3"]
  },
  
  "model_impact": {
    "upgrade_factors": ["上调：原因1", "上调：原因2"],
    "downgrade_factors": ["下调：原因1", "下调：原因2"],
    "logic_chain": "逻辑链：财报信号 → 假设变化 → 估值影响"
  },
  
  "final_judgment": {
    "confidence": "我们更有信心的点",
    "concerns": "我们更担心的点",
    "watch_list": "接下来要盯什么",
    "net_impact": "Strong Beat / Moderate Beat / Inline / Moderate Miss / Strong Miss",
    "long_term_narrative": "对长期叙事的净影响：更强/更弱/不变",
    "recommendation": "投资建议"
  },
  
  "investment_committee_summary": "【投委会结论】4-6句话收束",
  
  "comparison_snapshot": {
    "core_revenue": "如'$42.3B (+25% YoY)'",
    "core_profit": "如'$18.2B (+35% YoY)'",
    "guidance": "如'Q1 Rev $43-45B / FY Rev $180-190B'",
    "beat_miss": "Strong Beat / Moderate Beat / Inline / Moderate Miss / Strong Miss",
    "core_driver_quantified": "如'用户+15% + ARPU+8%'",
    "main_risk_quantified": "如'CapEx+40%，ROI待验证'",
    "recommendation": "超配/标配/低配",
    "position_action": "如'加仓5%' / '持有' / '减仓5%'",
    "next_quarter_focus": "如'AI变现率、CapEx ROI'"
  },
  
  "research_comparison": {
    "consensus_source": "研报来源机构（如：Morgan Stanley、Goldman Sachs等）",
    "key_differences": [
      "差异点1：研报预期XX，实际YY，差异原因...",
      "差异点2：研报预期XX，实际YY，差异原因...",
      "差异点3：研报预期XX，实际YY，差异原因..."
    ],
    "beat_miss_summary": "总体：X项超预期，Y项不及预期，Z项符合预期",
    "analyst_blind_spots": "分析师可能忽略的点"
  }
}

【关键规则】
1. results_table只保留"能改变判断"的数字
2. 每个驱动必须回答：发生了什么变化 + 为什么
3. ROI证据必须量化
4. 风险必须给出时间窗口
5. research_comparison必须详细对比财报实际与研报预期的差异
6. investment_committee_summary必须是完整的4-6句话段落
7. 【重要】所有输出内容不要使用大括号{}作为占位符，直接填入具体内容`

export async function analyzeFinancialReport(
  reportText: string,
  metadata: ReportMetadata,
  researchReportText?: string  // 可选的研报文本
): Promise<AnalysisResult> {
  // Determine company category - use override if provided, otherwise auto-detect
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
    // Use the user-selected category
    const categoryConfig = COMPANY_CATEGORIES[metadata.category]
    companyInfo = {
      category: metadata.category,
      categoryName: categoryConfig.name,
      categoryNameEn: categoryConfig.nameEn,
      prompt: categoryConfig.prompt,
    }
    console.log(`使用用户选择的分类: ${metadata.category}`)
  } else {
    // Auto-detect based on company symbol/name
    companyInfo = getCompanyCategory(metadata.symbol || metadata.company)
  }
  
  const hasResearchReport = !!researchReportText && researchReportText.length > 100
  
  // Truncate text to avoid token limits
  // Gemini 3 Pro Preview has 1M token context (~4M chars)
  // Use generous limits: ~200k chars for financial (~50k tokens), ~100k for research (~25k tokens)
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
  
  // Build complete system prompt based on whether we have research report
  const jsonInstruction = hasResearchReport ? JSON_OUTPUT_INSTRUCTION_WITH_RESEARCH : JSON_OUTPUT_INSTRUCTION
  const systemPrompt = INVESTMENT_COMMITTEE_SYSTEM_PROMPT + '\n\n' + categoryContext + jsonInstruction
  
  // Build user message with optional research report
  let userMessage = `公司：${metadata.company} (${metadata.symbol})
报告期：${metadata.period}
公司分类：${companyInfo.categoryName}
市场预期基准：${JSON.stringify(metadata.consensus || {}, null, 2)}

=== 财报内容 ===
${truncatedReportText}`

  if (hasResearchReport) {
    userMessage += `

=== 研报内容（市场预期来源）===
${truncatedResearchText}

请重点对比财报实际数据与研报中的市场预期，分析Beat/Miss情况及原因。在results_table的consensus列中标注研报来源。`
  }

  userMessage += `

请严格按JSON格式输出完整分析。
- results_table必须包含5-7行关键财务指标对比
- 每个字段都必须有详细内容
- investment_committee_summary必须是完整的4-6句话段落
- 所有内容使用中文`

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
      model_impact: {
        type: 'object' as const,
        properties: {
          upgrade_factors: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          downgrade_factors: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          logic_chain: { type: 'string' as const },
        },
        required: ['upgrade_factors', 'downgrade_factors', 'logic_chain'] as const,
      },
      final_judgment: {
        type: 'object' as const,
        properties: {
          confidence: { type: 'string' as const },
          concerns: { type: 'string' as const },
          watch_list: { type: 'string' as const },
          net_impact: { type: 'string' as const },
          long_term_narrative: { type: 'string' as const },
          recommendation: { type: 'string' as const },
        },
        required: ['confidence', 'concerns', 'watch_list', 'net_impact', 'long_term_narrative', 'recommendation'] as const,
      },
      investment_committee_summary: { type: 'string' as const },
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
      'model_impact',
      'final_judgment',
      'investment_committee_summary',
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
        beat_miss_summary: { type: 'string' as const },
        analyst_blind_spots: { type: 'string' as const },
      },
      required: ['consensus_source', 'key_differences', 'beat_miss_summary', 'analyst_blind_spots'] as const,
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
      prompt_version: hasResearchReport ? '3.0-investment-committee-research' : '3.0-investment-committee',
      has_research_report: hasResearchReport,
    }
    
    return result
  } catch (parseError) {
    console.error('解析AI响应失败:', parseError)
    console.error('原始响应:', content)
    throw new Error('解析AI分析结果失败')
  }
}
