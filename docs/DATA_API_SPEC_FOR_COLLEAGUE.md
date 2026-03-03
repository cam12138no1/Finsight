# FinSight 数据 API 对接规范

> 本文档面向负责提供财报数据 API 的同事。
> FinSight 系统每天 **UTC 06:00** 自动调用以下 API，获取所有跟踪公司的季度财报数据。

---

## 一、API 概要

| API | 路径 | 作用 |
|-----|------|------|
| **财报数据** | `GET /api/v1/reports/companies/{ticker}/reports?limit=8` | 获取某公司最近 N 个季度的财务数据（JSON） |

> 目前只需要这一个接口。系统会对每家公司调用一次，拿到 `financial_metrics` JSON 后自动完成格式化、YoY 同比计算、存储入库。

---

## 二、需要覆盖的公司（共 29 家）

### AI 应用公司

| Ticker | 公司 |
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

### AI 供应链公司

| Ticker | 公司 |
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

### 消费品公司

| Ticker | 公司 |
|--------|------|
| `RMS.PA` | Hermès（爱马仕） |
| `600519.SS` | 贵州茅台 |
| `CROX` | Crocs |
| `RL` | Ralph Lauren |
| `MC.PA` | LVMH（路威酩轩） |

> **Ticker 必须和上表完全一致**（包括 `.PA`、`.SS` 后缀），系统用 ticker 做主键匹配。

---

## 三、API 详细规范

### 请求

```
GET /api/v1/reports/companies/{ticker}/reports?limit=8
```

#### 请求示例

```bash
curl -X 'GET' \
  'http://3.12.197.98:8006/api/v1/reports/companies/GOOGL/reports?limit=8' \
  -H 'accept: application/json'
```

#### 参数说明

| 参数 | 位置 | 说明 |
|------|------|------|
| `ticker` | URL 路径 | 公司股票代码，如 `GOOGL`、`NVDA`、`600519.SS` |
| `limit` | Query 参数 | 返回最近几个季度的数据，系统默认传 `8` |

### 响应

返回一个**数组**，每个元素是一个季度的财报数据：

```json
[
  {
    "id": "638947ed-060e-4436-9ae1-0b475a9944d4",
    "company_id": "49e07101-6d4c-4337-8584-1d1b5237ff08",
    "ticker": "GOOGL",
    "fiscal_year": 2025,
    "fiscal_quarter": 4,
    "report_date": "2025-12-31",
    "financial_metrics": {
      "revenue": "113896000000",
      "gross_profit": "68130000000",
      "operating_income": "36002000000",
      "net_income": "34455000000",
      "eps": "2.85",
      "eps_diluted": "0",
      "total_assets": "595281000000",
      "total_liabilities": "180016000000",
      "total_equity": "415265000000",
      "cash_and_equivalents": "30708000000",
      "total_debt": "72035000000",
      "operating_cash_flow": "52402000000",
      "free_cash_flow": "24551000000"
    },
    "s3_url": null,
    "created_at": "2026-03-02T19:29:51.465000"
  },
  {
    "id": "...",
    "ticker": "GOOGL",
    "fiscal_year": 2025,
    "fiscal_quarter": 3,
    "report_date": "2025-09-30",
    "financial_metrics": {
      "revenue": "88268000000",
      "gross_profit": "52348000000",
      "operating_income": "28521000000",
      "net_income": "26301000000",
      "eps": "2.12",
      "eps_diluted": "0",
      "total_assets": "...",
      "total_liabilities": "...",
      "total_equity": "...",
      "cash_and_equivalents": "...",
      "total_debt": "...",
      "operating_cash_flow": "...",
      "free_cash_flow": "..."
    },
    "s3_url": null,
    "created_at": "..."
  }
]
```

### 字段说明

#### 外层字段

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `id` | string | - | 记录唯一 ID |
| `company_id` | string | - | 公司 ID |
| `ticker` | string | ✅ | 股票代码，**必须与上表一致** |
| `fiscal_year` | number | ✅ | 财年，如 `2025` |
| `fiscal_quarter` | number | ✅ | 季度，`1`/`2`/`3`/`4` |
| `report_date` | string | ✅ | 财报截止日期，`YYYY-MM-DD` |
| `financial_metrics` | object | ✅ | 核心财务指标，见下表 |
| `s3_url` | string/null | - | 财报 PDF 的 S3 链接（有则存，null 也没关系） |
| `created_at` | string | - | 数据入库时间 |

#### `financial_metrics` 字段

| 字段 | 类型 | 必须 | 说明 | 示例 |
|------|------|------|------|------|
| `revenue` | string | ✅ | 营收（美元，原始数值） | `"113896000000"` |
| `gross_profit` | string | ✅ | 毛利润 | `"68130000000"` |
| `operating_income` | string | ✅ | 营业利润 | `"36002000000"` |
| `net_income` | string | ✅ | 净利润 | `"34455000000"` |
| `eps` | string | ✅ | 每股收益 | `"2.85"` |
| `eps_diluted` | string | - | 稀释每股收益 | `"2.81"` |
| `total_assets` | string | - | 总资产 | `"595281000000"` |
| `total_liabilities` | string | - | 总负债 | `"180016000000"` |
| `total_equity` | string | - | 股东权益 | `"415265000000"` |
| `cash_and_equivalents` | string | - | 现金及等价物 | `"30708000000"` |
| `total_debt` | string | - | 总债务 | `"72035000000"` |
| `operating_cash_flow` | string | - | 经营性现金流 | `"52402000000"` |
| `free_cash_flow` | string | - | 自由现金流 | `"24551000000"` |

#### 数值格式要求

- **所有金额都是原始数值字符串**（单位：美元），如 `"113896000000"` 表示 $113.896B
- **EPS 是每股金额**，如 `"2.85"` 表示 $2.85
- 缺失数据传 `"0"` 或 `null`
- **不需要做格式化**（如 `$XX.XXB`），系统会自动转换
- **不需要算同比 YoY**，系统从相邻季度自动计算

### 错误处理

| 情况 | 期望行为 |
|------|---------|
| Ticker 不存在 | 返回 404 或空数组 `[]` |
| 暂无数据 | 返回 `[]` |
| 服务器错误 | 返回 500 |

---

## 四、系统如何处理数据

你的 API 返回原始数据后，我们系统自动完成以下处理：

```
你的 API 返回                     系统自动处理                     前端展示
─────────────                    ─────────────                   ─────────
"revenue": "113896000000"   →    $113.90B                   →   Revenue $113.90B
"net_income": "34455000000" →    $34.46B                    →   Net Income $34.46B
"eps": "2.85"               →    $2.85                      →   EPS $2.85
                            →    YoY: +12.27% (自动计算)    →   +12.27% YoY
                            →    营业利润率: 31.61% (自动算) →   Operating Margin 31.61%
```

---

## 五、调用频率

| 项目 | 说明 |
|------|------|
| 调用频率 | **每天 1 次**（UTC 06:00，北京时间 14:00） |
| 每次请求数 | 29 次（每家公司调用一次） |
| 单次超时 | 30 秒 |
| 重试策略 | 不重试，下次 cron 再跑 |

---

## 六、联调

API 地址已确认：`http://3.12.197.98:8006`

验证命令：
```bash
# 测试单个公司
curl -X 'GET' \
  'http://3.12.197.98:8006/api/v1/reports/companies/GOOGL/reports?limit=8' \
  -H 'accept: application/json'

# 测试其他公司
curl -X 'GET' \
  'http://3.12.197.98:8006/api/v1/reports/companies/NVDA/reports?limit=8' \
  -H 'accept: application/json'

curl -X 'GET' \
  'http://3.12.197.98:8006/api/v1/reports/companies/MSFT/reports?limit=8' \
  -H 'accept: application/json'
```

需要确认的事项：
1. 上表 29 家公司的 ticker 是否都已录入？
2. 非美股公司（如 `RMS.PA`、`600519.SS`、`SSNLF`）是否支持？
3. `s3_url` 后续会提供吗？（目前 null 不影响核心功能）
