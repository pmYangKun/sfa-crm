# Feature Specification: MEDDICC 销售视角 — 对话录入 + AI 抽证据 + 仪表盘 + 场景卡

**Feature Branch**: `003-meddicc-sales`
**Created**: 2026-05-05
**Status**: Draft
**Input**: User description: "MEDDICC 销售视角：对话录入 + AI 抽 7 维度证据 + 仪表盘 + Score + Chat 集成"
**Alignment Source**: [`inputs/alignment.md`](inputs/alignment.md)（brainstorming 7 个锁定决策）

---

## 一、概述

把 Gong 哲学（行为驱动 + AI 抽 MEDDICC 证据 + 仪表盘可视化）以**演示用户友好**的形态落地到 SFA CRM 的 Lead 对象上：

- **演示用户视角（公网访客，5 分钟体验）**：一键点击演示场景卡 → 系统自动注入对话 + AI 抽 MEDDICC 证据 + 仪表盘动画刷新
- **数据燃料**：新增 Conversation 实体，让 AI 有充足上下文抽取 7 维度证据（Metrics / Economic Buyer / Decision Criteria / Decision Process / Pain / Champion / Competition）
- **HITL 边界**：本 spec **去掉了 HITL 确认环节**，AI 自动写入 evidence；用户可重新分析 / 删除单条证据 / 删除对话
- **范围**：仅销售视角；经理视角（Pipeline 全表 / Forecast Categories / 团队 rollup / Warnings 规则引擎 / 趋势图）独立为 spec 004

---

## 二、User Scenarios & Testing *(mandatory)*

### User Story 1 - 5 分钟 demo 体验完整路径（Priority: P1）

公网访客打开 demo 站，登录任一演示账号（默认 sales01），进入种子 demo 线索的详情页。"对话记录" tab 顶部展示 5-7 张演示场景卡片，"MEDDICC 仪表盘" tab 已经亮灯并显示 Score。访客点击任一场景卡片 → 系统自动批量注入对话记录 + 同步触发 AI 抽证据 + 仪表盘动画刷新（圆点逐个亮起 + Score 跳数）。

**Why this priority**: 这是 demo 站访客的核心震撼路径——5 分钟内体验"AI 一键读懂 deal"的魔法。没有这条路径走通，整个 spec 003 的对外价值无法兑现。

**Independent Test**: 演示用户登录 sales01 → 进入 "深圳前海微链" 详情页 → 看到仪表盘已亮 Score 78 + 6/7 维度 → 切到对话记录 tab → 点 "拜访赵总（首次深聊）" 卡片 → toast 显示 "正在分析中" → 2-4 秒后仪表盘动画刷新，新维度亮灯 + Score 重算。**完整 MVP 价值在此故事独立交付**。

**Acceptance Scenarios**:

1. **Given** 演示用户首次登录 sales01 且进入种子 demo lead 详情页，**When** 切换到 "MEDDICC 仪表盘" tab，**Then** 看到非零 Score、≥4 个维度亮灯、Next Best Action 提示、"上次分析于 X 分钟前" 时间戳
2. **Given** 演示用户在 demo lead 的 "对话记录" tab，**When** 点击任一场景卡片的 "应用 →" 按钮，**Then** 看到 toast "正在分析中"，2-4 秒后场景卡变成 "已应用 ✓"、对话列表新增 1-3 条带 "[来自场景卡]" 标签的对话、仪表盘动画刷新（新维度亮起或 Score 跳数）
3. **Given** 演示用户半小时前体验过 demo（数据被 spec 002 自动重置），**When** 重新登录进入相同 demo lead，**Then** 仪表盘仍然亮灯（init_db 重置时已重跑 analyze）

---

### User Story 2 - 进阶用户自助操作（Priority: P2）

演示用户在没有任何对话的 lead 上手动新增一段对话（粘贴文本 + 选时间），系统在保存后自动触发 AI 分析，仪表盘从空变亮。用户也可以查看任意单条证据的来源（hover 显示"AI 从第 N 段对话抽取"）、删除单条证据、删除单条对话、点击"重新分析"按钮重新计算。

**Why this priority**: 让进阶用户能"自己玩"，不只被动消费场景卡。是 P1 的进阶补充——P1 不可用时，用户仍能从这条路径体验功能。

**Independent Test**: 进任意空 demo lead → 点 "新增对话" → 弹窗内粘贴一段销售-客户对话文本 → 保存 → 仪表盘从全灰变亮（新增至少 1-2 个维度证据）→ 在仪表盘上展开某维度 → 点删除某条证据 → 仪表盘 Score 下降。

**Acceptance Scenarios**:

1. **Given** 演示用户在一条空白 lead 的"对话记录" tab，**When** 点 "新增对话" 弹窗内填写时间 + 粘贴 ≥200 字对话内容并保存，**Then** 弹窗关闭后仪表盘自动从全灰更新到至少 1 个维度亮灯
2. **Given** 用户在 MEDDICC 仪表盘看到某维度有 3 条证据，**When** 展开该维度并点击其中一条证据的删除按钮，**Then** 该条 evidence 从 DB 删除，Score 重算下降，仪表盘 UI 同步刷新
3. **Given** 用户对仪表盘结果不满意，**When** 点击顶部"重新分析"按钮，**Then** 系统重新读 lead 全量上下文 → 调 LLM → Replace 写入新 evidence → 返回新仪表盘
4. **Given** 用户删除一条对话记录，**When** 删除请求成功，**Then** 系统同步触发重新分析（因上下文变化），返回新仪表盘

---

### User Story 3 - Chat 自然语言入口（Priority: P3）

演示用户在 Chat（PC sidebar 或 Mobile fullscreen）里用自然语言提问"分析 [公司名] 这条线索"，AI 识别意图调用 `analyze_meddicc(lead_id)` 工具，在 Chat 里渲染 `ChatMeddiccReportCard` 组件（公司名 + Score + 7 圆点 + Next Best Action + 跳转仪表盘按钮 + 重新分析按钮）。

**Why this priority**: 体现项目"对话式 + 行为驱动"心智，是 mobile 端经理消费的主战场。但 P1 已能交付仪表盘体验，P3 不阻塞 MVP。

**Independent Test**: 用户在 Chat 里输入"分析深圳前海微链这条线索" → AI 调 analyze_meddicc → Chat 内渲染 ChatMeddiccReportCard 卡片，含 Score、7 维度状态、NBA 提示、"去仪表盘 →" 跳转链接。

**Acceptance Scenarios**:

1. **Given** 演示用户在 PC chat sidebar，**When** 输入"看一下深圳前海微链状态"或"分析深圳前海微链"，**Then** Chat 渲染 ChatMeddiccReportCard，显示 Score、6/7 完成度、未亮维度的 NBA 提示
2. **Given** 演示用户在 Mobile chat fullscreen，**When** 同上输入，**Then** 渲染移动版的 ChatMeddiccReportCard（垂直布局，关键信息保留）
3. **Given** ChatMeddiccReportCard 已渲染，**When** 用户点击"重新分析"按钮，**Then** AI 调 analyze_meddicc 工具 → 渲染新版 ChatMeddiccReportCard 替换旧卡片

---

### User Story 4 - Mobile 浏览简版（Priority: P4）

移动端访客进入 lead 详情页 (`/m/leads/[id]`)，看到"对话记录"和"MEDDICC 仪表盘"以折叠卡片呈现，仪表盘默认展开。7 维度纵向 list（圆点 + 维度名 + 证据数）+ 顶部 Score + "重新分析"按钮。**移动端不显示场景卡片网格**（场景卡仅在 PC 触发，Mobile 主要消费 chat 报告）。

**Why this priority**: Mobile 是项目阶段 1 的重要形态，但经理使用频率低于 PC，先做简版可接受。属于 polish 而非核心 MVP。

**Independent Test**: 移动端登录 sales01 → 进 demo lead → 看到仪表盘默认展开、7 维度纵向显示、Score 正确 → 点击某维度可展开看证据列表（不含删除按钮，移动端只读）。

**Acceptance Scenarios**:

1. **Given** 移动端用户进入 demo lead 详情页，**When** 页面渲染完成，**Then** "MEDDICC 仪表盘" 折叠卡默认展开，显示 Score 顶部条 + 7 维度纵向 list + "重新分析"按钮
2. **Given** 移动端用户点击 "重新分析" 按钮，**When** 同步调用完成，**Then** 仪表盘重新渲染，显示更新后数据
3. **Given** 移动端用户进入仪表盘 tab，**When** 查看页面，**Then** **没有场景卡片网格出现**（移动端简版排除）

---

### Edge Cases

- **空上下文 Lead 触发分析**：lead 没有任何 conversation / followup / key_event 时调 `/meddicc/analyze` → 系统不调 LLM，直接返回 `evidences=[], score=0` + 提示"请先录入对话或跟进记录"
- **LLM 幻觉 source_id**：LLM 返回的 `source_id` 在 DB 找不到对应 conversation/followup/key_event → 该条 evidence 跳过不入库（沿用 spec 002 防 FK 幻觉哲学），日志记录
- **LLM 不返回有效 JSON**：retry 1 次仍失败 → HTTP 503 + 前端 toast "AI 分析失败，请稍后重试"
- **LLM 调用超时（>15s）**：返回 503，仪表盘保持上一次成功的 evidence
- **用户连续快速点击"重新分析"**：spec 002 限流（10/分 + 100/天 + 全站 200/小时）天然兜底，超阈值返回 429 + 前端友好气泡
- **演示场景卡重复应用**：用户已应用过的卡片显示"已应用 ✓"状态（前端禁用按钮），但若手动点（开发者工具下）会拒绝插入相同 scenario_card_id 的对话
- **删除对话造成 evidence 孤儿**：删除 conversation 后系统同步重新分析，evidence 表 Replace，原指向已删 conversation 的 evidence 自然消失
- **Score 边界**：所有 7 维度都填满 + ≥14 条证据 + 7 天内有新对话 → score 应该接近 100（不超过 100）；空数据 → score = 0
- **跨 Lead Owner 数据权限**：sales01 不能 GET/POST/DELETE 其他销售拥有的 Lead 的 conversation / evidence / analyze（沿用 DataScope 现有规则）
- **半小时数据重置后种子状态**：reset_business_data 清空 conversation + evidence 表后，init_db 重新跑 seed_demo_business_data，对每个 demo lead 调用一次 analyze_meddicc，恢复亮灯状态

---

## 三、Requirements *(mandatory)*

### Functional Requirements — 数据模型与持久化

- **FR-001**: 系统 MUST 提供 `conversation` 实体，每条记录包含 `id / lead_id / recorded_at / content / source / scenario_card_id / created_by / created_at` 字段，关联到 lead
- **FR-002**: 系统 MUST 提供 `lead_meddicc_evidence` 实体，每条证据 first-class，字段包含 `id / lead_id / dimension / source_type / source_id / evidence_text(≤200字) / confidence(0-1) / created_at`，无 status 字段
- **FR-003**: 系统 MUST 在 Lead 表加 3 个衍生字段缓存：`meddicc_score (Float, 0-100) / meddicc_completion (Int, 0-7) / meddicc_last_analyzed_at (str, ISO)`
- **FR-004**: 系统 MUST 在每次 evidence 集合变更（增删）后**同步重算** Lead 的 3 个 MEDDICC 衍生字段，缓存与 evidence 表保持一致
- **FR-005**: 系统 MUST 用 **Replace 策略** 写 evidence——每次 analyze 先 `DELETE FROM lead_meddicc_evidence WHERE lead_id = X`，再 INSERT 新 evidence

### Functional Requirements — AI 抽证据服务

- **FR-006**: 系统 MUST 提供 `analyze_meddicc_evidence(lead_id)` 服务，输入 lead_id 后读取该 lead 全量上下文（conversations + followups + key_events + lead 基本信息）
- **FR-007**: 系统 MUST 用 LLM（默认 deepseek-chat，沿用 spec 002 LLM 配置）按结构化 JSON 输出 7 维度证据列表
- **FR-008**: 系统 MUST 在 LLM 输出后做严格校验：dimension 在 7 个枚举内 / source_id 在 DB 中真实存在 / evidence_text ≤200 字 / confidence ∈ [0, 1]，校验失败的条目跳过并记日志
- **FR-009**: 系统 MUST 在 LLM 不返回有效 JSON 时 retry 1 次，仍失败则返回 HTTP 503
- **FR-010**: 系统 MUST 在 lead 上下文为空（无任何 conversation/followup/key_event）时**不调 LLM**，直接返回空 evidence + score=0
- **FR-011**: 系统 MUST 把 `analyze_meddicc_evidence` 作为 chat tool 注册到 agent_service.TOOL_DEFINITIONS，让 LLM 能在自然语言"分析 XX 线索"对话中调用

### Functional Requirements — 8 个 API 端点

- **FR-012**: `GET /api/v1/leads/{lead_id}/conversations` MUST 列出该 lead 的所有 conversation，遵循 DataScope 数据权限
- **FR-013**: `POST /api/v1/leads/{lead_id}/conversations` MUST 接受 manual 录入（content + recorded_at），保存后**同步触发 analyze**并返回新仪表盘
- **FR-014**: `DELETE /api/v1/conversations/{id}` MUST 删除单条对话并**同步触发 analyze 重算**，返回新仪表盘
- **FR-015**: `GET /api/v1/leads/{lead_id}/meddicc` MUST 返回仪表盘数据（按 7 维度聚合 evidence + score + completion + last_analyzed_at）
- **FR-016**: `POST /api/v1/leads/{lead_id}/meddicc/analyze` MUST 触发 AI 分析（同步，1-3s 内返回新仪表盘）
- **FR-017**: `DELETE /api/v1/meddicc-evidence/{id}` MUST 删除单条证据，**同步重算 Lead.meddicc_score** 并返回新仪表盘
- **FR-018**: `GET /api/v1/leads/{lead_id}/scenario-cards` MUST 返回该 lead 适用的场景卡列表，每张卡附带 `applied: bool`（基于 conversation 表中是否存在对应 scenario_card_id）
- **FR-019**: `POST /api/v1/leads/{lead_id}/scenario-cards/{card_id}/apply` MUST 批量插入场景卡定义的所有对话 + **同步触发 analyze** + 返回新仪表盘

### Functional Requirements — 限流与安全

- **FR-020**: 系统 MUST 把 `/meddicc/analyze` 与 `/scenario-cards/{id}/apply` 端点纳入 spec 002 的限流：用户视角 10/分 + 100/天，全站熔断 200/小时
- **FR-021**: 系统 MUST 在所有 conversation / evidence / analyze / scenario-card 端点应用 DataScope 数据权限：sales 仅可访问自己 owner 的 lead，manager 可访问团队，admin 可全访问
- **FR-022**: 系统 MUST 拒绝任何允许 LLM 直接修改 lead/customer/followup 主业务数据的尝试——LLM 仅可写自己派生的 evidence 数据（沿用 spec 002 HITL 哲学）

### Functional Requirements — 前端 UX

- **FR-023**: 系统 MUST 在 PC `/leads/[id]` 详情页加 2 个新 tab："对话记录" 和 "MEDDICC 仪表盘"
- **FR-024**: 对话记录 tab MUST 在顶部显示场景卡片网格（横向布局，3-5 张可见 + 横向滚动），每张卡含 title / description / 状态按钮（"应用 →" 或 "已应用 ✓"）
- **FR-025**: 对话记录 tab MUST 显示已有对话列表，每条带时间 / 来源标签（手动/场景卡/种子）/ 内容预览 / 展开 / 删除按钮
- **FR-026**: MEDDICC 仪表盘 tab MUST 显示顶部条（Score 大数字 + 完成度环形 + 上次分析时间 + 重新分析按钮）+ 7 维度卡片网格（2 行布局）+ Next Best Action 提示
- **FR-027**: 7 维度卡片 MUST 支持点击展开查看 evidence 列表，每条 evidence 显示 confidence 条 + 来源跳转链接 + 删除按钮
- **FR-028**: 系统 MUST 在 Mobile `/m/leads/[id]` 提供 MEDDICC 折叠卡（默认展开）+ 对话记录折叠卡（默认折叠），不显示场景卡网格
- **FR-029**: 系统 MUST 在 Chat（PC sidebar + Mobile fullscreen）支持自然语言识别"分析 [公司名] 这条线索" → 调 analyze_meddicc 工具
- **FR-030**: 系统 MUST 在 Chat 中渲染 `ChatMeddiccReportCard` 组件（含 Score / 7 圆点 / NBA / 跳转仪表盘按钮 / 重新分析按钮），视觉沿用现有 `ChatFormCard` 设计模式
- **FR-031**: 应用场景卡或新增对话或重新分析后，仪表盘 MUST 以"圆点逐个亮起 + Score 数字补间动画"刷新视图（演示效果灵魂，不可省略）

### Functional Requirements — 种子数据与重置

- **FR-032**: 系统 MUST 在 `seed_demo_business_data()` 中向 2-3 条 demo lead 预置 5-10 条种子对话（source = `mock_seed`），并在最后**对每个 demo lead 调用一次 analyze_meddicc_evidence**，使首次访客即看到亮灯仪表盘
- **FR-033**: 系统 MUST 把 `conversation` 与 `lead_meddicc_evidence` 加入 spec 002 的 `reset_business_data()` 清空表列表，半小时重置后状态归零
- **FR-034**: 系统 MUST 提供 5-7 张场景卡定义（前端常量 + 后端字典，不建表），每张卡覆盖 2-3 个 MEDDICC 维度，5-7 张合起来覆盖全部 7 维度
- **FR-035**: 场景卡 MUST 绑定到具体 demo lead 公司名（不是任意 lead）——前端只在该 lead 详情页显示对应卡片，避免演示用户在错误的 lead 上点卡导致违和

### Functional Requirements — Score 算法

- **FR-036**: 系统 MUST 用以下算法计算 `meddicc_score`：

  ```
  完整度分 = (有证据的维度数 / 7) × 60          # 0-60
  深度分   = min(总证据条数, 14) / 14 × 25       # 0-25，14 条封顶
  活跃度分 = 15 if 7 天内有新对话或新分析
           = 8  if 30 天内
           = 0  otherwise                        # 0-15

  meddicc_score = round(完整度分 + 深度分 + 活跃度分)  # 0-100
  ```

- **FR-037**: 系统 MUST 用前端常量字典（不调 LLM）按"最弱维度"生成 Next Best Action 文案；NBA 文案随维度查表，每维度对应 1 条预置话术

---

### Key Entities *(数据领域模型)*

- **Conversation（对话记录）**：销售-客户的原始对话内容，关联 lead；记录来源可能是手动录入（演示用户粘贴）/ 场景卡批量注入 / 种子 mock。是 AI 抽 MEDDICC 证据的核心数据燃料。
- **LeadMeddiccEvidence（MEDDICC 证据）**：AI 从 lead 全量上下文（conversation + followup + key_event）中抽取出的单条 MEDDICC 维度证据，每条 first-class，含 dimension + source_type + source_id + evidence_text + confidence。Lead 仪表盘按 dimension 聚合此表。
- **Lead（既有，扩展 3 字段）**：增加 `meddicc_score / meddicc_completion / meddicc_last_analyzed_at` 衍生缓存字段，每次 evidence 变更后重算。**概念上 score 仍是从 evidence 派生**（符合宪法第六条），缓存仅为查询性能优化。
- **ScenarioCard（场景卡，非 DB 实体）**：演示用预定义对话剧本，前端常量 + 后端字典存储（不建表）。每张卡含 title / description / applies_to_lead_company / conversations[]（每条 recorded_at_offset_days + content）。
- **MEDDICC Dimension（7 维度枚举）**：`metrics / economic_buyer / decision_criteria / decision_process / pain / champion / competition`，每个维度有培训行业本地化定义（参见 alignment.md §三）。

---

## 四、Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 演示用户首次进入种子 demo lead 后**5 秒内**能看到亮灯的 MEDDICC 仪表盘（≥4 个维度有证据 + 非零 Score + 上次分析时间显示）
- **SC-002**: 演示用户从点击场景卡片到看到仪表盘动画完成的端到端时长 **≤ 4 秒**（含 LLM 调用 + Replace 写库 + 前端动画）
- **SC-003**: AI 抽证据 JSON 解析失败率 **< 5%**（统计 30 天 prompt_guard / chat_audit 表中 analyze 失败次数 ÷ 总调用次数）
- **SC-004**: 演示场景卡片应用后，新增的所有 conversation 行的 `scenario_card_id` 字段 **100% 可追溯**到原场景卡 id
- **SC-005**: 半小时数据重置后，下次访客进入 demo lead **仪表盘仍亮灯**（init_db 重跑 analyze 成功，meddicc_completion ≥ 4）
- **SC-006**: 任意时刻 Lead.meddicc_score 与 evidence 表实际数据**保持一致**（重算逻辑无 bug）——通过 pytest 集成测试覆盖
- **SC-007**: Mobile 端 MEDDICC 折叠面板**渲染时间 < 1 秒**（含 API 调用）
- **SC-008**: chat 内 "分析 [公司名] 这条线索" 自然语言指令的成功识别率 **> 90%**（10 个种子 case 至少 9 个能正确触发 analyze_meddicc 工具）
- **SC-009**: 演示用户在 Lead 详情页消费 MEDDICC 仪表盘 + 应用至少 1 张场景卡 + 体验 chat 报告卡片，**端到端 ≤ 5 分钟**
- **SC-010**: 单线索 Lead 上累积超过 50 条 conversation 时，analyze API **响应时间 < 5 秒**（含 LLM）

---

## 五、Assumptions

- **DeepSeek-chat 作为默认 LLM provider**，沿用 spec 002 LLM 配置；不引入新的 Anthropic / OpenAI 直连
- **演示用户为公网访客**，5 分钟以内体验时长，没有动力做 HITL 逐条采纳——这是去掉 HITL 的根本依据
- **培训公司业务语境**（小课 2 万 + 大课 20 万），MEDDICC 维度按培训行业本地化（参见 alignment.md §三）
- **现有 spec 002 的限流 / 熔断 / chat_audit / 数据重置机制已在线**，不重复设计，仅扩展清空表列表
- **Mobile 端经理使用频率低**，先做简版（无场景卡 + 无单条证据删除），后续 spec 005 可加强
- **半小时数据重置（spec 002）已建立**，本 spec 仅添加 conversation 与 evidence 到清空表列表 + init_db 重跑 analyze
- **现有 init_db 种子数据**（admin / sales01-03 / manager01）和 **DataScope 权限**已建立，本 spec 直接复用
- **LLM 抽证据可能不稳定**——通过 few-shot examples + JSON validate + retry + 前端单条删除做兜底，**残余风险接受**（演示场景下偶尔抽到怪东西可点删）
- **场景卡剧本质量** 由 stakeholder 在实施阶段审一遍话术，避免塑料感
- **spec 003 不包含**经理 Pipeline 视图 / Forecast Categories / 团队 rollup / 趋势图 / Warnings 规则引擎（spec 004 范围）
- **spec 003 不包含**音频上传 / 文件上传 / MEDDICC 编辑 UI / HITL 采纳工作流（明确排除，参见 alignment.md §十二）

---

## 六、宪法合规性自检

| 宪法条款 | 本 spec 的对应 |
|---|---|
| **一、Ontology 优先** | Conversation 与 LeadMeddiccEvidence 均为显式实体；Lead.meddicc_score 概念上是从 evidence 派生（每次重算），缓存仅为查询性能 |
| **二、API 优先** | 8 个端点全在 RESTful API 层；analyze_meddicc 既是 service 也注册为 chat tool，GUI 与 Agent 共用 |
| **三、业务规则可配置** | Score 算法权重（60/25/15）暂硬编码于 spec，未来若需要可移到 SystemConfig 表（spec 003 不实施这步） |
| **四、数据完整性** | LLM 返回的 source_id 必须 DB 校验（防 FK 幻觉）；限流防自动化滥用；DataScope 权限保数据隔离 |
| **五、最小化销售录入负担** | AI 自动抽证据 + 用户只需查看/删除/重新分析，不需要手填 7 个 MEDDICC 字段 |
| **六、显式优于隐式** | 每条 evidence 有源（source_type + source_id）+ confidence；Replace 策略明确；FR 列表覆盖所有行为 |

---

## 七、与 alignment.md 的偏差说明

**无重大偏差**。本 spec 是 alignment.md 的结构化重写，所有 7 个锁定决策、7 字段定义、API 列表、数据模型、Score 算法、UX、种子数据策略、风险与排除项均忠实反映。

唯一新增（非偏差，是 spec.md 模板的扩展产物）：
- 4 个 User Stories 按 P1-P4 优先级拆分（每个独立可测）
- 10 条 Success Criteria（量化指标）
- 12 条 Edge Cases（明确边界行为）
- 宪法合规性自检章节

---

**Status**: Draft → 待 stakeholder review → 通过后进入 `/speckit.plan` 生成 plan.md + data-model.md + contracts/。
