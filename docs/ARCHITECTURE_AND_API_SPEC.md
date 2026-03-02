# FinSight AI — 系统架构与数据 API 对接规范

## 一、系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     浏览器 (Next.js Client)                  │
│                                                             │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ 登录页面  │  │ 主页（公司列表）  │  │ 公司子页面（季度）│  │
│  └──────────┘  └──────────────────┘  └──────────────────┘  │
│                        │                      │             │
│                        │ GET /api/company-data │             │
│                        │ GET /api/dashboard    │             │
│                        ▼                      ▼             │
└─────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
  ┌──────────────┐ ┌──────────┐ ┌──────────────────┐
  │ Vercel       │ │ Vercel   │ │ Vercel Cron      │
  │ Postgres DB  │ │ Blob     │ │ (每天06:00 UTC)  │
  │              │ │          │ │                  │
  │ 财报指标数据 │ │ 研报PDF  │ │ GET /api/cron/   │
  │ (cron写入)   │ │ 用户上传 │ │ fetch-reports    │
  └──────┬───────┘ └────┬─────┘ └───────┬──────────┘
         │              │               │
         │              │               ▼
         │              │      ┌────────────────────┐
         │              │      │ 数据同事 API        │
         │              │      │ FINANCIAL_API_BASE  │
         │              │      │                    │
         │              │      │ 每日提供各公司      │
         │              │      │ 季度财报指标+原文   │
         │              │      └────────────────────┘
         │              │
         ▼              ▼
  ┌─────────────────────────────────┐
  │     AI 分析引擎                  │
  │     (OpenRouter → Gemini)       │
  │                                 │
  │  无研报 → 客观数据提取           │
  │  有研报 → 财报vs研报客观对比     │
  │                                 │
  │  ★ 严禁任何主观判断 ★           │
  │  ★ 严禁 beat/miss/推荐 ★       │
  └─────────────────────────────────┘
```

## 二、数据流

### 默认流程（无用户操作）

```
数据同事API → Cron定时任务 → Vercel Postgres → 前端展示
```

1. **每天 06:00 UTC**，Vercel Cron 自动触发 `GET /api/cron/fetch-reports`
2. Cron 遍历所有跟踪的公司（29家），逐个调用数据同事的 API
3. 获取到的每个季度的财务指标和财报原文，**upsert** 到 `fetched_financials` 表
4. 前端主页和子页面从 `/api/company-data` 读取 DB 数据展示

### 研报对比流程（用户主动操作）

```
用户上传研报PDF → Vercel Blob → 分析API → AI对比 → 结果存 Blob → 前端展示
```

1. 用户在公司子页面选择某个季度，点击"上传研报对比"
2. 研报 PDF 上传到 Vercel Blob
3. `POST /api/reports/analyze` 被调用，参数 `useDbFinancialData: true`
4. 后端从 DB 读取该季度的财报原文 (`report_text`)，与研报一起送 AI
5. AI 输出**客观数据对比**（绝无主观评价），结果存入 Blob
6. 前端展示对比结果

## 三、跟踪的公司列表

### AI 应用公司 (AI_APPLICATION)
| Symbol | 公司名 |
|--------|--------|
| MSFT | Microsoft |
| GOOGL | Alphabet (Google) |
| AMZN | Amazon |
| META | Meta Platforms |
| CRM | Salesforce |
| NOW | ServiceNow |
| PLTR | Palantir |
| AAPL | Apple |
| APP | AppLovin |
| ADBE | Adobe |

### AI 供应链公司 (AI_SUPPLY_CHAIN)
| Symbol | 公司名 |
|--------|--------|
| NVDA | NVIDIA |
| AMD | AMD |
| AVGO | Broadcom |
| TSM | TSMC |
| SKM | SK Hynix |
| MU | Micron |
| SSNLF | Samsung |
| INTC | Intel |
| VRT | Vertiv |
| ETN | Eaton |
| GEV | GE Vernova |
| VST | Vistra |
| ASML | ASML |
| SNPS | Synopsys |

### 消费品公司 (CONSUMER_GOODS)
| Symbol | 公司名 |
|--------|--------|
| RMS.PA | Hermès |
| 600519.SS | 贵州茅台 |
| CROX | Crocs |
| RL | Ralph Lauren |
| MC.PA | LVMH |

## 四、数据同事需要提供的 API

系统通过环境变量 `FINANCIAL_API_BASE_URL` 配置 API 根地址。

### API 1：获取单个公司的季度财务数据

**请求：**
```
GET {FINANCIAL_API_BASE_URL}/api/financials/{symbol}
```

**参数：**
- `symbol` — 公司股票代码，如 `MSFT`、`NVDA`、`RMS.PA`、`600519.SS`

**期望响应格式：**
```json
{
  "symbol": "MSFT",
  "name": "Microsoft",
  "nameZh": "微软",
  "category": "AI_APPLICATION",
  "quarters": [
    {
      "fiscalYear": 2025,
      "fiscalQuarter": 2,
      "period": "2025 Q2",
      "filingDate": "2025-01-28",
      "reportAvailable": true,
      "metrics": {
        "revenue": "$69.63B",
        "revenueYoY": "+12.27%",
        "netIncome": "$24.11B",
        "netIncomeYoY": "+10.22%",
        "eps": "$3.23",
        "epsYoY": "+10.24%",
        "operatingMargin": "45.46%",
        "grossMargin": "69.35%"
      }
    },
    {
      "fiscalYear": 2025,
      "fiscalQuarter": 1,
      "period": "2025 Q1",
      "filingDate": "2024-10-30",
      "reportAvailable": true,
      "metrics": {
        "revenue": "$65.59B",
        "revenueYoY": "+16.04%",
        "netIncome": "$24.67B",
        "netIncomeYoY": "+10.71%",
        "eps": "$3.30",
        "epsYoY": "+10.37%",
        "operatingMargin": "46.55%",
        "grossMargin": "69.40%"
      }
    }
  ],
  "lastUpdated": "2025-03-02T06:00:00Z"
}
```

**字段说明：**

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `symbol` | string | 是 | 股票代码，需与我们系统中的 symbol 匹配 |
| `name` | string | 是 | 公司英文名 |
| `nameZh` | string | 否 | 公司中文名 |
| `category` | string | 否 | `AI_APPLICATION` / `AI_SUPPLY_CHAIN` / `CONSUMER_GOODS` |
| `quarters` | array | 是 | 季度数据数组，按时间倒序（新→旧） |
| `quarters[].fiscalYear` | number | 是 | 财年，如 `2025` |
| `quarters[].fiscalQuarter` | number | 是 | 季度，`1`-`4` |
| `quarters[].period` | string | 否 | 格式化期间，如 `"2025 Q2"` |
| `quarters[].filingDate` | string | 否 | 财报发布日期，格式 `YYYY-MM-DD` |
| `quarters[].reportAvailable` | boolean | 否 | 是否有财报原文可下载 |
| `quarters[].metrics.revenue` | string | 是 | 营收，格式 `"$XX.XXB"` |
| `quarters[].metrics.revenueYoY` | string | 是 | 营收同比，格式 `"+XX.XX%"` 或 `"-XX.XX%"` |
| `quarters[].metrics.netIncome` | string | 是 | 净利润，格式 `"$XX.XXB"` |
| `quarters[].metrics.netIncomeYoY` | string | 是 | 净利润同比 |
| `quarters[].metrics.eps` | string | 是 | 每股收益，格式 `"$X.XX"` |
| `quarters[].metrics.epsYoY` | string | 是 | EPS 同比 |
| `quarters[].metrics.operatingMargin` | string | 否 | 营业利润率，格式 `"XX.XX%"` |
| `quarters[].metrics.grossMargin` | string | 否 | 毛利率，格式 `"XX.XX%"` |
| `lastUpdated` | string | 否 | 最后更新时间 ISO 8601 |

**数值格式要求：**
- 金额统一用 `$XX.XXB` 格式（十亿美元，两位小数）
- 百分比统一用 `XX.XX%` 格式（两位小数，正数带 `+` 号）
- EPS 用 `$X.XX` 格式（两位小数）
- 如数据缺失，传 `null` 或 `""`，不要传 `"N/A"`

### API 2：获取某一类别所有公司数据

**请求：**
```
GET {FINANCIAL_API_BASE_URL}/api/financials/category/{category}
```

**参数：**
- `category` — `AI_APPLICATION` / `AI_SUPPLY_CHAIN` / `CONSUMER_GOODS`

**响应：**
返回该类别下所有公司的数据数组，每个元素结构与 API 1 的响应相同。

```json
[
  { "symbol": "MSFT", "name": "Microsoft", ... },
  { "symbol": "GOOGL", "name": "Alphabet", ... },
  ...
]
```

### API 3：获取某个季度的财报原文

**请求：**
```
GET {FINANCIAL_API_BASE_URL}/api/reports/{symbol}/{year}/Q{quarter}
```

**参数示例：**
```
GET /api/reports/MSFT/2025/Q2
GET /api/reports/NVDA/2024/Q4
GET /api/reports/600519.SS/2024/Q3
```

**响应：**
```json
{
  "symbol": "MSFT",
  "fiscalYear": 2025,
  "fiscalQuarter": 2,
  "reportText": "MICROSOFT CORPORATION\nFORM 10-Q\nFor the quarterly period ended December 31, 2024\n\n... (完整财报文本内容) ...",
  "reportType": "10-Q",
  "filingDate": "2025-01-28",
  "pageCount": 78,
  "characterCount": 245000
}
```

**字段说明：**

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `reportText` | string | **是** | 财报全文文本（从 PDF 提取的纯文本），这是最关键的字段 |
| `reportType` | string | 否 | `"10-Q"` 或 `"10-K"` |
| `filingDate` | string | 否 | 发布日期 |
| `pageCount` | number | 否 | 页数 |
| `characterCount` | number | 否 | 字符数 |

**关于 `reportText`：**
- 这是 AI 分析的核心输入，必须是从财报 PDF 中提取的完整纯文本
- 建议保留原始格式（表格用空格/tab对齐）
- 最大支持 300,000 字符，超出会被截断
- 如果财报原文尚未就绪，返回 404 即可

### API 4：获取财报下载链接（可选）

**请求：**
```
GET {FINANCIAL_API_BASE_URL}/api/reports/{symbol}/{year}/Q{quarter}/download
```

**响应：**
```json
{
  "downloadUrl": "https://s3.amazonaws.com/bucket/reports/MSFT_2025_Q2.pdf",
  "fileName": "MSFT_10Q_2025Q2.pdf",
  "fileSize": 5242880
}
```

此接口为可选，主要用于未来可能的 PDF 原文下载功能。

## 五、数据库结构

### `fetched_financials` 表

Cron 每天拉取数据后存入此表，主页和子页面从此表读取。

```sql
CREATE TABLE fetched_financials (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,          -- 股票代码
  company_name VARCHAR(255) NOT NULL,   -- 公司名
  category VARCHAR(50) NOT NULL,        -- AI_APPLICATION / AI_SUPPLY_CHAIN / CONSUMER_GOODS
  fiscal_year INTEGER NOT NULL,         -- 财年
  fiscal_quarter INTEGER NOT NULL,      -- 季度 1-4
  period VARCHAR(20) NOT NULL,          -- "2025 Q2"

  -- 核心指标（来自数据同事 API）
  revenue VARCHAR(50),                  -- "$69.63B"
  revenue_yoy VARCHAR(50),             -- "+12.27%"
  net_income VARCHAR(50),              -- "$24.11B"
  net_income_yoy VARCHAR(50),          -- "+10.22%"
  eps VARCHAR(50),                     -- "$3.23"
  eps_yoy VARCHAR(50),                 -- "+10.24%"
  operating_margin VARCHAR(50),        -- "45.46%"
  gross_margin VARCHAR(50),            -- "69.35%"

  -- 财报原文（来自 API 3，用于 AI 分析和研报对比）
  report_text TEXT,

  -- AI 分析结果（JSON，核心数据提取后存入）
  analysis_result JSONB,
  analyzed_at TIMESTAMP,

  fetched_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(symbol, fiscal_year, fiscal_quarter)
);
```

## 六、Cron 定时任务

**触发方式：** Vercel Cron，配置在 `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-reports",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**执行逻辑：**

1. 遍历 `lib/companies.ts` 中定义的全部 29 家公司
2. 对每家公司调用 API 1 获取季度指标
3. 对每个季度尝试调用 API 3 获取财报原文
4. 将数据 UPSERT 到 `fetched_financials` 表
5. 记录执行日志到 `cron_job_log` 表

**认证：** 通过 `CRON_SECRET` 环境变量保护，Vercel 在调用时自动附带 `Authorization: Bearer {CRON_SECRET}` header。

## 七、环境变量清单

| 变量名 | 用途 | 如何获取 |
|--------|------|---------|
| `NEXTAUTH_SECRET` | 用户认证签名 | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 应用 URL | `https://finsight-ai-tapi.vercel.app` |
| `OPENROUTER_API_KEY` | AI 分析 | https://openrouter.ai/keys |
| `BLOB_READ_WRITE_TOKEN` | PDF 存储 | Vercel Storage → Blob |
| `DATABASE_URL` | 财报数据存储 | Vercel Storage → Postgres |
| `CRON_SECRET` | Cron 认证 | `openssl rand -base64 32` |
| `FINANCIAL_API_BASE_URL` | 数据同事 API 根地址 | 同事提供 |

## 八、前端页面逻辑

### 主页 (`/dashboard`)
- 按类别（AI应用/AI供应链/消费品）显示公司列表
- 每个公司显示最近 3 个季度的 Net Income / Revenue / EPS
- 数据来源：优先 DB（cron 拉取），fallback 到用户分析

### 公司子页面 (`/dashboard/company/{symbol}`)
- 左侧：过去 3 年 12 个季度选择器
- 右侧：选中季度的财报核心数据展示
- **默认展示**：财报核心数据提取（客观事实）
- **上传研报后**：展示财报 vs 研报的客观数据对比（无任何主观评价）
- 页面只有"上传研报对比"按钮，没有"上传财报"（财报由 cron 自动获取）

### 严格客观原则
- 所有 AI 输出仅包含客观数据提取
- 禁止 beat/miss、超预期/不及预期等评价
- 禁止投资建议（超配/低配/标配）
- 研报对比只展示数据差异百分比，不做主观判断
