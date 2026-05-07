# Spec 004 Alignment：MEDDICC 经理过程管理（Manager Pipeline）

**创建日期：** 2026-05-07
**Brainstorm session：** 2026-05-07（与杨老师 7 题 Q&A）
**状态：** brainstorm 对齐稿 → 待 user 确认 → 进 specify → plan → tasks → implement
**对应集号：** S2E04（MEDDICC 经理视角）
**对应 tag：** `v-spec004`（未打）
**Branch：** `004-meddicc-manager-pipeline`

---

## 0. 主题攻势上下文

**当前主题攻势宣言：** "**MEDDICC 不只是销售自检表，是连通销售-经理两端的过程管理底盘**"（详见 `Kun's Context/articles/sfa-crm-series/MASTER-PLAN.md`）

**spec 004 在主题攻势中的角色：**
- spec 003（销售视角）= 销售自检 → S2E03
- **spec 004（经理视角）= 经理用 MEDDICC 反查销售吹牛 + 团队过程管理底盘 → S2E04 + 主题攻势收尾集**

**spec 004 不做的事：**
- 完整 Sales Forecasting（多层提报 + 准确率回测）—— 远期独立 spec
- 销售辅导 / Rep Coaching —— 后续主题攻势
- 通话智能 —— 后续主题攻势

---

## 1. 灵感来源

| 来源 | 借鉴点 | 不抄什么 |
|---|---|---|
| **Gong Deal Boards** | 单页 Gong 镜像形态 / Warnings 规则引擎 / Activity 时间线 / Deals/Team 视图切换 / 行内编辑 | Forecasting 多层提报链（属于 Outreach Forecasting 范畴，非本 spec） |
| **Outreach Forecasting** | Forecast Category 6 分类的概念（Open / Commit / Most Likely / Best Case / Closed Won / Closed Lost）| 多层提报链 / Quota Coverage 比率 / Submission snapshot |
| **MEDDICC.com 方法论** | 7 维（Metrics / Economic Buyer / Decision Criteria / Decision Process / Implicate Pain / Champion / Competition）| —— 复用 spec 003 已落地的 |
| **Salesforce / HubSpot Pipeline View** | Team Rollup 行 = sales 员工的列设计 | —— |

**核心判断：** spec 004 主体是 **Pipeline Management**（漏斗管理），不是 Sales Forecasting。两者的差别：
- Pipeline Management = 经理诊断每条 deal 的健康度、卡点、风险（**当下视角**）
- Sales Forecasting = 经理向上提报"本期能交多少"的预测数字（**未来视角 + 多层提报链**）
- 唯一连接点：Forecast Category 字段——既是 Forecasting 的核心信号，也是 Pipeline Management 的诊断维度

spec 004 把 Forecast Category 当作 lead 的"分类标签"用于 Pipeline 视图分组，**不上升到 Forecasting 的 roll-up / submit / 准确率回测**。

---

## 2. 范围划分

### 2.1 本 spec 做（功能清单）

1. **lead 表新增 3 字段**：`amount` / `close_date` / `forecast_category`
2. **lead 转化逻辑改**：转化为 customer 时**保留 lead 行**（status → `converted`），不再归档迁移
3. **Pipeline 全表（Deals 视图）**：单页所有信号
   - 顶部 Forecast Categories 6 tab 切换（仅显示条数 + ⚠️ 数，**不显示金额聚合**——避免滑向 Forecasting）
   - 主表列：deal name / 备注 / Score / Warnings / MEDDICC 7 圆点 / Activity 时间线 / Next Call / 金额 / 负责人
   - 默认排序：Score 升序（最不健康浮顶）
   - 行内编辑：forecast_category / amount / close_date
4. **Team Rollup 视图（Team tab）**：行 = sales 员工
   - 列：Sales（含头像）/ Active lead 数 / 平均 Score / Warnings 数 / 总金额 / 最近活动
   - 默认排序：平均 Score 升序
   - 点击行 drill-down → 切到 Deals 视图 + 按 owner filter
5. **Warnings 规则引擎 7 条**（详见 §5）
   - 阈值进 SystemConfig
   - mitigation 提示文字硬编码
   - 自动消除（条件不满足时）
6. **AI 校验 forecast_category**（详见 §6）
   - 销售或经理把 forecast_category 改到"必赢/大概率"时触发
   - LLM 看 MEDDICC 是否撑得住，撑不住弹气泡反问
   - 3 秒超时放行
7. **单 lead 趋势图**（详见 §7）
   - lead 详情页一张折线图（Score / 时间）
   - 新建 `lead_meddicc_history` 快照表
   - 启动 spec 004 时 backfill 一次
   - 每次 analyze_meddicc + forecast_category 变更触发 snapshot
8. **经理 Chat 升级**：4 个新 tool + system prompt 微调（详见 §8）
9. **移动端语义对等**（详见 §9）
   - Pipeline 表 → 卡片列表
   - Forecast tab 横滑切换
   - 行内编辑 → BottomSheet
   - AI 校验 → dialog 弹

### 2.2 本 spec 不做（明确 punt 给后续）

- ❌ 商机阶段（Sales Stage）字段 —— 用 MEDDICC 完成度替代"流程位置感"
- ❌ Quota / Forecast Coverage 比率 —— 属于 Forecasting 范畴
- ❌ 多层 Forecast 提报链（销售→经理→VP）—— 远期独立 spec
- ❌ 历史 Forecast 准确率回测 —— 同上
- ❌ 团队级趋势图（按周展示团队均值）—— 单 lead 趋势图意义足够
- ❌ Pipeline 全表常驻 sparkle ✨ AI 校准建议 —— 触发式校验更精准（spec 005+）
- ❌ Mitigation 文字 AI 实时生成 —— 先硬编码（spec 005+）
- ❌ Rep Coaching / 团队差距分析 —— 后续主题攻势
- ❌ AI 主动巡检 cron —— 后续主题攻势
- ❌ Warning 工作流（已知道按钮 / 已忽略状态机）—— 自动消除够用

---

## 3. 关键设计判断（Q1-Q7 答案）

### 3.1 主体形态：单页 Gong 镜像（Q1 答案 A）

经理点菜单进这个页面，**一页所有信号铺开**——顶部 Forecast Categories 6 tab + 下面 Pipeline 全表 + 顶右 Deals/Team 切换 toggle。**信息密度本身就是产品价值**。

不是首页（首页是已有的业务全貌仪表盘 + onboarding 卡），是从主菜单点进去的独立菜单页。

### 3.2 Pipeline 行 = Lead + 3 新字段（Q2 答案 A）

Lead 表新增 `amount` / `close_date` / `forecast_category`。Lead 转化为 Customer 时不归档迁移——保留 lead 行，stage → `converted` 即可。

| Forecast 卡 | Lead 条件 |
|---|---|
| 进行中 / 必赢 / 大概率 / 乐观估算（4 卡）| `stage='active'` AND `forecast_category =` 对应值 |
| 已赢单 | `stage='converted'`（forecast_category 字段被 stage 覆盖）|
| 已丢单 | `stage='lost'`（同上）|

### 3.3 Forecast Categories 中文译名（Q3 概念）

| 英文原名 | 中文（UI 显示）| 一句话语义 |
|---|---|---|
| Open | **进行中** | 还没下判断的默认桶 |
| Commit | **必赢** | 销售拍胸脯：本期一定签 |
| Most Likely | **大概率** | 八成能签 |
| Best Case | **乐观估算** | 一切顺利能签 |
| Closed Won | **已赢单** | 签了 |
| Closed Lost | **已丢单** | 黄了 |

新建 lead 默认 `forecast_category = '进行中'`。

### 3.4 不引入"商机阶段"（Q3 概念延伸）

SFA CRM 当前没有 Sales Stage 字段，spec 004 也不引入。MEDDICC 7 维亮灯密度替代"流程位置感"——**商机阶段说的是流程走到哪了，Forecast Category 说的是销售拍胸脯会不会赢，这两个是独立的两个轴**。spec 004 用 Forecast Category（主观信心）+ MEDDICC 完成度（证据密度）两个轴，不需要再加 Stage。

### 3.5 Warnings 7 条（Q3 warnings）

详见 §5。

### 3.6 AI 介入：B 级（Q4 答案 B）

- 经理 Chat 升级（加 4 个团队级 tool + system prompt 微调）
- forecast_category 改到"必赢 / 大概率"时弹 AI 校验气泡
- 销售视角和经理视角都触发
- 3 秒超时放行
- **不做**：Pipeline 全表常驻 sparkle 校准 / 每日 cron 主动巡检 / mitigation AI 生成 →（spec 005+）

详见 §6 / §8。

### 3.7 趋势图：单 lead 级（Q5 答案 A）

- lead 详情页一张折线图（横轴时间 / 纵轴 Score 0-100）
- 新建 `lead_meddicc_history` 快照表
- 启动 spec 004 时 backfill 一次（对全部 active lead 跑一遍 analyze_meddicc 写 baseline）
- 后续每次 `analyze_meddicc` 调用 + 每次 `forecast_category` 变更都写一行 snapshot
- 永久保留（演示场景每 30min 重置数据自然轮转）
- **不做**：团队级趋势图

详见 §4.3 + §7.3。

### 3.8 移动端：语义对等 + 卡片化（Q6 答案 B）

详见 §9。

### 3.9 Team Rollup 视图（Q7 答案 A）

详见 §10。

---

## 4. 数据模型变更

### 4.1 `lead` 表新增字段

| 字段 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `amount` | REAL | NULL | 预计成交金额（人民币） |
| `close_date` | TEXT (ISO date) | NULL | 预计关单日期 |
| `forecast_category` | TEXT | `'进行中'` | 6 选 1：进行中 / 必赢 / 大概率 / 乐观估算 / 已赢单 / 已丢单。**仅 stage='active' 时此字段有效**；stage='converted' 时强制视为'已赢单'，stage='lost' 时强制视为'已丢单' |

CHECK 约束：`forecast_category IN ('进行中', '必赢', '大概率', '乐观估算', '已赢单', '已丢单')`。

迁移脚本：现存 lead 数据全部初始化 `forecast_category = '进行中'` / `amount = NULL` / `close_date = NULL`。

### 4.2 lead 转化逻辑改

`services/lead_service.py::convert_lead()` 现行逻辑：把 lead 标 `converted` + 写 `converted_at`，**不归档迁移**（已是这个逻辑，spec 004 沿用）。Customer 表新增一行的逻辑保留。

`mark_lead_lost()` 沿用现状（stage → `lost` + 写 `lost_at`）。

**spec 003 的"转化时归档迁移"在 alignment 里描述过，但实际代码已经是保留行，所以 spec 004 这一项无代码改动，仅做 spec 文档说明。**

### 4.3 `lead_meddicc_history` 新表

```sql
CREATE TABLE lead_meddicc_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL REFERENCES lead(id),
    snapshot_at TEXT NOT NULL,           -- ISO timestamp
    meddicc_score REAL,                  -- 0-100
    meddicc_completion INTEGER,          -- 0-7（亮灯数）
    dimensions_json TEXT,                -- {"M": {"evidence_count": 3, "lit": true}, "E": {...}, ...}
    forecast_category TEXT,              -- snapshot 时点的 forecast_category（spec 004 新加）
    amount REAL,                         -- snapshot 时点的 amount
    trigger_reason TEXT                  -- 'analyze' | 'forecast_change' | 'backfill'
);

CREATE INDEX idx_history_lead_time ON lead_meddicc_history(lead_id, snapshot_at);
```

**Snapshot 触发点：**
1. 每次 `analyze_meddicc(lead_id)` 调用后（spec 003 已有 service 钩子点）
2. 每次 `lead.forecast_category` 字段变更时（lead update API 加 trigger）
3. 启动时 backfill 一次（对全部 stage='active' lead 跑 analyze + 写 baseline，一次性）

### 4.4 `system_config` 阈值新增 / 迁移

新增 / 迁移到 SystemConfig 表的阈值：

| Key | 默认值 | 含义 | 来源 |
|---|---|---|---|
| `warning_silent_days` | 14 | 沉默 deal 触发天数 | spec 004 新加 |
| `warning_brag_lit_threshold` | 5 | 必赢但 MEDDICC 亮灯不足触发线（亮 < N 触发）| spec 004 新加 |
| `warning_close_imminent_days` | 14 | 关单日临近天数 | spec 004 新加 |
| `warning_close_imminent_score` | 60 | 临门 Score 警戒线（Score < N 触发）| spec 004 新加 |
| `warning_no_champion_followup_count` | 3 | 无 Champion 但已跟进 N 次触发 | spec 004 新加 |
| `warning_single_contact_days` | 30 | 单点接触触发天数 | spec 004 新加 |
| `warning_big_deal_amount_multiplier` | 3 | 大单金额阈值倍数（团队中位数 × N）| spec 004 新加 |
| `meddicc_score_completeness_weight` | 60 | MEDDICC Score 完整度权重 | **spec 003 迁过来**（之前 hardcode）|
| `meddicc_score_depth_weight` | 25 | MEDDICC Score 深度权重 | **spec 003 迁过来** |
| `meddicc_score_activity_weight` | 15 | MEDDICC Score 活跃度权重 | **spec 003 迁过来** |
| `meddicc_activity_recent_days` | 7 | 活跃度满分天数 | **spec 003 迁过来** |
| `meddicc_activity_acceptable_days` | 30 | 活跃度半分天数 | **spec 003 迁过来** |

迁移：`init_db.py` 加幂等 INSERT 缺失 key（沿用 spec 002 的"INSERT 缺失 key 不覆盖已存在"模式）。

### 4.5 ER 图（增量）

```
lead
  + amount
  + close_date
  + forecast_category
  ←── lead_meddicc_history (1 lead → N snapshots)

system_config (新增 7 条 warning 阈值 + 5 条 spec 003 迁移阈值)
```

---

## 5. Warnings 规则引擎设计

### 5.1 7 条规则触发条件

| # | Warning Code | 触发条件 | 默认阈值 | mitigation 文字（硬编码）|
|---|---|---|---|---|
| 1 | `silent_deal` | 最近 X 天没有任何 FollowUp / KeyEvent / Conversation | 14 天 | "建议主动联系客户重启沟通——14 天没动可能信号已凉" |
| 2 | `brag_without_evidence` | `forecast_category` ∈ ('必赢', '大概率') 且 MEDDICC 亮灯数 < N | 亮灯 < 5/7 | "MEDDICC 维度还不够全，建议先把 {缺失维度列表} 补上再下结论" |
| 3 | `close_imminent_low_score` | `close_date` 在 X 天内 且 MEDDICC Score < Y | 14 天内 / Score < 60 | "关单日临近但准备度不足——建议本周内补齐关键证据" |
| 4 | `overdue_not_closed` | `close_date < today` 且 `stage = 'active'` | —— | "关单日已过但未关闭——确认实际状态：标已赢单 / 已丢单 / 重设 close_date" |
| 5 | `no_champion_after_followups` | MEDDICC.Champion 维度空 + 该 lead 关联 FollowUp 数 ≥ N | ≥ 3 次跟进 | "跟进了 {N} 次但还没找到内部支持者——建议下次拜访重点观察客户内部谁在替你说话" |
| 6 | `single_contact_exposed` | `lead.contacts` 数 = 1 且 `lead.created_at` 距今 > N 天 | > 30 天 | "只靠 1 个联系人撑着 {N} 天——一旦此人离职/换岗即客户流失，建议拓展第二联系人" |
| 7 | `big_deal_thin_evidence` | `lead.amount` > 团队 amount 中位数 × N 倍 且 MEDDICC 亮灯 < 5/7 | 中位数 × 3 / 亮灯 < 5 | "大单证据偏薄——金额 {amount}（高于团队中位数 {N} 倍）但 MEDDICC 缺 {缺失维度}，建议升级为重点跟进" |

### 5.2 mitigation 文字模板说明

每条 warning 的 mitigation 文字是**硬编码模板**，模板里的 `{N}` / `{缺失维度}` / `{amount}` 等占位符在渲染时填入实际数值。**不调 LLM 生成**（spec 005+ 再升级到 AI 实时生成，per Q4 决策）。

### 5.3 Warning 计算时机

**策略：lazy compute on read，no cron**

- Pipeline 全表 / Team Rollup / lead 详情页 任一查询触发时，对查询范围内的 lead 实时计算 warnings
- 计算结果**不持久化**（避免 Warning 状态过期问题）
- 单次计算在 100 lead 量级 < 50ms（纯 SQL + 内存判断），可接受
- 超大量级（1000+ lead）时考虑缓存 5 分钟（spec 005+）

### 5.4 自动消除策略

Warning 是**计算结果**而非**状态字段**——每次查询时重算。条件不满足时 warning 自然消失。**不做"已知道 / 已忽略"工作流**（避免引入状态机）。

---

## 6. AI 校验 forecast_category 设计

### 6.1 触发条件

用户（销售或经理）通过任一接口（Pipeline 行内编辑 / 详情页 / mobile BottomSheet）把某条 lead 的 `forecast_category` 字段从其他值**升级到**`必赢` 或 `大概率` 时，**前端在 PUT 请求发出前**调一次 AI 校验接口。

**不触发的情况：**
- 降级（`必赢` → `大概率` 或 `必赢` → `乐观估算` 等）
- 改成 `进行中` / `已赢单` / `已丢单`
- AI 校验已在 60 秒内对此 lead 跑过（去重 cache）

### 6.2 LLM 调用 + schema 输出

**接口：** `POST /api/leads/{lead_id}/validate-forecast`
**Request：** `{ "target_category": "必赢" | "大概率" }`
**LLM Provider：** 沿用 spec 003 的 DeepSeek-chat（成本可控）
**System prompt（中文）：** "你是 SFA CRM 的销售辅导 AI。用户要把这条 lead 的 forecast_category 改到 {target_category}。请基于 MEDDICC 7 维证据 + 跟进记录，判断这个判断站不站得住脚。"
**Response schema（JSON）：**

```json
{
  "verdict": "support" | "challenge" | "abstain",
  "reasoning": "string (中文，简短，2-3 句)",
  "suggested_category": "string | null",
  "missing_dimensions": ["string"]
}
```

- `verdict = support` → 前端不弹气泡，直接发 PUT 请求
- `verdict = challenge` → 前端弹气泡（详见 §6.3），用户决策后才发 PUT
- `verdict = abstain` → 前端不弹气泡，直接发 PUT（AI 数据不足）

### 6.3 UI 流程

**PC dialog 弹窗：**

```
⚠️ AI 看了下你这条 lead 的证据：
{reasoning}

{若有 missing_dimensions：}
缺失维度：{missing_dimensions 中文化}

{若有 suggested_category：}
AI 建议改标"{suggested_category}"

[继续标"{target_category}"]  [改标"{suggested_category}"]  [先去补证据]
```

**Mobile dialog 模态：** 同 PC 内容，弹全屏 dialog（toast 太短读不完）。

### 6.4 超时降级

- LLM 调用 timeout = 3 秒
- 超时 / 接口失败 → 前端**直接放行**（继续发 PUT 请求），并 toast 一行小字 "AI 暂时校验不上，已放行"
- **不能让 AI 卡住销售工作流**

### 6.5 sales / manager 视角差异

- 销售视角触发 → 文案侧重"自检 + 提醒"
- 经理视角触发 → 文案侧重"双保险 + 反查"

system prompt 里加一段 `{user_role}` 注入，让 LLM 自适应文案语气（实现简单）。

---

## 7. 数据模型 + 趋势图

详见 §4.3。趋势图 UI 形态：

- lead 详情页右上角一张 200×120 的小折线图
- X 轴：snapshot_at（最近 30 天）
- Y 轴：meddicc_score（0-100）
- 数据源：`lead_meddicc_history` WHERE lead_id = X ORDER BY snapshot_at
- 技术选型：**recharts**（React 生态最成熟，跟 Next.js 兼容良好）
- 数据点 < 2 时显示空状态文字 "暂无趋势数据"
- Hover tooltip 显示具体 snapshot 时间 + Score
- 移动端宽度自适应

---

## 8. 经理 Chat 升级

### 8.1 新增 4 个 tool

| Tool name | Args | Returns | 触发场景 |
|---|---|---|---|
| `scan_team_warnings` | `manager_id` (从 session 取) | List of leads with warnings + warning code list | "团队哪几单存在风险" |
| `team_meddicc_summary` | `manager_id` | Team level summary：avg score / 7 维亮灯密度热力 / Top 3 / Bottom 3 sales | "团队 MEDDICC 完成度怎么样" |
| `top_attention_deals` | `manager_id`, `limit=5` | Top N deals 按风险加权排序（warning 数 + score 低 + amount 高） | "今天我该重点看哪几单" |
| `forecast_category_distribution` | `manager_id` | 6 个 forecast 桶各自的 lead 数 + amount 总和 | "团队 pipeline 分布情况" |

### 8.2 system prompt 微调

经理视角 system prompt 在 spec 003 既有基础上增加：

```
当用户角色是 manager 时，优先识别"团队/全员/我的下属"类问题。这类问题应调用：
- scan_team_warnings → 团队风险扫描
- team_meddicc_summary → 团队 MEDDICC 概览
- top_attention_deals → Top N 重点关注
- forecast_category_distribution → Pipeline 分布

回答这类问题时，结尾必带 [[nav:|/manager-pipeline]] 跳转到经理 Pipeline 页面，方便用户深挖。
```

### 8.3 跟 spec 003 chat 兼容

- spec 003 的销售视角 tool（search_leads / get_lead_detail / analyze_meddicc 等）全部保留
- 销售视角时 4 个新 tool 也可以调用（DataScope 已限定到本人名下，不会越权）
- 一套 chat 框架双视角 system prompt，不分叉

---

## 9. 移动端策略

### 9.1 Pipeline 全表 → 卡片列表

每条 deal 一张紧凑卡，卡上信息密度：

```
┌─────────────────────────┐
│ 深圳前海微链        [Score: 69]│
│ 王小明                  ⚠️ 2 │
│ M E D D I C C  ¥10万  3 天前 │
└─────────────────────────┘
```

- 顶行：deal name + Score badge
- 第二行：Owner + Warnings 数
- 第三行：MEDDICC 7 圆点（紧凑） + 金额 + 最近活动距今
- 点卡 → `/m/leads/{id}` 详情页（spec 003 已有）

### 9.2 Forecast Categories 6 tab → 横滑切换

沿用 spec 003 移动端 chat 5 tab 横滑模式。tab 标题旁显示条数：`必赢 (3)`。

### 9.3 行内编辑 → BottomSheet

forecast_category / amount / close_date 修改时，**点字段值即可弹 BottomSheet**（沿用 spec 003 MobileFormSheet 组件）。底部输入区 + 6 选 1 单选 + 确认按钮。

### 9.4 AI 校验气泡 → 全屏 dialog

移动端 toast 太短读不完，AI 校验弹**全屏 dialog**（覆盖式），3 个按钮纵向排列。

### 9.5 Team Rollup → 卡片栈

每个 sales 一张紧凑卡：

```
┌────────────────────────┐
│ [头像] sales01 王小明     │
│ Active: 5  Score 平均: 67 │
│ ⚠️ 4   总额 ¥80万   3 天前 │
└────────────────────────┘
```

点卡 drill-down 到 `/m/manager-pipeline?owner=sales01`。

### 9.6 经理 Chat 复用

复用 spec 003 移动端 chat 全屏入口（`/m/chat`），后端 system prompt 自动识别 manager 角色，4 个新 tool 自动可用。

### 9.7 主表默认排序：Score 升序

PC + Mobile 一致——最不健康的浮顶。

---

## 10. Team Rollup 视图（PC）

### 10.1 列定义

| 列 | 数据源 | 说明 |
|---|---|---|
| Sales（含头像）| user 表 | manager 名下的 sales |
| Active lead 数 | COUNT(lead) WHERE owner=sales AND stage=active | |
| 平均 Score | AVG(meddicc_score) WHERE owner=sales AND stage=active | 颜色 badge（≥80 绿 / 60-79 灰 / <60 红） |
| Warnings 数 | SUM of warnings across owner's leads | 数字大字 |
| 总金额 | SUM(amount) WHERE owner=sales AND stage=active | 千分位格式化 |
| 最近活动 | MAX(last_followup_at) across owner's leads | "X 天前" / "今天" |

### 10.2 默认排序

平均 Score 升序——最不健康的 sales 浮顶。

### 10.3 drill-down

点击行 → 切到 Deals 视图（同页面 toggle）+ 自动设置 `owner=` filter，看该 sales 名下具体 lead。

### 10.4 数据隔离

DataScope 沿用 spec 003 既有：
- admin → 看全公司
- manager → 看名下下属
- sales → 看自己（Team Rollup 视图对 sales 不显示，或仅显示自己一行）

---

## 11. 权限 / DataScope 复用

完全复用 spec 003 既有。无新权限模型。

| 角色 | 看 Pipeline 全表 | 看 Team Rollup | 改 forecast_category | 触发 AI 校验 |
|---|---|---|---|---|
| admin | 全公司 | 全公司 | ✅ | ✅ |
| manager | 团队（manager 名下 sales 名下的 lead）| 团队（manager 名下 sales）| ✅ | ✅ |
| sales | 自己名下 | 不显示 / 仅自己一行 | ✅（仅自己 lead）| ✅ |

---

## 12. 演示数据 / 场景

### 12.1 沿用 spec 003 demo lead

3 条 demo lead 已有：前海微链（69）/ 数字颗粒（77）/ 智联云（69）。

### 12.2 spec 004 新增

- 给每条 demo lead 标 `forecast_category`：演示分布（让 6 个 tab 都有内容）
- 给每条 demo lead 标 `amount` + `close_date`（演示 Pipeline 排序 + 关单日临近 warning）
- 增加几条 demo lead 凑足 6 tab 各有数据（建议 manager01 名下总共 8-10 条 lead 分布于 4 个 active forecast bucket + 1 已赢 + 1 已丢）
- backfill 时跑 baseline snapshot

### 12.3 演示场景配套

延续 spec 003 的 onboarding 卡（manager01 「📊 团队 MEDDICC 完成度」），点击进 manager pipeline 页面。

---

## 13. 性能 / 限流

### 13.1 Backfill 时间估算

100 条 lead × analyze_meddicc 30s 每次 = 50 分钟。**异步执行**（启动后台任务，不阻塞应用启动）。完成后清空进度 flag。前端在 backfill 期间显示 "趋势数据准备中" 提示。

### 13.2 LLM 调用限流

沿用 spec 002 限流（10/min per user, 100/day per user, 200/hour 全站熔断）。AI 校验沿用同一限流。

### 13.3 Warning 计算

lazy on read，单次 < 50ms。无 cron。

### 13.4 AI 校验超时

3 秒超时直接放行，不阻塞用户。

---

## 14. 验收标准

### 14.1 PC 核心场景（Playwright + 真实 LLM）

1. **manager01 进 Pipeline 全表** → 默认 Deals 视图 + Forecast 6 tab + 主表显示 manager01 名下全部 active lead
2. **切到 Team tab** → 显示 sales01/02/03 三行 + 点击 sales01 行 drill-down 回 Deals 视图 + 自动 filter owner=sales01
3. **manager01 修改一条 lead 的 forecast_category 到"必赢"** → 弹 AI 校验 dialog → 选"继续标必赢" → forecast 改成功
4. **进一条 lead 详情页** → 显示 MEDDICC 仪表盘（spec 003）+ 趋势小图（spec 004 新加）
5. **manager01 在 Chat 提问"团队哪几单存在风险"** → AI 调用 `scan_team_warnings` → 返回风险 lead 列表 + 跳转链接

### 14.2 Mobile 核心场景

1-5 同 PC 内容，但形态是卡片化 + BottomSheet + dialog 弹。

### 14.3 AI 校验 case

1. 标"必赢"+ MEDDICC 不全 → AI 弹气泡反问 → 用户选"先去补证据"
2. 标"必赢"+ MEDDICC 完整 → AI verdict=support → 不弹气泡直接放行
3. AI 接口超时 → 直接放行 + toast "AI 暂时校验不上"

### 14.4 趋势图 case

1. lead 详情页打开 → 趋势图显示 ≥ 2 个数据点
2. 新建 lead → 趋势图显示空状态文字

### 14.5 e2e 总数

预期累计：spec 003 的 67 用例 + spec 004 新增 8-10 个 PC + 8-10 个 Mobile = **总 83-87 个 e2e**。

---

## 15. 测试策略

### 15.1 后端 pytest

- Warnings 7 条规则引擎单元测试（每条规则 1 个正例 + 1 个反例）
- AI 校验接口测试（mock LLM 返回 support / challenge / abstain）
- lead_meddicc_history snapshot 触发测试
- backfill idempotent 测试
- DataScope 测试（manager / sales / admin）

### 15.2 Playwright PC 套件

新增 `pc-manager-pipeline-regression.spec.ts`，覆盖 §14.1 全部场景。沿用 spec 003 的 `forbidPhrases` 反向断言（不应出现"已创建" / 假 lead_id 等幻觉文案）。

### 15.3 Playwright Mobile 套件

新增 `mobile-manager-pipeline-regression.spec.ts`，覆盖 §14.2 全部场景。

### 15.4 集成回归

`pc-meddicc-cases-regression.spec.ts` + `mobile-meddicc-cases-regression.spec.ts`（spec 003 已有）继续跑，确保 spec 004 改动**不破坏 spec 003 销售视角功能**。

---

## 16. 风险登记

| # | 风险 | 缓解 |
|---|---|---|
| 1 | AI 校验慢导致 forecast 修改卡顿 | 3 秒超时 + 直接放行 + toast 提示 |
| 2 | backfill 时间长（>10 分钟）阻塞启动体验 | 异步执行 + 前端 "趋势数据准备中" 占位 |
| 3 | Warnings 规则引擎漏判 / 误判 | 阈值进 SystemConfig，admin 后台可调；e2e 覆盖正反例 |
| 4 | Pipeline 全表数据量大时排序慢 | lead 表 owner_id + meddicc_score + close_date 加索引 |
| 5 | AI 校验弹太频繁打扰用户 | 60s 内同一 lead 去重 cache（不重复弹） |
| 6 | demo 数据每 30min 重置导致趋势图空 | 接受——演示场景下用户能看到 30min 内的数据演化已经够 |
| 7 | Forecast Category 中文 vs 英文混用引发 bug | DB 存中文，code 全程中文常量，避免英文中间层 |
| 8 | Mobile 卡片 7 圆点显示不下 | 字号 / 间距精细调整，e2e 双套断言显示宽度 |

---

## 17. 后续衔接（spec 005+ 预告）

| 后续 spec 候选 | 衔接点 |
|---|---|
| **AI 校准升级到常驻 sparkle** | Pipeline 全表 forecast_category 列加 sparkle ✨ icon，每天 cron 跑全量校准 |
| **Mitigation 文字 AI 实时生成** | 7 条 warning 的 mitigation 模板替换为 LLM 实时调用 |
| **AI 主动巡检（每日报告）** | cron 每日扫一遍全部 active lead，生成"今日值得关注的 5 条 + 原因"邮件 / 站内通知 |
| **团队级趋势图** | 周聚合 snapshot + 经理首页 dashboard 加一张折线图 |
| **完整 Sales Forecasting 体系**（独立大 spec）| 多层提报链 + Submission snapshot + 准确率回测 |
| **Rep Coaching 团队差距分析** | 跨 sales 横向对比 MEDDICC 完成度模式 + 最佳实践提取 |

---

## 18. 内容产出（4 轨道映射）

| 轨道 | 产出 |
|---|---|
| **A 杨老师硬观点** | 1 篇候选："为什么我相信 MEDDICC 是 ToB 销售管理的元方法论"（视情况写） |
| **B 功能扩展** | spec 004 本身落地 |
| **C AI 玩法实验** | "AI 反问销售吹牛"作为 spec 002 立的 HITL 边界的延伸案例（在 S2E04 文章中讲） |
| **D 克劳蛋系列** | **S2E04**：经理视角 MEDDICC + 全表 + Warnings + AI 反问 + 趋势复盘 |

---

## 19. spec-kit 落地步骤

1. ✅ stakeholder 审本对齐稿（你正在看）→ 修订后 commit 到 `inputs/alignment.md`
2. `/speckit.specify` → `spec.md`（用户故事 + 验收准则）
3. `/speckit.plan` → `plan.md` + `research.md` + `data-model.md` + `contracts/`
4. `/speckit.tasks` → `tasks.md`（拆 ~50 任务）
5. `/speckit.implement` → 实施（TDD + 多 commit + Playwright e2e 双套）
6. PR `004-meddicc-manager-pipeline` → master，merge commit 打 `v-spec004` tag → push origin
7. 更新 `MASTER-PLAN.md` 三列映射表（v-spec004 → 实际 commit hash）
8. 更新全局 memory `project_sfacrm_content.md` 加 spec 004 完成日志
9. 写 S2E04 文章（路径 `Kun's Context/articles/sfa-crm-series/season-2/S2104-YYYY-MM-DD-XXX.md`，4 张漫画）
10. 公网部署切到 `v-spec004` → 录视频 → 发文

预计总时长：**spec-kit 阶段 1-2 天 + 实施 1.5-2 周 + 文章 0.5 天 = 总计 ~2 周**。
