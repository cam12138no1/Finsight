# FinSight AI — AI驱动的企业财报深度分析平台

> 项目名称：Private Fund Analysis Platform (FinSight)  
> 仓库地址：https://github.com/cam12138no1/private-fund-analysis  
> 线上部署：https://finsight-pro-ai.vercel.app  
> 当前版本：V2.0  
> 最后更新：2026-02-27

---

## 一、项目定位与目标

面向私募基金投资团队的 **AI财报分析平台**，核心价值是：

- 上传美股上市公司财报（PDF/Excel/文本），由 AI 自动产出 **投委会级别** 的结构化分析报告
- 分析风格对标 sell-side 研究报告，回答核心问题：*"本次财报是否改变了我们对未来 2-3 年现金流与竞争力的判断？"*
- 支持多公司横向对比、自定义问题提取、研报 vs 实际数据对比

---

## 二、技术架构

### 技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | Next.js 14 (App Router) + React 18 + TypeScript |
| UI | Tailwind CSS + Radix UI + shadcn/ui 组件 |
| 认证 | NextAuth.js (Credentials Provider) + JWT |
| 数据库 | Neon Postgres (@vercel/postgres)，可选 |
| 文件存储 | Vercel Blob（用户隔离路径） |
| AI 模型 | Google Gemini 3 Pro Preview（经由 OpenRouter API） |
| 国际化 | next-intl（中/英双语，默认中文） |
| 部署 | Vercel（Serverless Functions，最长 300s 超时） |
| 文档解析 | pdf-parse（PDF）、xlsx（Excel） |
| 导出 | xlsx（Excel导出）、jspdf + html2canvas（PDF导出） |

### 架构图

```
用户浏览器
  ↓ NextAuth Session
Next.js App Router
  ├── /auth/signin          → 登录页
  ├── /dashboard            → 主面板（报告列表、上传）
  ├── /dashboard/reports    → 报告详情 + Excel 导出
  └── /dashboard/comparison → 横向对比

API Routes (Serverless Functions)
  ├── /api/auth/[...nextauth]  → 认证
  ├── /api/reports/upload      → 直传上传 + 即时分析
  ├── /api/reports/analyze     → Blob 上传后触发分析
  ├── /api/reports/[id]        → 单条查看/删除（用户隔离）
  ├── /api/dashboard           → 仪表盘数据（带限流）
  ├── /api/comparison          → 横向对比分析
  ├── /api/custom-questions    → 自定义问题 Q&A
  ├── /api/blob/upload-token   → Blob 上传 Token
  └── /api/admin/*             → 管理/迁移/清理

数据层
  ├── Vercel Blob    → 分析结果 JSON（analyses/user_{id}/req_{requestId}.json）
  ├── Neon Postgres  → 用户、公司、财报、分析结果（可选，有则优先）
  └── In-Memory      → 本地开发时的 fallback
```

---

## 三、核心功能模块

### 3.1 用户认证系统

**文件**：`lib/auth.ts`

- **双模式认证**：
  - **Demo 模式**（无 DATABASE_URL）：使用硬编码用户直接登录
  - **数据库模式**（有 DATABASE_URL）：查询 Postgres users 表 + bcrypt 密码校验
  - **兜底机制**：数据库查询失败或找不到用户时，回退到 Demo 用户

- **预置账号**：

  | 角色 | 邮箱 | 密码 | 权限 |
  |------|------|------|------|
  | Admin | admin@example.com | admin123 | read, write, delete, admin |
  | Analyst 1 | analyst1@finsight.internal | Analyst1! | read, write |
  | Analyst 2 | analyst2@finsight.internal | Analyst2! | read, write |
  | Analyst 3 | analyst3@finsight.internal | Analyst3! | read, write |
  | Viewer | viewer@finsight.internal | Viewer1! | read |

- **Session**：JWT 策略，7天过期，包含 userId / role / permissions
- **会话监控**：`hooks/use-session-monitor.ts` 实现过期预警 + 自动登出

### 3.2 财报上传与 AI 分析

**核心流程**：

1. 用户上传 PDF/Excel/文本文件 → `document-parser.ts` 提取文本
2. 系统自动识别公司类别（AI应用 or AI供应链）
3. 拼装 system prompt + user prompt → 调用 Gemini 3 Pro
4. 返回结构化 JSON 分析结果 → 存储到 Vercel Blob（用户隔离路径）

**两套分析 Prompt**（`lib/ai/prompts.ts`、`lib/ai/analyzer.ts`）：

- **AI 应用公司**：侧重 DAU/MAU、ARPU、广告转化率、AI功能渗透率
- **AI 供应链公司**：侧重 Data Center 收入、ASP、毛利率、产能利用率、库存天数

**分析输出结构**（投委会级别，7大模块）：

| 模块 | 内容 |
|------|------|
| 0. 一句话结论 | 核心收入 Beat/Miss + 驱动因素 + 风险点 |
| 1. 业绩 vs 预期 | results_table（5-7行关键指标 + Beat/Miss 分级） |
| 2. 增长驱动 | 需求/变现/效率三维拆解（含量化指标） |
| 3. 投入与 ROI | CapEx / OpEx 变化 + ROI 证据 + 管理层承诺 |
| 4. 可持续性与风险 | 可持续驱动 + 风险（含时间窗口）+ 检查点 |
| 5. 模型影响 | 上调/下调因素 + 逻辑链 |
| 6. 投委会判断 | 信心/担忧/盯紧项 + 净影响评级 + 投资建议 |

**数值格式强制规则**：所有金额 `$XX.XXB`（两位小数），百分比 `XX.XX%`（两位小数），EPS `$X.XX`

### 3.3 支持公司列表

**AI 应用公司（10家）**：
META, GOOGL/GOOG, MSFT, AMZN, AAPL, NFLX, CRM, SNOW, PLTR

**AI 供应链公司（13家）**：
NVDA, AMD, INTC, TSM, AVGO, QCOM, MU, AMAT, LRCX, KLAC, ASML, MRVL, ARM

> 注：`prompts.ts` 中的公司列表与 `V2_UPDATE.md` 记录的有差异（如缺少 NOW/APP/ADBE/SKH/SSNLF/VRT/ETN/GEV/VST/SNPS），代码以 `prompts.ts` 为准。未在列表中的公司默认按 AI 应用公司处理。

### 3.4 横向对比功能

**页面**：`/dashboard/comparison`
**API**：`/api/comparison`

- 选择 2+ 家同赛道公司，AI 生成横向对比分析
- 对比维度：Revenue / EPS / Margin / YoY 增长 / CapEx 强度 / 竞争优势
- 支持 CSV 导出
- 一次最多对比 5 家公司

### 3.5 自定义问题提取

**API**：`/api/custom-questions`

- 选择已分析的财报，输入自定义问题
- AI 基于财报数据回答，支持批量提问（最多 10 个）
- 预设问题模板：ROI 体现、支出收入比、CapEx 投向、毛利率驱动、竞争优势

### 3.6 数据存储与用户隔离

**文件**：`lib/store.ts`

- Vercel Blob 路径隔离：`analyses/user_{userId}/req_{requestId}.json`
- 每个用户只能访问自己的数据
- requestId 去重防止重复上传
- 支持过期清理（30分钟超时的 processing 状态记录）
- 本地开发无 Blob Token 时，使用内存 Map 作为 fallback

### 3.7 其他功能

- **限流**：`lib/ratelimit.ts` — 内存级限流（分析/上传/Dashboard 各有独立限制）
- **Session 验证**：`lib/session-validator.ts` — 所有数据 API 强制验证用户身份
- **文件验证**：`lib/file-validation.ts` — Magic number 校验文件类型
- **重试机制**：`lib/fetch-retry.ts` — 指数退避重试
- **Excel 导出**：`lib/export-excel.ts` — 将分析结果导出为 Excel
- **PDF 导出**：分析弹窗内支持 jspdf + html2canvas 导出 PDF
- **错误边界**：`components/error-boundary.tsx` — React Error Boundary

---

## 四、部署与环境配置

### 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | 否 | Neon Postgres 连接串；不填则使用 Demo 模式 |
| `OPENROUTER_API_KEY` | **是** | OpenRouter API Key，用于调用 Gemini 3 Pro |
| `NEXTAUTH_SECRET` | **是** | NextAuth 加密密钥 |
| `NEXTAUTH_URL` | **是** | 应用 URL（本地：http://localhost:3000） |
| `BLOB_READ_WRITE_TOKEN` | 否 | Vercel Blob Token；不填则使用内存存储 |
| `JWT_SECRET` | 否 | JWT 密钥 |

### Vercel 部署配置（`vercel.json`）

- 区域：`iad1`（美东）、`hkg1`（香港）
- 函数超时：上传/分析/对比 300s，自定义问题 180s，其他 60s

### 本地开发

```bash
git clone https://github.com/cam12138no1/private-fund-analysis.git
cd private-fund-analysis
npm install
cp .env.local.template .env.local
# 至少填入 OPENROUTER_API_KEY 和 NEXTAUTH_SECRET
npx next dev
# 访问 http://localhost:3000，使用 admin@example.com / admin123 登录
```

---

## 五、数据库 Schema

### 核心表（`lib/db/schema.sql`）

- `users` — 用户（email / password_hash / role / permissions）
- `companies` — 公司（symbol / name / sector / category）
- `financial_reports` — 财报记录（关联 company_id）
- `financial_data` — 财务数据（指标名/值/期间）
- `analysis_results` — AI 分析结果（JSONB）
- `user_analyses` — 用户分析记录（关联 user_id + analysis_result_id）

### V2 新增（`lib/db/schema_update.sql`）

- `comparison_analyses` — 横向对比分析
- `custom_questions` — 自定义问答
- `companies.category` 字段（AI_APPLICATION / AI_SUPPLY_CHAIN）
- `latest_company_reports` 视图、`category_summary` 物化视图

> **注意**：当前线上主要使用 Vercel Blob 存储分析结果（JSON 文件），Postgres 主要用于用户认证。两套存储并行。

---

## 六、当前进展与已完成功能

### 已完成 ✅

1. **基础框架**：Next.js 14 + TypeScript + Tailwind 全栈搭建
2. **用户系统**：NextAuth 认证 + 角色权限（admin/analyst/viewer）+ Demo 模式
3. **文档解析**：PDF / Excel / 文本文件上传与文本提取
4. **AI 分析引擎**：双 Prompt（AI应用/供应链）+ 投委会级结构化输出
5. **数值精度控制**：强制 $XX.XXB / XX.XX% 格式 + 自检流程
6. **研报对比**：支持同时上传研报，AI 自动对比 Beat/Miss
7. **横向对比**：多公司选择 + AI 生成对比分析
8. **自定义问题**：基于财报的自由问答
9. **用户数据隔离**：Blob 路径级隔离 + Session 验证
10. **国际化**：中英文双语（默认中文）
11. **Vercel 部署**：Serverless 函数 + Blob 存储 + 双区域
12. **导出功能**：Excel / PDF 导出
13. **安全特性**：限流 / 会话监控 / 文件类型校验 / 错误边界

### 待迭代 / 已知问题 🔄

1. **公司列表不一致**：`prompts.ts` 与 `V2_UPDATE.md` 的公司列表有出入，需统一
2. **存储双轨**：Blob 和 Postgres 两套存储并行，数据一致性需梳理
3. **i18n 警告**：`i18n.ts` 位置已 deprecated，需迁移到 `i18n/request.ts`
4. **密码安全**：线上仍使用默认 Demo 密码，需更换为数据库认证
5. **schema.sql 中的密码哈希**：占位哈希值，实际部署需生成真实 bcrypt 哈希
6. **对比功能限制**：最多 5 家公司，需已有分析数据
7. **自定义问题限制**：单次最多 10 个问题
8. **文件监视器警告**：EMFILE（too many open files）开发环境需 `ulimit` 调整
9. **`@vercel/postgres` 已弃用**：需迁移到 Neon 官方 SDK
10. **`@vercel/kv` 已弃用**：需移除或替换

---

## 七、项目文件结构

```
private-fund-analysis/
├── app/                        # Next.js App Router
│   ├── api/                    # API 路由
│   │   ├── admin/              # 管理接口（迁移/清理）
│   │   ├── auth/               # NextAuth 处理
│   │   ├── blob/               # Blob 上传 Token
│   │   ├── comparison/         # 横向对比
│   │   ├── custom-questions/   # 自定义问题
│   │   ├── dashboard/          # 仪表盘数据
│   │   ├── debug/              # 调试接口
│   │   └── reports/            # 报告 CRUD + 分析
│   ├── auth/signin/            # 登录页
│   ├── dashboard/              # 主面板 + 报告 + 对比
│   ├── globals.css             # 全局样式
│   ├── layout.tsx              # 根布局
│   └── page.tsx                # 入口（重定向）
├── components/                 # React 组件
│   ├── dashboard/              # 业务组件（上传、分析、侧栏等）
│   ├── ui/                     # 基础 UI 组件（button/card/input 等）
│   ├── error-boundary.tsx
│   ├── language-switcher.tsx
│   └── providers.tsx
├── lib/                        # 核心库
│   ├── ai/                     # AI 相关
│   │   ├── analyzer.ts         # 分析引擎（调用 OpenRouter）
│   │   ├── extractor.ts        # 元数据提取
│   │   └── prompts.ts          # Prompt 定义 + 公司分类
│   ├── db/                     # 数据库
│   │   ├── queries.ts          # SQL 查询
│   │   ├── schema.sql          # 基础 Schema
│   │   ├── schema_update.sql   # V2 更新 Schema
│   │   ├── schema_users.sql    # 用户表 Schema
│   │   └── simple-storage.ts   # KV 存储（已弃用）
│   ├── auth.ts                 # 认证配置
│   ├── document-parser.ts      # 文档解析
│   ├── store.ts                # 用户隔离存储（Blob/Memory）
│   ├── openrouter.ts           # OpenRouter API 客户端
│   ├── ratelimit.ts            # 限流
│   ├── session-validator.ts    # Session 验证
│   ├── file-validation.ts      # 文件类型校验
│   ├── fetch-retry.ts          # 重试机制
│   ├── export-excel.ts         # Excel 导出
│   ├── env.ts                  # 环境变量校验
│   └── utils.ts                # 工具函数
├── hooks/                      # React Hooks
│   └── use-session-monitor.ts  # 会话监控
├── types/                      # 类型声明
│   ├── next-auth.d.ts          # NextAuth 扩展类型
│   └── pdf-parse.d.ts
├── messages/                   # 国际化
│   ├── zh.json                 # 中文
│   └── en.json                 # 英文
├── scripts/                    # 脚本
│   └── migrate-data.ts         # 数据迁移
├── docs/                       # 文档
│   └── V2_UPDATE.md            # V2 更新说明
├── public/                     # 静态资源
├── i18n.ts                     # 国际化配置
├── next.config.js              # Next.js 配置
├── tailwind.config.js          # Tailwind 配置
├── tsconfig.json               # TypeScript 配置
├── vercel.json                 # Vercel 部署配置
├── package.json                # 依赖管理
└── .env.local.template         # 环境变量模板
```

---

## 八、AI 模型与 API

- **模型**：`google/gemini-3-pro-preview`（经由 OpenRouter）
- **上下文窗口**：~1M tokens（~4M 字符）
- **输入限制**：财报文本截断至 200K 字符，研报截断至 100K 字符
- **输出限制**：max_tokens = 16,000
- **Temperature**：0.3（保证一致性）
- **超时**：5 分钟（OpenRouter 客户端）
- **输出格式**：强制 JSON Schema（json_schema response_format + strict: true）
- **成本估算**：~$50/月（100K tokens 用量）

---

## 九、后续迭代方向（规划）

### 近期（V2.1）

- [ ] 扩充支持公司列表 + 统一代码与文档的公司列表
- [ ] 对比结果导出 Excel
- [ ] 问题模板库用户自定义
- [ ] 修复 i18n deprecation warning
- [ ] 替换已弃用的 @vercel/postgres 和 @vercel/kv

### 中期（V2.2）

- [ ] 时间序列趋势对比（同一公司多季度）
- [ ] 行业平均值基准线
- [ ] 智能问题推荐

### 远期（V3.0）

- [ ] 实时财报监控与推送
- [ ] 多维度相关性分析
- [ ] 预测模型集成
