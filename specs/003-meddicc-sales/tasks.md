---
description: "Task list for MEDDICC 销售视角 — 对话录入 + AI 抽证据 + 仪表盘 + 场景卡"
---

# Tasks: MEDDICC 销售视角

**Input**: Design documents from `/specs/003-meddicc-sales/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/api-contracts.md, quickstart.md

**Tests**: 本 feature **强制要求 pytest 集成测试 + Playwright e2e**——AI 抽证据 / Replace 策略 / FK 防幻觉 / Score 算法 / 场景卡防重复 / 限流接入都是关键路径，必须有自动化覆盖。

**Organization**: Tasks 按 user story 分组（P1-P4），每组独立可测可 ship。Setup + Foundational 完成后，US1（核心 MVP）即可独立交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无依赖）
- **[Story]**: US1 / US2 / US3 / US4 / 全局
- **路径约定**：所有路径相对项目根 `d:/MyProgramming/cc/SFACRM/`

---

## Phase 1: Setup（共享基建）

**Purpose**: 数据模型 + TypeScript 类型镜像就位。所有 user story 都依赖这些。

- [ ] **T001** [P] 创建 [`src/backend/app/models/conversation.py`](src/backend/app/models/conversation.py)，按 [data-model.md § 二](specs/003-meddicc-sales/data-model.md) 定义 `Conversation` 类（id / lead_id / recorded_at / content / source / scenario_card_id / created_by / created_at + 2 个索引）。
- [ ] **T002** [P] 创建 [`src/backend/app/models/lead_meddicc_evidence.py`](src/backend/app/models/lead_meddicc_evidence.py)，按 [data-model.md § 三](specs/003-meddicc-sales/data-model.md) 定义 `LeadMeddiccEvidence` 类（id / lead_id / dimension / source_type / source_id / evidence_text / confidence / created_at + 3 个索引，无 status 字段）。
- [ ] **T003** 改造 [`src/backend/app/models/lead.py`](src/backend/app/models/lead.py) 加 3 个衍生字段（`meddicc_score: Optional[float]` / `meddicc_completion: int = 0` / `meddicc_last_analyzed_at: Optional[str]`），全部带 default 兼容既有数据。
- [ ] **T004** 更新 [`src/backend/app/models/__init__.py`](src/backend/app/models/__init__.py) 导出 `Conversation` 和 `LeadMeddiccEvidence`，让 `SQLModel.metadata.create_all()` 启动时能扫描到。
- [ ] **T005** [P] 创建 [`src/frontend/src/lib/meddicc-types.ts`](src/frontend/src/lib/meddicc-types.ts)，按 [data-model.md § 九](specs/003-meddicc-sales/data-model.md) 定义 TS types（`Dimension / Evidence / DimensionStatus / DashboardData / ConversationItem / ScenarioCardItem`）。
- [ ] **T006** [P] 创建 [`src/frontend/src/lib/meddicc-nba-templates.ts`](src/frontend/src/lib/meddicc-nba-templates.ts)，定义 7 维度 Next Best Action 文案字典（最弱维度查表，前端常量）。
- [ ] **T007** 启动 uvicorn 验证 schema 自动升级成功（`conversation` / `lead_meddicc_evidence` 表创建 + `lead` 加 3 列，既有数据完整）。

**Checkpoint Setup**: 数据模型就位，前端 types ready，Foundational 可开始。

---

## Phase 2: Foundational（阻塞性基础）

**Purpose**: Score 算法 / AI 抽证据服务 / Schemas / 重置集成 + 单测覆盖。这些是 US1-4 全部依赖的核心 service。

**⚠️ CRITICAL**: 本 phase 完成前任何 user story 不可开始 implementation。

- [ ] **T008** [P] 创建 [`src/backend/app/services/score_calculator.py`](src/backend/app/services/score_calculator.py)：实现 `calculate_meddicc_score(evidences, last_activity_at) -> (score, completion)` 三段式公式（完整度 60 / 深度 25 / 活跃度 15，按 [research.md Decision 3](specs/003-meddicc-sales/research.md)）+ `recompute(lead_id, db)` 函数（重算并写入 Lead 衍生字段）。纯函数，便于单测。
- [ ] **T009** [P] 创建 [`src/backend/app/schemas/meddicc_schemas.py`](src/backend/app/schemas/meddicc_schemas.py)：Pydantic v2 响应 schemas（`DashboardData / DimensionStatus / EvidenceOut / ConversationOut / ScenarioCardOut / AnalyzeResponse / ApplyCardResponse`），与 [contracts/api-contracts.md § 10](specs/003-meddicc-sales/contracts/api-contracts.md) 一致。
- [ ] **T010** 创建 [`src/backend/app/services/meddicc_extractor.py`](src/backend/app/services/meddicc_extractor.py)：实现 `analyze(lead_id, db, current_user_id) -> AnalyzeResult` 服务（依赖 T008）：
  1. 读 lead 全量上下文（conversations + followups + key_events + lead 基本信息）
  2. 上下文为空 → 直接返回空 evidence + score=0（FR-010）
  3. 否则构造 LLM prompt（system + user + few-shot，按 [research.md Decision 1](specs/003-meddicc-sales/research.md)）→ 调 LLM（沿用 spec 002 LLM 配置）→ retry 1 次
  4. 解析 JSON + post-validate（dimension 枚举 / source_id FK / evidence_text 长度 / confidence 范围，按 [research.md Decision 6](specs/003-meddicc-sales/research.md)）
  5. Replace 写库（DELETE WHERE lead_id + INSERT 新批次）
  6. 调 `score_calculator.recompute()` 重算 Lead 衍生字段
  7. 返回结构化结果给调用方
- [ ] **T011** [P] 改造 [`src/backend/app/services/demo_reset_service.py`](src/backend/app/services/demo_reset_service.py) 的 `TABLES_TO_TRUNCATE` 列表追加 `conversation` 和 `lead_meddicc_evidence`（FR-033）。
- [ ] **T012** 改造 [`src/backend/app/services/agent_service.py`](src/backend/app/services/agent_service.py) 的 `TOOL_DEFINITIONS` 列表追加 `analyze_meddicc` tool 定义（按 [contracts/api-contracts.md § 9](specs/003-meddicc-sales/contracts/api-contracts.md)，mode: read，参数 `lead_id` 必填）。**execute_tool 中的派发分支留到 T026 实现**。
- [ ] **T013** [P] 创建 [`src/backend/tests/test_score_calculator.py`](src/backend/tests/test_score_calculator.py) — 至少 8 个测试用例：
  - 空 evidence → score=0, completion=0
  - 7 维度各 1 条 evidence → completeness 60 + depth 12.5 + activity 0/8/15 = 总分跨档
  - 7 维度 + 14 条 + 7 天内 → score 100
  - 7 维度 + 14 条 + 30+ 天 → score 85
  - 1 维度 1 条 + 30+ 天 → score 约 9
  - confidence 边界（0/1/超界 clamp）
  - dimension 边界（>7 维度按枚举过滤）
  - last_activity_at = None → activity 分 = 0
- [ ] **T014** 创建 [`src/backend/tests/test_meddicc_extractor.py`](src/backend/tests/test_meddicc_extractor.py) — 至少 7 个测试用例（依赖 T010）：
  - 空上下文 lead → 不调 LLM + 返回空 + score=0
  - mock LLM 返回正常 JSON → Replace 写库成功 + Lead 衍生字段更新
  - mock LLM 返回幻觉 source_id → 该条跳过 + skipped_count +1
  - mock LLM 返回未知 dimension → 跳过
  - mock LLM 返回非 JSON 字符串 → retry 1 次后失败 → raise
  - mock LLM 返回包含 markdown fence ```json``` 包裹 → 能正常解析（rstrip 处理）
  - 同一 lead 第二次 analyze → DELETE 旧 + INSERT 新（Replace 验证）
- [ ] **T015** [P] 在 `src/backend/app/core/init_db.py` 写一段单元测试（[`src/backend/tests/test_init_db_meddicc.py`](src/backend/tests/test_init_db_meddicc.py)）：
  - 跑 init_db 后 demo lead 有 ≥3 条 mock_seed conversation
  - lead.meddicc_score / completion / last_analyzed_at 非空
  - 重复跑 init_db 幂等

**Checkpoint Foundational**: Score / Extractor / Schemas / Reset / Tool 注册全部就位 + 单测全绿。可启 US1 implementation。

---

## Phase 3: User Story 1 - 5 分钟 demo 体验完整路径（Priority: P1）🎯 MVP

**Goal**: 公网访客打开 demo lead 详情页 → 看到亮灯仪表盘 + Score → 点场景卡 → 看到 AI 抽证据动画刷新。这是核心震撼路径。

**Independent Test**: 演示用户登录 sales01 → 进入 "深圳前海微链" 详情页 → 看到 MEDDICC 仪表盘 Score 50-90、≥4 维度亮灯 → 切到对话记录 tab → 点 "拜访赵总" 卡片 → 2-4 秒后仪表盘动画刷新。

### 后端 Implementation

- [ ] **T016** [P] [US1] 创建 [`src/backend/app/services/scenario_cards.py`](src/backend/app/services/scenario_cards.py)：
  - 定义 `SCENARIO_CARDS` Python dict（5-7 张卡，按 [research.md Decision 4](specs/003-meddicc-sales/research.md) 大纲）
  - 实现 `list_cards_for_lead(lead, db) -> list[ScenarioCardOut]`（按 lead.company_name 过滤 + 计算 applied 状态）
  - 实现 `apply_card(card_id, lead, user_id, db) -> ApplyCardResponse`（前置校验 4 步 + 批量插对话 + 调 meddicc_extractor.analyze + 返回新仪表盘）
- [ ] **T017** [US1] **写 5-7 张场景卡剧本**（落到 T016 的 `SCENARIO_CARDS` dict）：
  - `scenario_001_kp_first_visit`：拜访赵总（深圳前海微链，覆盖 E / I / D-Process）—— 1 条对话约 800 字
  - `scenario_002_champion_emerges`：Champion 涌现（深圳前海微链，Champion / D-Process）—— 1 条对话约 600 字
  - `scenario_003_competition_revealed`：竞品被揭（深圳前海微链，Competition / D-Criteria）—— 1 条对话约 700 字
  - `scenario_004_metrics_quantified`：痛点量化（北京数字颗粒科技，Metrics / Pain）—— 1 条对话约 800 字
  - `scenario_005_partner_decision`：合伙人介入（北京数字颗粒科技，D-Process / Champion / EB）—— 1 条对话约 600 字
  - `scenario_006_book_referral_drive`：推荐人来源（北京数字颗粒科技，D-Criteria / Champion）—— 1 条对话约 500 字
  - **每张卡剧本写完后由 stakeholder 审过话术**，不通过的退回重写
- [ ] **T018** [P] [US1] 创建 [`src/backend/app/api/meddicc.py`](src/backend/app/api/meddicc.py)：
  - `GET /api/v1/leads/{lead_id}/meddicc`（不限流，DataScope 校验）
  - `POST /api/v1/leads/{lead_id}/meddicc/analyze`（限流 10/min + 100/day + 全局熔断 200/hr，沿用 spec 002 装饰器）
  - `DELETE /api/v1/meddicc-evidence/{id}`（不限流）
  - 全部按 [contracts/api-contracts.md § 4-6](specs/003-meddicc-sales/contracts/api-contracts.md)
- [ ] **T019** [US1] 创建 [`src/backend/app/api/scenario_cards_router.py`](src/backend/app/api/scenario_cards_router.py)（依赖 T016）：
  - `GET /api/v1/leads/{lead_id}/scenario-cards`
  - `POST /api/v1/leads/{lead_id}/scenario-cards/{card_id}/apply`（限流 + 熔断）
  - 全部按 [contracts/api-contracts.md § 7-8](specs/003-meddicc-sales/contracts/api-contracts.md)
- [ ] **T020** [US1] 改造 [`src/backend/app/main.py`](src/backend/app/main.py) 注册 2 个新 router（`meddicc` + `scenario_cards_router`）。
- [ ] **T021** [US1] 改造 [`src/backend/app/core/init_db.py`](src/backend/app/core/init_db.py) 的 `seed_demo_business_data()`（依赖 T010 / T016）：
  - 给 3 条 demo lead（深圳前海微链 / 北京数字颗粒科技 / 天津智联云）插入 3-5 条 mock_seed conversation（按 [data-model.md § 七](specs/003-meddicc-sales/data-model.md)）
  - 末尾对每条 demo lead 调用 `meddicc_extractor.analyze(lead_id, db, current_user_id=lead.owner_id)` 一次
  - 幂等性保留（spec 002 既有）

### 前端 Implementation

- [ ] **T022** [P] [US1] 创建 [`src/frontend/src/components/lead/EvidenceListItem.tsx`](src/frontend/src/components/lead/EvidenceListItem.tsx)：渲染单条 evidence row（confidence 条 + 来源跳转链接 + 删除按钮 + 调 DELETE /meddicc-evidence/{id}）。
- [ ] **T023** [P] [US1] 创建 [`src/frontend/src/components/lead/MeddiccDimensionCard.tsx`](src/frontend/src/components/lead/MeddiccDimensionCard.tsx)：单维度卡片（圆点 + 维度名 + count + 第一条 evidence 预览 + 展开按钮 → 渲染 EvidenceListItem 列表）。
- [ ] **T024** [US1] 创建 [`src/frontend/src/components/lead/MeddiccDashboardTab.tsx`](src/frontend/src/components/lead/MeddiccDashboardTab.tsx)（依赖 T023）：
  - 顶部条（Score 大字 + 完成度环形 + 上次分析时间 + 重新分析按钮）
  - 7 维度卡片网格（2 行 4/3 列）
  - Next Best Action 提示（查 meddicc-nba-templates 字典）
  - **仪表盘动画**：圆点延迟出现（每 100ms 一个）+ Score 数字补间（800ms ease，按 [research.md Decision 5](specs/003-meddicc-sales/research.md)）
- [ ] **T025** [P] [US1] 创建 [`src/frontend/src/components/lead/ScenarioCardGrid.tsx`](src/frontend/src/components/lead/ScenarioCardGrid.tsx)：场景卡横向网格（3-5 张可见 + 滚动），每张卡：title / description / 状态按钮（"应用 →" / "已应用 ✓"）+ 点击 apply 触发 toast loading + 调 POST apply。
- [ ] **T026** [US1] 创建 [`src/frontend/src/components/lead/ConversationTab.tsx`](src/frontend/src/components/lead/ConversationTab.tsx)（依赖 T025）：
  - 顶部场景卡片网格
  - 已有对话列表（每条带时间 / 来源标签 / 内容预览 / 展开 / 删除）
  - "+ 新增对话" 按钮 + 弹窗（textarea + 时间选择 + 保存）
- [ ] **T027** [US1] 改造 [`src/frontend/src/app/(authenticated)/leads/[id]/page.tsx`](src/frontend/src/app/(authenticated)/leads/[id]/page.tsx)（依赖 T024 / T026）：tabs 列表加 "对话记录" + "MEDDICC 仪表盘" 两个新 tab，渲染对应组件。

### 测试

- [ ] **T028** [P] [US1] 创建 [`src/backend/tests/test_scenario_cards.py`](src/backend/tests/test_scenario_cards.py) — 至少 6 个测试用例：
  - list_cards_for_lead 按公司名过滤正确
  - apply 注入对话 + 触发 analyze + 返回新仪表盘
  - 重复 apply 同一卡 → 400 "已应用过"
  - apply 跨 owner lead → 403
  - apply 不存在 card_id → 404
  - apply 卡的 applies_to_lead_company 不匹配 → 400
- [ ] **T029** [US1] 创建 [`src/frontend/tests/e2e/pc-meddicc-spec.ts`](src/frontend/tests/e2e/pc-meddicc-spec.ts) US1 部分（至少 3 个 test cases）：
  - **Case 1**：登录 sales01 → 进 "深圳前海微链" → 看到 MEDDICC 仪表盘 Score ≥50 + ≥4 维度亮灯 + 上次分析时间显示
  - **Case 2**：切对话记录 tab → 看到场景卡片网格 ≥3 张 + 已有对话列表 ≥3 条
  - **Case 3**：点未应用场景卡 "应用 →" → 等 toast "完成" → 切回仪表盘 tab → Score 与点击前不同（动画完成后）

**Checkpoint US1 / 🎯 MVP**: 5 分钟 demo 路径全通；T028 + T029 全绿；可独立 ship。**SC-001 / SC-002 / SC-005 验收通过**。

---

## Phase 4: User Story 2 - 进阶用户自助操作（Priority: P2）

**Goal**: 演示用户在空 lead 上手动新增对话 → AI 自动分析 → 仪表盘亮起；删除证据 / 重新分析 全套手动操作可用。

**Independent Test**: 进任一空 demo lead → 点 "新增对话" → 粘贴 ≥200 字对话 → 保存 → 仪表盘从全灰更新到 ≥1 维度亮灯。

### Implementation

- [ ] **T030** [P] [US2] 创建 [`src/backend/app/api/conversations.py`](src/backend/app/api/conversations.py)：
  - `GET /api/v1/leads/{lead_id}/conversations`（不限流）
  - `POST /api/v1/leads/{lead_id}/conversations`（限流 + 熔断 + 同步触发 analyze）
  - `DELETE /api/v1/conversations/{id}`（限流 + 熔断 + 同步触发 analyze）
  - 全部按 [contracts/api-contracts.md § 1-3](specs/003-meddicc-sales/contracts/api-contracts.md)
- [ ] **T031** [US2] 改造 [`src/backend/app/main.py`](src/backend/app/main.py) 注册 conversations router（依赖 T030）。
- [ ] **T032** [US2] 改造 [`src/frontend/src/components/lead/ConversationTab.tsx`](src/frontend/src/components/lead/ConversationTab.tsx)（如果 T026 没做完）：
  - "+ 新增对话" 弹窗 form 校验（content ≥1 字符 / recorded_at ≤ now）
  - 删除单条对话按钮 + confirm dialog + 调 DELETE
  - 保存 / 删除后调用父组件 refetch 仪表盘
- [ ] **T033** [US2] 改造 [`src/frontend/src/components/lead/MeddiccDashboardTab.tsx`](src/frontend/src/components/lead/MeddiccDashboardTab.tsx)（如果 T024 没做完）：
  - 顶部"重新分析"按钮 → 调 POST /analyze + 刷新动画
  - 单维度展开后每条 evidence 的删除按钮 + confirm dialog + 调 DELETE /meddicc-evidence/{id}

### 测试

- [ ] **T034** [P] [US2] 创建 [`src/backend/tests/test_conversations.py`](src/backend/tests/test_conversations.py) — 至少 7 个测试用例：
  - GET 列出对话 + DataScope 过滤
  - POST 新增对话成功 + 同步触发 analyze（mock）+ 返回新仪表盘
  - POST recorded_at 在未来 → 400
  - POST content 为空 → 400
  - POST 跨 owner lead → 403
  - DELETE 对话 + 触发 analyze 重算
  - DELETE 不存在 conversation → 404
- [ ] **T035** [US2] 扩展 [`src/frontend/tests/e2e/pc-meddicc-spec.ts`](src/frontend/tests/e2e/pc-meddicc-spec.ts) US2 部分（至少 2 个 cases）：
  - **Case 4**：进无对话的空 lead → 仪表盘全灰 → 录入一段 500 字对话 → 等 4 秒 → 仪表盘 ≥1 维度亮灯 + Score 非零
  - **Case 5**：在亮灯仪表盘上展开某维度 → 删除 1 条 evidence → Score 下降 + count -1

**Checkpoint US2**: 手动录入 / 删除 / 重新分析全部可用；T034 + T035 全绿。

---

## Phase 5: User Story 3 - Chat 自然语言入口（Priority: P3）

**Goal**: 用户在 chat 输入"分析 [公司名] 这条线索"→ AI 调用 analyze_meddicc 工具 → 渲染 ChatMeddiccReportCard。

**Independent Test**: 在 PC chat sidebar 输入 "看一下深圳前海微链状态" → AI 自动调工具 → 渲染卡片含 Score + 7 圆点 + NBA + "去仪表盘 →" 按钮。

### Implementation

- [ ] **T036** [US3] 改造 [`src/backend/app/services/agent_service.py`](src/backend/app/services/agent_service.py) 的 `execute_tool`：实现 `analyze_meddicc` tool 派发分支（依赖 T010 / T012）：
  - 校验 lead_id 存在 + DataScope
  - 调 `meddicc_extractor.analyze(lead_id, db, user_id)`
  - 返回结构化结果（含 `render_card: True` flag + 7 维度 + Score + NBA）
- [ ] **T037** [P] [US3] 改造 [`src/backend/app/core/init_db.py`](src/backend/app/core/init_db.py) 的 `agent_system_prompt`：在工具用法说明段加入 `analyze_meddicc` 的触发场景示例（"分析 / 看看 / 重新分析 + 公司名 / 线索 ID" → 调 analyze_meddicc；如果用户给的是公司名先调 search_leads）。
- [ ] **T038** [P] [US3] 创建 [`src/frontend/src/components/chat/ChatMeddiccReportCard.tsx`](src/frontend/src/components/chat/ChatMeddiccReportCard.tsx)：
  - Header：公司名 + Score 大字 + 完成度
  - Body：7 维度紧凑列表（圆点 + 维度名 + count）
  - Footer：NBA 提示 + "去仪表盘 →" 跳转按钮 + "重新分析"按钮
  - 视觉沿用现有 `ChatFormCard` 模式
- [ ] **T039** [US3] 改造 [`src/frontend/src/components/chat/chat-sidebar.tsx`](src/frontend/src/components/chat/chat-sidebar.tsx)（依赖 T038）：
  - 解析 tool result 含 `render_card: true` flag → 渲染 ChatMeddiccReportCard
  - 卡片内的"去仪表盘 →"点击 → 跳转 `/leads/[id]?tab=meddicc`
  - 卡片内的"重新分析"点击 → 调 POST /analyze + 替换卡片

### 测试

- [ ] **T040** [P] [US3] 扩展 [`src/frontend/tests/e2e/pc-meddicc-spec.ts`](src/frontend/tests/e2e/pc-meddicc-spec.ts) US3 部分（至少 2 个 cases）：
  - **Case 6**：在 chat sidebar 输入 "分析深圳前海微链" → AI 调工具 → 渲染卡片可见 + 卡片内 Score 数字非空 + 7 圆点至少 4 亮
  - **Case 7**：点卡片内"重新分析"按钮 → 卡片刷新（新分析时间）

**Checkpoint US3**: chat 自然语言识别率 > 90%（SC-008）；T040 全绿。

---

## Phase 6: User Story 4 - Mobile 浏览简版（Priority: P4）

**Goal**: 移动端访客进 lead 详情页看到折叠的 MEDDICC 面板（默认展开）；不显示场景卡片（FR-028）。

**Independent Test**: 移动端登录 sales01 → 进 demo lead → 看到 MEDDICC 仪表盘默认展开 + 7 维度纵向 list + "重新分析" 按钮 + 不显示场景卡。

### Implementation

- [ ] **T041** [P] [US4] 创建 [`src/frontend/src/components/mobile/MobileMeddiccPanel.tsx`](src/frontend/src/components/mobile/MobileMeddiccPanel.tsx)：
  - 默认展开折叠卡（"MEDDICC 仪表盘 (Score X)" 标题）
  - Score 顶部条 + 7 维度纵向 list（圆点 + 维度名 + count）
  - "重新分析"按钮
  - **只读**模式：不渲染单条 evidence 删除按钮（FR-028 mobile 简版）
  - 维度卡可点击展开看 evidence 列表（也只读）
- [ ] **T042** [US4] 改造 [`src/frontend/src/app/m/(mobile-app)/leads/[id]/page.tsx`](src/frontend/src/app/m/(mobile-app)/leads/[id]/page.tsx)（依赖 T041）：
  - 加 "MEDDICC 仪表盘" 折叠卡（默认展开，渲染 MobileMeddiccPanel）
  - 加 "对话记录 (N)" 折叠卡（默认折叠，渲染对话列表只读，无场景卡 + 无新增按钮）
- [ ] **T043** [P] [US4] 改造 [`src/frontend/src/components/mobile/chat-fullscreen.tsx`](src/frontend/src/components/mobile/chat-fullscreen.tsx)（依赖 T038）：注入 ChatMeddiccReportCard 渲染（识别 tool result 含 `render_card: true` flag）。

### 测试

- [ ] **T044** [US4] 创建 [`src/frontend/tests/e2e/mobile-meddicc-spec.ts`](src/frontend/tests/e2e/mobile-meddicc-spec.ts) — 至少 3 个 cases：
  - **Case 1**：移动端登录 sales01 → 进 demo lead → 仪表盘折叠卡默认展开 + Score 显示 + 7 维度纵向 list + **不显示场景卡片网格**（强反向断言）
  - **Case 2**：点击"重新分析"按钮 → 仪表盘刷新（新分析时间）
  - **Case 3**：在 mobile chat fullscreen 输入 "分析这条线索" → 渲染 ChatMeddiccReportCard（垂直布局，关键信息保留）

**Checkpoint US4**: 移动端简版渲染正常；T044 全绿；SC-007 验收通过（首屏 < 1s）。

---

## Phase 7: Polish & Cross-cutting Concerns

**Purpose**: 全量回归 / 性能验证 / 文档更新 / 演示准备 / PR 收口。

- [ ] **T045** 全后端 pytest 跑全绿（spec 002 既有 80 个 + spec 003 新增 4 个文件 ≈ 28 个新 case = 总共约 108 个 case）。
- [ ] **T046** 全前端 Playwright 跑全绿：
  - PC `pc-copilot-cases-regression.spec.ts`（spec 002 既有 9 case）
  - PC `pc-meddicc-spec.ts`（本 spec 新增 7 case：US1 + US2 + US3）
  - Mobile `mobile-copilot-cases-regression.spec.ts`（spec 002 既有 9 case）
  - Mobile `mobile-meddicc-spec.ts`（本 spec 新增 3 case）
- [ ] **T047** 跑 [quickstart.md](specs/003-meddicc-sales/quickstart.md) 7 步主路径人工验收 + 7 个边界路径验收。
- [ ] **T048** 性能验证（quickstart.md § 四）：
  - /meddicc/analyze P95 ≤ 4s（用 Playwright 重复 20 次取 p95）
  - /scenario-cards/{id}/apply P95 ≤ 4s
  - GET /meddicc < 500ms
  - Mobile 折叠面板首屏 < 1s
  - 50+ conversation lead 的 analyze ≤ 5s
- [ ] **T049** [P] 更新 [`README.md`](README.md)：
  - 加 spec 003 进度章节
  - 加 MEDDICC 演示要点（场景卡 + AI 抽证据 + 仪表盘动画）
  - 加 Playwright 命令（pc-meddicc + mobile-meddicc）
- [ ] **T050** [P] 更新全局 memory：
  - `D:/BaiduSyncdisk/Doc.Work/Programming/claudecode/memory/project_sfacrm_content.md` 加 spec 003 进度
  - 沉淀关键经验（如 LLM JSON 输出稳定性、Replace 策略 trade-off）
- [ ] **T051** stakeholder 审场景卡剧本：把 5-7 张卡的对话内容打印或在 IDE 里看一遍，调话术，避免塑料感。
- [ ] **T052** 内部 demo（按 quickstart.md § 六 5 分钟剧本走一遍），录屏作为后续公众号文章素材。
- [ ] **T053** 收口：
  - `git push origin 003-meddicc-sales`
  - `gh pr create --title "MEDDICC 销售视角 demo（spec 003）" --body "$(cat ...)"`
  - 等 CI 通过（如有）→ `gh pr merge --merge`（**保留 commit 链，不 squash**，沿用 spec 001/002 模式）

**Checkpoint Polish**: 全绿 + 验收通过 + PR merged 到 master。spec 003 完成。

---

## 总体依赖与执行顺序

### Phase 依赖

```
Setup (T001-T007)
    ↓ BLOCKS
Foundational (T008-T015)
    ↓ BLOCKS
US1 (T016-T029) 🎯 MVP — 可独立 ship
US2 (T030-T035) — 可与 US3 / US4 并行
US3 (T036-T040) — 可与 US2 / US4 并行
US4 (T041-T044) — 可与 US2 / US3 并行
    ↓ all done
Polish (T045-T053)
```

### 关键并行机会

**Phase 1 Setup**（全部可并行）：T001 / T002 / T005 / T006 标 [P]
**Phase 2 Foundational**：T008 / T009 / T011 / T013 标 [P]；T010 依赖 T008；T012 依赖 T010
**Phase 3 US1**：T016 / T018 / T022 / T023 / T025 / T028 标 [P]；T024 依赖 T023；T026 依赖 T025；T027 依赖 T024 + T026；T029 依赖前端就绪
**Phase 4 US2**：T030 / T034 / T032 / T033 标 [P] 部分；T031 依赖 T030
**Phase 5 US3**：T037 / T038 / T040 标 [P]；T036 依赖 Foundational；T039 依赖 T038
**Phase 6 US4**：T041 / T043 标 [P]；T042 依赖 T041

### Within Each User Story

- Tests-first（pytest）建议但不强制；mock LLM 测试可在 implementation 前写
- 后端 model → service → router 顺序
- 前端 utility/types → 单组件 → 复合组件 → page 集成顺序

### 跨 Story 集成点

- US1 的 ConversationTab.tsx 与 US2 共用（T026 / T032 是同一文件的两阶段）
- US1 的 MeddiccDashboardTab.tsx 与 US2 共用（T024 / T033 是同一文件的两阶段）
- US3 的 ChatMeddiccReportCard.tsx 与 US4 chat-fullscreen 共用（T038 / T043）

---

## Implementation Strategy

### MVP First（推荐）

1. 完成 Phase 1 Setup（T001-T007）
2. 完成 Phase 2 Foundational（T008-T015）
3. 完成 Phase 3 US1（T016-T029）
4. **STOP and VALIDATE**：跑 quickstart.md US1 主路径 → 演示给 stakeholder 看
5. 如果效果达到预期 → 进 Phase 4-7
6. 如果不达预期 → 调整再迭代（避免在没演示验证前堆叠 US2-4）

### Incremental Delivery

1. Setup + Foundational → 基建 ready
2. US1（场景卡 + 仪表盘）→ 测试 + 演示 → 这就是 MVP demo
3. US2（手动录入 + 删除）→ 测试 + 演示 → 增强体验
4. US3（chat 入口）→ 测试 + 演示 → 对话式 CRM 心智落地
5. US4（mobile）→ 测试 + 演示 → 移动端覆盖
6. Polish + PR → 收口

每个 story 独立可演示，独立可写一篇克劳蛋系列文章。

### Parallel Team Strategy

如果有多人协作（实际是 superpowers:subagent-driven-development 多 subagent 并行）：

1. Setup + Foundational 一人主导（避免冲突）
2. Foundational 完成后：
   - Subagent A：US1（场景卡 + 仪表盘）
   - Subagent B：US2（手动录入）— 等 US1 的 ConversationTab 提交后再开
   - Subagent C：US3（chat 入口）
   - Subagent D：US4（mobile）
3. Polish 一人主导（PR 合并）

---

## Notes

- [P] tasks = 不同文件、无依赖
- [Story] 标签映射 task 到具体 user story 便于追溯
- 每个 user story 独立可完成、独立可测
- pytest 测试**强制**前置编写（mock LLM 用例除外，可与 implementation 并行）
- **每个 task 完成后建议立刻 commit**（沿用 spec 002 节奏，commit 链保留细节）
- 任何 Checkpoint 都可以暂停验证 story 独立性
- **避免**：跨 story 紧耦合 / 同文件冲突 / 模糊 task 描述
- **演示数据 30 分钟自动重置**（spec 002 既有），开发期间可频繁清干净

---

## Task 总数与工期匹配

| Phase | Tasks | 估算天数 |
|---|---|---|
| Phase 1 Setup | T001-T007（7 任务） | 0.5 天 |
| Phase 2 Foundational | T008-T015（8 任务） | 3 天 |
| Phase 3 US1 🎯 MVP | T016-T029（14 任务） | 6 天（含场景卡剧本写作） |
| Phase 4 US2 | T030-T035（6 任务） | 2 天 |
| Phase 5 US3 | T036-T040（5 任务） | 2 天 |
| Phase 6 US4 | T041-T044（4 任务） | 1.5 天 |
| Phase 7 Polish | T045-T053（9 任务） | 2 天 |
| **合计** | **53 任务** | **17 天 ≈ 2.5 周** |

匹配 plan.md / alignment.md 估算。

---

## tasks.md 完成状态

✅ 53 个 task 全部覆盖 spec.md 37 FR
✅ 4 个 User Stories 各自独立可测可 ship
✅ Parallel opportunities 标注完整
✅ 依赖图清晰（Phase / Story / Task 三层）
✅ 工期与 plan.md / alignment.md 对齐（17 天）

**下一步**：开始实施。建议走 `superpowers:subagent-driven-development` skill，沿用 spec 001/002 节奏。
