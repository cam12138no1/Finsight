# FinSight 数据 API 对接规范

> 本文档面向负责提供财报数据 API 的同事。
> FinSight 系统每天 **UTC 06:00** 自动调用以下 API，获取所有跟踪公司的季度财报数据。

---

## 一、需要提供的 API 列表

| 优先级 | API | 路径 | 作用 |
|--------|-----|------|------|
| **P0** | API 1 | `GET /api/financials/{symbol}` | 获取某公司所有季度的核心财务指标 |
| **P0** | API 3 | `GET /api/reports/{symbol}/{year}/Q{quarter}` | 获取某季度的财报原文（纯文本） |
| P1 | API 2 | `GET /api/financials/category/{category}` | 批量获取某类别下所有公司数据 |
| P2 | API 4 | `GET /api/reports/{symbol}/{year}/Q{quarter}/download` | 获取财报 PDF 下载链接（可选） |

> **P0 是必须的**，没有 API 1 和 API 3，系统无法运行。

---

## 二、需要覆盖的公司（共 29 家）

### AI 应用公司 (`AI_APPLICATION`)

| Symbol | 公司 |
|--------|------|
| `MSFT` | Microsoft |
| `GOOGL` | Alphabet (Google) |
| `AMZN` | Amazon |
| `META` | Meta Platforms |
| `CRM` | Salesforce |
| `NOW` | ServiceNow |
| `PLTR` | Palantir |
| `AAPL` | Apple |
| `APP` | AppLovin |
| `ADBE` | Adobe |

### AI 供应链公司 (`AI_SUPPLY_CHAIN`)

| Symbol | 公司 |
|--------|------|
| `NVDA` | NVIDIA |
| `AMD` | AMD |
| `AVGO` | Broadcom |
| `TSM` | TSMC |
| `SKM` | SK Hynix |
| `MU` | Micron |
| `SSNLF` | Samsung |
| `INTC` | Intel |
| `VRT` | Vertiv |
| `ETN` | Eaton |
| `GEV` | GE Vernova |
| `VST` | Vistra |
| `ASML` | ASML |
| `SNPS` | Synopsys |

### 消费品公司 (`CONSUMER_GOODS`)

| Symbol | 公司 |
|--------|------|
| `RMS.PA` | Hermès（爱马仕） |
| `600519.SS` | 贵州茅台 |
| `CROX` | Crocs |
| `RL` | Ralph Lauren |
| `MC.PA` | LVMH（路威酩轩） |

> **注意**：Symbol 必须和上表完全一致（包括 `.PA`、`.SS` 后缀），系统用 symbol 做主键匹配。

---

## 三、API 详细规范

### API 1：获取单个公司的季度财务数据（P0）

```
GET /api/financials/{symbol}
```

#### 请求示例

```
GET /api/financials/MSFT
GET /api/financials/NVDA
GET /api/financials/600519.SS
GET /api/financials/RMS.PA
```

#### 完整响应示例

```json
{
  "symbol": "NVDA",
  "name": "NVIDIA",
  "nameZh": "英伟达",
  "category": "AI_SUPPLY_CHAIN",
  "quarters": [
    {
      "fiscalYear": 2025,
      "fiscalQuarter": 4,
      "period": "2025 Q4",
      "filingDate": "2025-02-26",
      "reportAvailable": true,
      "metrics": {
        "revenue": "$39.33B",
        "revenueYoY": "+78.00%",
        "netIncome": "$22.09B",
        "netIncomeYoY": "+80.25%",
        "eps": "$0.89",
        "epsYoY": "+71.15%",
        "operatingMargin": "62.35%",
        "grossMargin": "73.00%"
      }
    },
    {
      "fiscalYear": 2025,
      "fiscalQuarter": 3,
      "period": "2025 Q3",
      "filingDate": "2024-11-20",
      "reportAvailable": true,
      "metrics": {
        "revenue": "$35.08B",
        "revenueYoY": "+93.61%",
        "netIncome": "$19.31B",
        "netIncomeYoY": "+108.91%",
        "eps": "$0.78",
        "epsYoY": "+101.28%",
        "operatingMargin": "62.49%",
        "grossMargin": "74.56%"
      }
    },
    {
      "fiscalYear": 2025,
      "fiscalQuarter": 2,
      "period": "2025 Q2",
      "filingDate": "2024-08-28",
      "reportAvailable": true,
      "metrics": {
        "revenue": "$30.04B",
        "revenueYoY": "+122.40%",
        "netIncome": "$16.60B",
        "netIncomeYoY": "+168.00%",
        "eps": "$0.67",
        "epsYoY": "+151.85%",
        "operatingMargin": "64.93%",
        "grossMargin": "75.15%"
      }
    }
  ],
  "lastUpdated": "2025-03-01T06:00:00Z"
}
```

#### 字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `symbol` | string | ✅ | 股票代码，**必须与上表中的 Symbol 完全一致** |
| `name` | string | ✅ | 公司英文名 |
| `nameZh` | string | - | 公司中文名（没有可不传） |
| `category` | string | - | `AI_APPLICATION` / `AI_SUPPLY_CHAIN` / `CONSUMER_GOODS` |
| `quarters` | array | ✅ | 季度数据数组，**从新到旧排列**，建议返回最近 2-3 年的数据 |
| `lastUpdated` | string | - | 数据最后更新时间，ISO 8601 格式 |

**`quarters[]` 中每个季度的字段：**

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `fiscalYear` | number | ✅ | 财年年份，如 `2025` |
| `fiscalQuarter` | number | ✅ | 季度，`1`/`2`/`3`/`4` |
| `period` | string | - | 格式化显示，如 `"2025 Q4"`（不传我们会自动生成） |
| `filingDate` | string | - | 财报发布日期，`YYYY-MM-DD` |
| `reportAvailable` | boolean | - | 该季度的财报原文是否可通过 API 3 获取 |
| `metrics` | object | ✅ | 核心财务指标，见下表 |

**`metrics` 对象字段：**

| 字段 | 类型 | 必须 | 格式示例 | 说明 |
|------|------|------|---------|------|
| `revenue` | string | ✅ | `"$39.33B"` | 营收（十亿美元） |
| `revenueYoY` | string | ✅ | `"+78.00%"` | 营收同比变化 |
| `netIncome` | string | ✅ | `"$22.09B"` | 净利润 |
| `netIncomeYoY` | string | ✅ | `"+80.25%"` | 净利润同比 |
| `eps` | string | ✅ | `"$0.89"` | 每股收益 |
| `epsYoY` | string | ✅ | `"+71.15%"` | EPS 同比 |
| `operatingMargin` | string | - | `"62.35%"` | 营业利润率 |
| `grossMargin` | string | - | `"73.00%"` | 毛利率 |

#### 数值格式要求（重要）

| 类型 | 格式 | 正确示例 | 错误示例 |
|------|------|---------|---------|
| 十亿美元金额 | `$XX.XXB` | `$39.33B`、`$2.10B` | `$39.3B`、`39.33`、`$39330M` |
| 百万美元金额 | `$XX.XXM` | `$892.50M` | `892.5M` |
| 百分比（正值） | `+XX.XX%` | `+78.00%`、`+2.74%` | `78%`、`+78.0%` |
| 百分比（负值） | `-XX.XX%` | `-3.50%` | `-3.5%` |
| 百分比（不变） | `0.00%` | `0.00%` | `0%` |
| EPS | `$X.XX` | `$0.89`、`$3.23` | `$0.9`、`0.89` |
| 数据缺失 | `null` 或 `""` | `null` | `"N/A"`、`"--"` |

> **两位小数是强制要求**，前端和 AI 分析都依赖这个格式做解析。

#### 错误处理

| 情况 | 期望行为 |
|------|---------|
| 公司不存在 | 返回 404 |
| 暂无数据 | 返回 200 + `{"symbol": "MSFT", "quarters": []}` |
| 服务器错误 | 返回 500 |

---

### API 3：获取某季度的财报原文（P0）

```
GET /api/reports/{symbol}/{year}/Q{quarter}
```

#### 请求示例

```
GET /api/reports/MSFT/2025/Q2
GET /api/reports/NVDA/2025/Q4
GET /api/reports/600519.SS/2024/Q3
```

#### 响应示例

```json
{
  "symbol": "MSFT",
  "fiscalYear": 2025,
  "fiscalQuarter": 2,
  "reportText": "UNITED STATES\nSECURITIES AND EXCHANGE COMMISSION\nWashington, D.C. 20549\n\nFORM 10-Q\n\nMICROSOFT CORPORATION\n\nFor the quarterly period ended December 31, 2024\n\nPART I - FINANCIAL INFORMATION\n\nItem 1. Financial Statements\n\nINCOME STATEMENTS\n(In millions, except per share amounts)(Unaudited)\n\n                              Three Months Ended\n                              December 31,\n                              2024        2023\nRevenue                       $69,632     $62,020\nCost of revenue               21,337      20,146\nGross margin                  48,295      41,874\nOperating income              31,650      27,032\n...\n(完整财报文本，通常 10-30 万字符)\n...",
  "reportType": "10-Q",
  "filingDate": "2025-01-28",
  "pageCount": 78,
  "characterCount": 245000
}
```

#### 字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `symbol` | string | - | 公司代码 |
| `fiscalYear` | number | - | 财年 |
| `fiscalQuarter` | number | - | 季度 |
| `reportText` | string | **✅** | **最关键字段** — 财报全文纯文本 |
| `reportType` | string | - | `"10-Q"`（季报）或 `"10-K"`（年报） |
| `filingDate` | string | - | 发布日期 |
| `pageCount` | number | - | 页数 |
| `characterCount` | number | - | 字符数 |

#### `reportText` 要求

1. **必须是从财报 PDF 中提取的完整纯文本**（不是摘要，不是链接）
2. 保留原始表格结构（用空格/tab 对齐），AI 需要读懂表格
3. 包含关键部分：Income Statement、Balance Sheet、Cash Flow、Management Discussion (MD&A)
4. **最大 300,000 字符**，超出部分系统会截断
5. 编码：UTF-8

#### 错误处理

| 情况 | 期望行为 |
|------|---------|
| 该季度财报尚未发布 | 返回 **404** |
| 财报已发布但原文提取未完成 | 返回 **404** 或 202 |
| Symbol 不存在 | 返回 404 |

---

### API 2：批量获取某类别所有公司数据（P1）

```
GET /api/financials/category/{category}
```

#### 请求示例

```
GET /api/financials/category/AI_APPLICATION
GET /api/financials/category/AI_SUPPLY_CHAIN
GET /api/financials/category/CONSUMER_GOODS
```

#### 响应

返回数组，每个元素结构与 API 1 完全相同：

```json
[
  {
    "symbol": "MSFT",
    "name": "Microsoft",
    "quarters": [ ... ]
  },
  {
    "symbol": "GOOGL",
    "name": "Alphabet",
    "quarters": [ ... ]
  }
]
```

> 如果没有这个接口，系统会对每家公司逐个调用 API 1（29 次），功能不受影响，只是效率低一些。

---

### API 4：获取财报 PDF 下载链接（P2，可选）

```
GET /api/reports/{symbol}/{year}/Q{quarter}/download
```

#### 响应

```json
{
  "downloadUrl": "https://s3.amazonaws.com/bucket/reports/MSFT_2025_Q2.pdf",
  "fileName": "MSFT_10Q_2025Q2.pdf",
  "fileSize": 5242880
}
```

> 目前系统不使用此接口，未来可能用于 PDF 原文下载功能。**可以暂不实现。**

---

## 四、调用频率与更新节奏

| 项目 | 说明 |
|------|------|
| 调用频率 | **每天 1 次**（UTC 06:00，北京时间 14:00） |
| 每次请求数 | 最多 29 次 API 1 + 最多约 100 次 API 3 |
| 数据更新 | 财报季密集期（1/4/7/10 月）会有新数据，平时大多返回缓存 |
| 超时 | 单次请求超时 30 秒，超时后跳过该公司继续下一个 |
| 重试 | 系统不自动重试，下次 cron 会再试 |

## 五、联调测试

API 部署好后，请提供根地址（如 `https://your-api.example.com`），我们会配置到系统中。

可以先实现 1-2 家公司（如 `MSFT`、`NVDA`）用于联调测试，确认格式无误后再扩展到全部 29 家。

**快速验证命令：**

```bash
# 测试 API 1
curl https://your-api.example.com/api/financials/MSFT

# 测试 API 3
curl https://your-api.example.com/api/reports/MSFT/2025/Q2
```
