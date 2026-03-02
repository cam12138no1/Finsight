# FinSight AI — 智析财报

> **AI 驱动的美股科技公司财报深度分析平台**
> 面向投委会 / 买方分析师，产出 sell-side 写作风格的专业财报研究报告。

---

## 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [整体架构](#整体架构)
- [目录结构](#目录结构)
- [核心功能](#核心功能)
- [AI 分析框架](#ai-分析框架)
- [数据流与关键路径](#数据流与关键路径)
- [API 接口列表](#api-接口列表)
- [核心代码解析](#核心代码解析)
- [认证与权限](#认证与权限)
- [数据存储](#数据存储)
- [环境变量配置](#环境变量配置)
- [本地开发](#本地开发)
- [部署](#部署)

---

## 项目概述

FinSight AI（智析财报）是一个针对美股 AI 科技公司的专业财报分析工具，核心目标是：

> **"本次财报是否改变了我们对未来 2–3 年现金流与竞争力的判断？"**

用户上传季报（10-Q）/ 年报（10-K）PDF，可选附上卖方研报作为市场预期基准，系统通过 Google Gemini 3 Pro Preview 大模型完成投委会级别的深度分析，输出包含六大层次的结构化 JSON 报告。

### 支持的公司类型

| 类型 | 代表公司 |
|------|----------|
| **AI 应用公司** | META, GOOGL/GOOG, MSFT, AMZN, AAPL, NFLX, CRM, SNOW, PLTR |
| **AI 供应链公司** | NVDA, AMD, INTC, TSM, AVGO, QCOM, MU, AMAT, LRCX, KLAC, ASML, MRVL, ARM |

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) + TypeScript 5 |
| UI | Tailwind CSS + Radix UI + Lucide React |
| 认证 | NextAuth.js v4（JWT 策略，7 天有效期） |
| AI 模型 | Google Gemini 3 Pro Preview（via OpenRouter） |
| 文件存储 | Vercel Blob（支持 500MB 单文件） |
| 数据库 | Vercel PostgreSQL（可选）+ Vercel Blob JSON（主存储） |
| PDF 解析 | pdf-parse（最多 200 页 / 30 万字符） |
| Excel 导出 | xlsx (SheetJS) |
| PDF 导出 | jsPDF + html2canvas |
| 图表 | Recharts |
| 国际化 | next-intl（中/英双语，默认中文） |
| 部署 | Vercel Serverless（maxDuration=300s，iad1 + hkg1） |

---

## 整体架构

```
┌─────────────────────────────────────────────────────┐
│                    浏览器 (Next.js Client)            │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ 登录页面  │  │  仪表盘主页   │  │  多公司对比页  │ │
│  └──────────┘  └──────────────┘  └───────────────┘ │
│       ↓               ↓                  ↓          │
│  ┌──────────────────────────────────────────────┐   │
│  │          NextAuth.js (JWT Session)           │   │
│  └──────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────┘
                         │ HTTP API
┌────────────────────────▼────────────────────────────┐
│                 Next.js API Routes                   │
│                                                     │
│  /api/reports/analyze  ←── 核心分析入口 (5分钟超时)  │
│  /api/blob/upload-token←── Blob 客户端上传 Token     │
│  /api/dashboard        ←── 读取用户分析列表           │
│  /api/comparison       ←── 多公司横向对比             │
│  /api/custom-questions ←── 自定义追问                │
│  /api/admin/*          ←── 管理员操作                │
└────┬──────────────────┬──────────────────────────────┘
     │                  │
     ▼                  ▼
┌─────────┐    ┌────────────────────────────────────┐
│ Vercel  │    │         业务逻辑层 (lib/)            │
│  Blob   │    │                                    │
│         │    │  document-parser.ts  ←── PDF→文本  │
│ 文件存储 │    │  ai/extractor.ts    ←── 元数据提取  │
│ 分析JSON│    │  ai/analyzer.ts     ←── 投委会分析  │
│ 路径隔离│    │  ai/prompts.ts      ←── 提示词工程  │
└─────────┘    │  openrouter.ts      ←── AI 客户端  │
               │  store.ts           ←── 存储抽象层  │
               │  ratelimit.ts       ←── 速率限制   │
               │  session-validator.ts←── Session验证│
               └────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ OpenRouter API        │
                    │ → Gemini 3 Pro Preview│
                    │   (1M token 上下文)   │
                    └───────────────────────┘
```

---

## 目录结构

```
Finsight/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 根路由（重定向到 /dashboard）
│   ├── layout.tsx                # 全局布局（Providers、字体、i18n）
│   ├── globals.css               # 全局样式
│   ├── auth/
│   │   └── signin/page.tsx       # 登录页面
│   ├── dashboard/
│   │   ├── layout.tsx            # Dashboard 布局（侧边栏 + Header）
│   │   ├── page.tsx              # 主仪表盘（财报列表 + 上传入口）
│   │   ├── reports/page.tsx      # 报告管理页
│   │   └── comparison/page.tsx   # 多公司横向对比（投委会表格）
│   └── api/
│       ├── auth/[...nextauth]/   # NextAuth.js 路由
│       ├── blob/upload-token/    # Vercel Blob 客户端上传 Token
│       ├── reports/
│       │   ├── analyze/route.ts  # ★ 核心：AI 分析触发接口（5分钟超时）
│       │   ├── upload/route.ts   # 旧版直传分析（已被 Blob 模式取代）
│       │   ├── [id]/route.ts     # 单条分析 GET/DELETE
│       │   ├── status/route.ts   # 分析状态查询
│       │   └── clean/route.ts    # 清理过期处理中记录
│       ├── dashboard/route.ts    # 获取用户分析列表（带速率限制）
│       ├── comparison/route.ts   # 多公司对比分析
│       ├── custom-questions/     # 自定义追问 Q&A
│       └── admin/                # 管理员接口（迁移/清空）
│
├── components/
│   ├── dashboard/
│   │   ├── dashboard-client.tsx  # 仪表盘主客户端组件（轮询 + 过滤）
│   │   ├── upload-modal.tsx      # ★ 上传弹窗（文件上传 + 分析触发）
│   │   ├── analysis-modal.tsx    # ★ 分析结果展示弹窗（含导出）
│   │   ├── analysis-view.tsx     # 分析内容渲染（Markdown + 表格）
│   │   ├── report-list.tsx       # 历史分析列表
│   │   ├── processing-tracker.tsx# 处理中任务追踪
│   │   ├── header.tsx            # 顶部导航栏
│   │   └── sidebar.tsx           # 左侧导航栏
│   ├── ui/                       # 基础 UI 组件（Button、Card、Toast 等）
│   ├── language-switcher.tsx     # 中/英切换
│   ├── error-boundary.tsx        # 错误边界
│   └── providers.tsx             # NextAuth SessionProvider
│
├── lib/
│   ├── ai/
│   │   ├── prompts.ts            # ★★★ 提示词工程（投委会级分析框架）
│   │   ├── analyzer.ts           # ★★★ AI 分析器（调用 OpenRouter + JSON Schema）
│   │   └── extractor.ts          # 元数据提取（公司名/代码/报告期）
│   ├── db/
│   │   ├── schema.sql            # PostgreSQL 基础表结构
│   │   ├── schema_update.sql     # V2 增量 DDL
│   │   ├── schema_users.sql      # 用户表
│   │   └── queries.ts            # 数据库查询封装
│   ├── auth.ts                   # ★ NextAuth 配置（Demo 用户 + DB 用户双模式）
│   ├── store.ts                  # ★ 用户隔离存储（Vercel Blob JSON）
│   ├── document-parser.ts        # PDF/Excel/文本解析
│   ├── openrouter.ts             # OpenRouter API 客户端（含超时/重试/错误处理）
│   ├── ratelimit.ts              # 内存速率限制器
│   ├── session-validator.ts      # 增强 Session 验证（带日志追踪）
│   ├── fetch-retry.ts            # 带指数退避的 fetch 重试
│   ├── file-validation.ts        # 文件魔数验证（防 MIME 欺骗）
│   ├── export-excel.ts           # Excel 导出（6 个 Sheet）
│   ├── env.ts                    # 环境变量验证
│   └── utils.ts                  # 工具函数（cn 等）
│
├── hooks/
│   └── use-session-monitor.ts    # Session 状态监控 Hook（到期前提醒）
│
├── types/
│   ├── next-auth.d.ts            # NextAuth Session 类型扩展（id/role/permissions）
│   └── pdf-parse.d.ts            # pdf-parse 类型声明
│
├── messages/                     # i18n 翻译文件（中/英）
│   ├── zh.json                   # 中文（默认）
│   └── en.json                   # 英文
│
├── public/                       # 静态资源
├── scripts/
│   └── migrate-data.ts           # 历史数据迁移脚本
├── next.config.mjs               # Next.js 配置
├── tailwind.config.js            # Tailwind 配置
├── tsconfig.json                 # TypeScript 配置
└── vercel.json                   # Vercel 部署配置（超时/区域）
```

---

## 核心功能

### 1. 财报上传与 AI 分析

用户通过上传弹窗（`components/dashboard/upload-modal.tsx`）提交：

- **财报文件**（必填）：季报 10-Q、年报 10-K，支持多文件，单文件最大 500MB
- **研报文件**（可选）：卖方研报，用于提供 consensus 预期基准
- **报告期间**：年份（当年前后一年）+ 季度选择器
- **公司分类**：AI 应用公司 / AI 供应链公司（决定分析侧重维度）

文件通过 Vercel Blob 客户端 SDK 直传云端，完全绕过 Next.js Serverless 的 4.5MB 请求体限制。

### 2. 六层投委会级分析报告

每次分析产出完整的结构化 JSON，包含以下层次：

| 层次 | 字段 | 内容 |
|------|------|------|
| **0. 一句话结论** | `one_line_conclusion` | 核心收入 Beat/Miss + 增长驱动 + 关键风险 |
| **1. 结果层** | `results_table` | Revenue / OI / EPS / 指引 vs 预期对比表（含 Beat/Miss 评级） |
| **2. 驱动层** | `drivers` | 需求/量、变现/单价、内部效率 三维分解 |
| **3. 投入与 ROI** | `investment_roi` | CapEx 变化、OpEx 拆解、ROI 证据、管理层底线承诺 |
| **4. 可持续性与风险** | `sustainability_risks` | 可持续驱动、主要风险（含时间窗口）、未来检查点 |
| **5. 模型影响 + 投委会判断** | `model_impact` + `final_judgment` | 估值假设上调/下调因素、4-6 句投委会结论段落 |

**Beat/Miss 评级标准（系统强制执行）：**

| 评级 | Beat/Miss 幅度 |
|------|----------------|
| Strong Beat | ≥ +5% vs consensus |
| Moderate Beat | +1% ~ +5% |
| Inline | -1% ~ +1% |
| Moderate Miss | -1% ~ -5% |
| Strong Miss | ≤ -5% |

### 3. 研报对比分析

当用户同时上传财报和研报时，额外输出 `research_comparison` 字段：
- 从研报中提取 consensus 预期数据（标注机构来源）
- 逐项计算 Beat/Miss（含公式验证过程）
- 识别"分析师盲点"

### 4. 多公司横向对比（投委会表格）

`/dashboard/comparison` 页面从用户所有已分析报告中提取 `comparison_snapshot`，以宽表格呈现：
- 核心收入、核心利润、指引
- Beat/Miss 评级、核心驱动量化、主要风险量化
- 投资建议（超配/标配/低配）、仓位动作、下季关注点

统计卡片显示：总计 / Beat 数 / Miss 数 / 超配 / 标配 / 低配 分布。支持 CSV 导出全部 32 个字段。

### 5. 自定义追问

`/api/custom-questions` 接口支持针对已分析报告提出自定义问题，AI 返回结构化回答，保留历史 Q&A 记录。

### 6. 数据导出

- **Excel 导出**（`lib/export-excel.ts`）：6 个 Sheet（执行摘要、业绩对比、驱动因素、投资 ROI、风险检查点、模型影响）
- **PDF 导出**：通过 html2canvas + jsPDF 截图生成

---

## AI 分析框架

### 提示词设计（`lib/ai/prompts.ts`）

提示词工程是整个系统的核心，采用多层强制约束结构：

**数值精度规则（强制）：**
```
金额：$XX.XXB 格式（必须两位小数，如 $113.83B）
百分比：XX.XX% 格式（必须两位小数，正数带 + 号，如 +18.00%）
EPS：$X.XX 格式（如 $2.82）
```

**分析前强制数据提取流程：**
1. 从财报原文直接复制关键数值（禁止推测或心算）
2. 数据冲突时优先级：财报原文 > Non-GAAP Reconciliation 表 > 研报 consensus
3. 未披露数据填写"数据未披露"（不得估算）

**写作风格约束：**
- 必须 vs 预期（无预期时用历史区间替代，并标注）
- AI/技术从"故事"落到：指标 → 机制 → 财务变量
- 识别并剥离一次性因素（罚款、重组、资产减值等）
- 禁止无数据支撑的空泛形容词（"强劲""亮眼"）

**输出前自检步骤（提示词内嵌）：**
1. 检查所有 `B` 前金额是否为 `$XX.XXB` 格式
2. 检查所有 `%` 是否为 `XX.XX%` 格式
3. 检查 results_table 与 comparison_snapshot 数值是否一致
4. 验算 YoY% 和 Beat/Miss% 计算结果

**公司类型差异化分析侧重：**

```
AI 应用公司：DAU/MAU/DAP → ARPU → 广告价格/转化率 → AI 渗透率
            重点：用户增长 × 变现效率 × AI 赋能效果

AI 供应链公司：分部收入拆分 → 量价拆分 → 毛利率变化 → CapEx/DIO
              重点：算力需求 × 产品周期 × 供应链瓶颈
```

### 调用链（`lib/ai/analyzer.ts`）

```typescript
analyzeFinancialReport(reportText, metadata, researchReportText?)
  ↓
  // 1. 确定公司分类（用户选择覆盖 or 自动识别股票代码）
  companyInfo = metadata.category
    ? COMPANY_CATEGORIES[metadata.category]
    : getCompanyCategory(metadata.symbol)
  ↓
  // 2. 构建提示词
  systemPrompt = INVESTMENT_COMMITTEE_SYSTEM_PROMPT
    + categoryContext (AI应用/供应链专用上下文)
    + JSON_OUTPUT_INSTRUCTION (含/不含研报版本)
  ↓
  // 3. 文本截断（防超 token 限制）
  financialText → max 200,000 chars
  researchText  → max 100,000 chars
  ↓
  // 4. 调用 OpenRouter → Gemini 3 Pro Preview
  openrouter.chat({
    model: 'google/gemini-3-pro-preview',
    response_format: {
      type: 'json_schema',
      json_schema: { strict: true, schema: baseSchema }
    },
    temperature: 0.3,   // 降低随机性，保证数值可复现
    max_tokens: 16000
  })
  ↓
  // 5. 解析 JSON + 附加 metadata → 返回 AnalysisResult
```

---

## 数据流与关键路径

### 完整分析流程

```
前端上传弹窗
    ↓
[1] 前端 Session 预验证（GET /api/auth/session）
    ↓
[2] 文件 → Vercel Blob（客户端直传，支持 500MB）
    upload(pathname, file, { handleUploadUrl: '/api/blob/upload-token' })
    ↓
[3] POST /api/reports/analyze（传 Blob URL 列表）
    ↓
    [3-1] Session 验证（第1次）
    [3-2] 速率限制检查（5次/分钟）
    [3-3] 解析请求体（financialFiles URLs, category, fiscalYear, fiscalQuarter）
    [3-4] Session 验证（第2次，防并发 Session 漂移）
    [3-5] requestId 去重检查（防重复提交）
    [3-6] 从 Blob URL 下载文件 Buffer（带重试）
    [3-7] PDF 文本提取（pdf-parse，最多200页/30万字符）
    [3-8] AI 元数据提取（公司名/代码/报告期）
    [3-9] Session 验证（第3次，写入记录前）
    [3-10] 再次去重检查（防并发竞争）
    [3-11] 创建"处理中"记录到 Vercel Blob
    [3-12] ★ analyzeFinancialReport() → Gemini 3 Pro（最长5分钟）
    [3-13] 更新记录（将分析结果写回 Blob JSON）
    ↓
[4] 前端收到响应（或超时后切换轮询 /api/dashboard）
    ↓
[5] 刷新仪表盘列表，显示新分析结果
```

### 超时降级机制

前端对分析 API 设置 120 秒超时，超时后自动切换为轮询模式：
- 每 3 秒查询 `/api/dashboard`
- 查找 `request_id` 匹配的记录
- 最长轮询 5 分钟
- 发现完成记录即视为成功

### 用户数据隔离

**存储路径格式：** `analyses/user_{userId}/req_{requestId}.json`

双重隔离验证：
1. **路径级别**：`list({ prefix: 'analyses/user_{userId}/' })` 只返回该用户目录
2. **数据级别**：读取后校验 `analysis.user_id === userId`，不一致则拒绝并记录告警

---

## API 接口列表

| 方法 | 路径 | 说明 | 超时 | 认证 |
|------|------|------|------|------|
| POST | `/api/reports/analyze` | 触发 AI 分析（核心接口） | 300s | 必须 |
| POST | `/api/blob/upload-token` | 获取 Vercel Blob 上传 Token | 60s | 必须 |
| GET | `/api/dashboard` | 获取当前用户所有分析记录 | 60s | 必须 |
| GET | `/api/reports` | 按公司分组列出报告 | 60s | 必须 |
| GET | `/api/reports/[id]` | 获取单条分析详情 | 60s | 必须 |
| DELETE | `/api/reports/[id]` | 删除单条分析 | 60s | 必须 |
| GET | `/api/reports/status` | 查询处理状态 | 60s | 必须 |
| POST | `/api/comparison` | 多公司横向对比（AI 生成） | 300s | 必须 |
| GET | `/api/comparison` | 获取对比历史 | 60s | 必须 |
| POST | `/api/custom-questions` | 自定义追问 | 180s | 必须 |
| GET | `/api/custom-questions` | 获取 Q&A 历史 | 60s | 必须 |
| POST | `/api/admin/migrate` | 历史数据迁移（管理员） | 60s | 必须 |
| POST | `/api/admin/clear` | 清空指定用户数据（管理员） | 60s | 必须 |
| POST | `/api/admin/clear-all` | 清空全部数据（管理员） | 60s | 必须 |
| GET | `/api/debug/blobs` | 调试：查看 Blob 原始列表 | 60s | 必须 |

**速率限制（内存级，按用户隔离）：**

| 接口类型 | 限制 |
|----------|------|
| 分析请求 | 5 次 / 分钟 / 用户 |
| 文件上传 | 10 次 / 分钟 / 用户 |
| 仪表盘查询 | 60 次 / 分钟 / 用户 |

---

## 核心代码解析

### `lib/ai/analyzer.ts` — AI 分析器

```typescript
// 核心接口：完整分析结果结构
export interface AnalysisResult {
  one_line_conclusion: string          // 一句话结论
  results_summary: string              // 差异来源拆解
  results_table: ResultsTableRow[]     // 结果对比表（5-7行）
  results_explanation: string          // 指引 vs 预期差异说明
  drivers_summary: string              // 驱动综合判断
  drivers: {
    demand: DriverDetail               // A. 需求/量（指标/变化/原因）
    monetization: DriverDetail         // B. 变现/单价
    efficiency: DriverDetail           // C. 内部效率
  }
  investment_roi: {                    // CapEx/OpEx/ROI 证据
    capex_change: string
    opex_change: string
    investment_direction: string
    roi_evidence: string[]
    management_commitment: string
  }
  sustainability_risks: {              // 可持续性与风险
    sustainable_drivers: string[]
    main_risks: string[]               // 每条含时间窗口
    checkpoints: string[]              // 可验证/可证伪的检查点
  }
  model_impact: {                      // 估值假设影响
    upgrade_factors: string[]
    downgrade_factors: string[]
    logic_chain: string
  }
  final_judgment: {                    // 投委会判断
    confidence: string
    concerns: string
    watch_list: string
    net_impact: string                 // Strong Beat / ... / Strong Miss
    long_term_narrative: string
    recommendation: string             // 超配/标配/低配
  }
  investment_committee_summary: string // 4-6句投委会结论
  comparison_snapshot?: { ... }        // 横向对比快照（32个字段）
  research_comparison?: { ... }        // 研报对比（有研报时填充）
  metadata?: { ... }                   // 分类/时间戳/提示词版本
}

// JSON Schema 强制结构化输出（strict: true）
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'financial_analysis',
    strict: true,
    schema: baseSchema  // 完整 JSON Schema，含所有必填字段
  }
}
```

### `lib/store.ts` — 用户隔离存储

```typescript
class AnalysisStore {
  private memoryStore: Map<string, StoredAnalysis>  // 开发模式 fallback
  private useBlob: boolean  // 是否使用 Vercel Blob

  // 路径格式：analyses/user_{userId}/req_{requestId}.json
  private getUserPath(userId, requestId): string
  private getUserPrefix(userId): string

  // 原子性写入（requestId 作为唯一键，避免并发重复）
  async addWithRequestId(userId, requestId, analysis): Promise<StoredAnalysis>

  // 读取时双重验证：路径前缀隔离 + user_id 字段校验
  async getAll(userId): Promise<StoredAnalysis[]>
  async get(userId, id): Promise<StoredAnalysis | undefined>
  async update(userId, id, updates): Promise<StoredAnalysis | undefined>
  async delete(userId, id): Promise<boolean>

  // 清理过期的"处理中"任务（默认超过30分钟视为过期）
  async deleteStale(userId, maxAgeMinutes = 30): Promise<number>

  // 统计信息
  async getUserStats(userId): Promise<{ total, processing, completed, failed }>
}

export const analysisStore = new AnalysisStore()  // 单例
```

### `lib/ai/prompts.ts` — 公司分类与提示词

```typescript
// 自动识别公司分类（可被用户手动覆盖）
export function getCompanyCategory(symbolOrName: string): {
  category: 'AI_APPLICATION' | 'AI_SUPPLY_CHAIN' | 'UNKNOWN'
  categoryName: string         // "AI应用公司" / "AI供应链公司"
  prompt: string               // 类型专用分析重点提示
  company?: { symbol, name, nameZh }
}

// AI 应用公司列表（10家）：META, GOOGL, GOOG, MSFT, AMZN, AAPL, NFLX, CRM, SNOW, PLTR
// AI 供应链公司列表（13家）：NVDA, AMD, INTC, TSM, AVGO, QCOM, MU, AMAT, LRCX, KLAC, ASML, MRVL, ARM
// 未识别公司默认归类为 AI 应用公司

// 按是否有研报返回不同版本的输出格式指令
export const getAnalysisPrompt = (
  companyCategory: string,
  hasResearchReport: boolean
): string
```

### `app/api/reports/analyze/route.ts` — 核心分析接口

```typescript
export const runtime = 'nodejs'
export const maxDuration = 300  // Vercel 最长 5 分钟

export async function POST(request: NextRequest) {
  // 三重 Session 验证（防并发 Session 漂移）
  const session1 = await validateSession(request)  // 入口验证
  const session2 = await validateSession(request)  // 解析请求后再验证
  const session3 = await validateSession(request)  // 写入记录前最终验证

  // requestId 两次去重检查（防并发重复创建）
  const preCheck = await analysisStore.getByRequestId(userId, requestId)
  // ... 下载 Blob → 提取文本 → 提取元数据 ...
  const doubleCheck = await analysisStore.getByRequestId(userId, requestId)

  // AI 分析（最核心调用）
  const result = await analyzeFinancialReport(
    financialText,
    { company, symbol, period, fiscalYear, fiscalQuarter, category },
    researchText || undefined
  )

  // 失败时更新记录状态，前端可据此显示错误
  if (error && processingId) {
    await analysisStore.update(userId, processingId, {
      processing: false,
      error: error.message
    })
  }
}
```

### `components/dashboard/upload-modal.tsx` — 上传弹窗

```typescript
// 防重复提交：使用 ref 而非 state（避免 React 闭包陷阱）
const isSubmittingRef = useRef(false)
const currentRequestIdRef = useRef<string | null>(null)
const abortControllerRef = useRef<AbortController | null>(null)

// 超时降级策略
const FETCH_TIMEOUT = 120000  // 2分钟请求超时
const POLL_INTERVAL = 3000   // 3秒轮询间隔
const MAX_POLL_TIME = 300000  // 最长轮询5分钟

// 文件上传：Vercel Blob 客户端直传（绕过 4.5MB 限制）
const uploadFileToBlob = async (file: File, prefix: string) => {
  return await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/blob/upload-token',
  })
  // 内置 3 次重试，指数退避（1s, 2s, 3s）
}
```

---

## 认证与权限

系统采用 NextAuth.js Credentials Provider + JWT Session，支持双模式：

### 用户角色

| 角色 | 权限 |
|------|------|
| `admin` | read, write, delete, admin |
| `analyst` | read, write |
| `viewer` | read |

### 认证模式

| 模式 | 触发条件 | 说明 |
|------|----------|------|
| **Demo 模式** | 未配置 `DATABASE_URL` | 使用硬编码用户，无需数据库 |
| **数据库模式** | 配置了 `DATABASE_URL` | 查询 Vercel PostgreSQL `users` 表 |
| **自动 Fallback** | 数据库不可用 / 用户不在 DB 中 | 自动回退到 Demo 用户验证 |

### 预置 Demo 用户

| 账号 | 密码 | 角色 |
|------|------|------|
| admin@example.com | admin123 | admin |
| analyst1@finsight.internal | Analyst1! | analyst |
| analyst2@finsight.internal | Analyst2! | analyst |
| analyst3@finsight.internal | Analyst3! | analyst |
| viewer@finsight.internal | Viewer1! | viewer |

### Session 监控

`hooks/use-session-monitor.ts` 每 60 秒检查一次 Session 状态：
- 距到期 5 分钟时显示 Toast 警告
- 到期后自动调用 `signOut()`

---

## 数据存储

### Vercel Blob（主存储）

分析结果以 JSON 文件形式存储，按用户严格隔离：

```
blob://
└── analyses/
    └── user_{userId}/
        ├── req_{requestId_1}.json   # 分析结果（含完整 StoredAnalysis）
        ├── req_{requestId_2}.json
        └── ...

uploads/
├── financial/
│   └── {timestamp}_{filename}.pdf  # 财报原始文件
└── research/
    └── {timestamp}_{filename}.pdf  # 研报原始文件
```

### Vercel PostgreSQL（可选，用于用户管理）

数据库主要用于生产环境的用户认证，包含 5 张表：

| 表名 | 说明 |
|------|------|
| `users` | 用户账号（email/password_hash/role/permissions） |
| `companies` | 公司基础信息（symbol/name/sector） |
| `financial_reports` | 报告记录（关联公司/期间/文档URL） |
| `financial_data` | 财务指标数据 |
| `analysis_results` | 分析结果（JSONB） |

Schema 详见 `lib/db/schema.sql` 和 `lib/db/schema_update.sql`。

### 内存存储（开发 Fallback）

未配置 `BLOB_READ_WRITE_TOKEN` 时，`AnalysisStore` 自动使用内存 `Map` 存储（服务重启后数据丢失，仅用于本地开发）。

---

## 环境变量配置

```bash
# ★ 必须配置
NEXTAUTH_SECRET=your-random-secret-min-32-chars  # JWT 签名密钥（建议 openssl rand -base64 32 生成）
OPENROUTER_API_KEY=sk-or-v1-...                  # OpenRouter API Key（用于访问 Gemini 3 Pro）
NEXTAUTH_URL=https://your-domain.vercel.app      # 应用公开 URL

# Vercel 部署时自动注入
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...         # Vercel Blob 访问 Token（未设置时降级为内存存储）

# ★ 可选：数据库（用于持久化用户管理）
DATABASE_URL=postgresql://user:pass@host/db      # Vercel PostgreSQL 连接串
                                                 # 未设置时使用 Demo 用户模式

# 开发环境
NODE_ENV=development
```

---

## 本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.local.template .env.local
# 至少填写 NEXTAUTH_SECRET 和 OPENROUTER_API_KEY

# 3. 启动开发服务器
pnpm dev
# 访问 http://localhost:3000

# 4. 使用 Demo 账号登录（无需数据库）
#    admin@example.com / admin123

# 可选：类型检查
pnpm type-check

# 可选：数据库迁移（需配置 DATABASE_URL）
pnpm db:migrate

# 注意：大文件解析可能触发 EMFILE 错误，建议运行：
# ulimit -n 10000
```

---

## 部署

项目针对 Vercel 平台优化：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 一键部署（首次需登录并关联项目）
vercel deploy --prod
```

**Vercel 控制台必须配置的环境变量：**
1. `NEXTAUTH_SECRET`（随机字符串，≥32位）
2. `OPENROUTER_API_KEY`
3. `BLOB_READ_WRITE_TOKEN`（Vercel Blob 控制台创建）
4. `NEXTAUTH_URL`（填写实际 `https://xxx.vercel.app`）

**`vercel.json` 关键配置：**
- 部署区域：`iad1`（美东）+ `hkg1`（香港）
- 分析接口：`maxDuration: 300`（5 分钟）
- 对比接口：`maxDuration: 300`
- 追问接口：`maxDuration: 180`
- 其他接口：`maxDuration: 60`

**文件大小限制：**
- 请求体（已绕过）：4.5MB（通过 Blob 客户端直传解决）
- 单文件最大：500MB（Vercel Blob 硬限制）
- PDF 解析最大：200 页 / 300,000 字符

---

## 设计决策说明

| 决策 | 原因 |
|------|------|
| 文件直传 Vercel Blob | 彻底绕过 Serverless 4.5MB 请求体限制，支持大型 10-K 年报 |
| JSON Schema 强制输出 | 保证 AI 输出结构一致，避免 JSON 解析失败导致分析丢失 |
| 三重 Session 验证 | 防止 Serverless 并发场景下 Session 漂移导致数据归属错误 |
| requestId 两次去重 | 前端超时重试时防止重复创建分析记录（幂等性保证） |
| Blob JSON 作为主存储 | 零数据库配置即可运行，同时支持存储 >1MB 的大 JSON |
| 内存速率限制 | 轻量级保护，无需额外 Redis；生产高并发需升级为 Upstash Redis |
| temperature=0.3 | 降低 AI 随机性，确保同一份财报分析的数值可重复性 |
| 双模式认证（Demo/DB） | 本地开发零配置启动，生产环境无缝切换数据库认证 |

---

*FinSight AI — 让每一份财报都说清楚"对估值的影响是什么"*
