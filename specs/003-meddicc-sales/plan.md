# Implementation Plan: MEDDICC 销售视角

**Branch**: `003-meddicc-sales` | **Date**: 2026-05-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-meddicc-sales/spec.md`

## Summary

把 Gong 哲学（行为驱动 + AI 抽 MEDDICC 证据 + 仪表盘可视化）以演示用户友好形态落地到 SFA CRM 的 Lead 对象上。覆盖 spec 003 的 4 个 P1-P4 User Stories 与 37 条 FR。

**关键技术发现（决定 plan 走向）**：

1. **AI 抽证据是本 spec 唯一的非平凡技术决策**：现有 `agent_service.py` 已有完整 LLM 调用 + Tool Use 框架，但本 spec 需要的是**单次调用产出结构化 JSON**（不是流式 chat），且 prompt 要含 7 字段培训行业本地化定义 + JSON schema 约束 + few-shot examples。这是 research.md 的核心章节。
2. **Replace 策略简化数据流**：每次 analyze 先 `DELETE FROM lead_meddicc_evidence WHERE lead_id = X` 再 INSERT 新 evidence，避免 merge / dedup / version 复杂性。代价是 evidence.created_at 时间序列丢失，trade-off 是 spec 004 引入 `lead_meddicc_history` 表做趋势图。
3. **Score 算法纯派生**：`completion = COUNT(DISTINCT dimension)` + `深度分 = min(total_count, 14)/14*25` + `活跃度分(7d/30d/0d)`，每次 evidence 变更后由 service 重算并写入 Lead 表 3 个衍生字段。**符合宪法第六条"显式优于隐式"+ Ontology 优先**——score 概念上是从 evidence 派生，缓存仅为查询性能。
4. **场景卡用前端常量 + 后端字典（不建第 3 张表）**：5-7 张卡的内容 hardcode 在 `app/services/scenario_cards.py` 字典中，applying 时按 lead 公司名匹配并 INSERT 多条 conversation。半小时重置只清 conversation 表即可，不需要单独管理场景卡数据生命周期。
5. **仪表盘动画纯前端**：圆点延迟出现 + Score 数字补间均为前端 React state 时序控制（CSS transition + setTimeout），后端不参与动画——保持 API 简单（一次返回完整新仪表盘）。
6. **现有 8 个 chat tool 框架可直接扩展**：`agent_service.TOOL_DEFINITIONS` 增加 1 个 `analyze_meddicc(lead_id)`（mode: read+derived-write），thin wrapper 调 `meddicc_extractor.analyze()` 服务。其他读工具已能 cover lead detail / followup history。
7. **DataScope 权限继承 lead.owner_id**：conversation / evidence / scenario-card-apply 全部按"该 lead 是否对当前用户可见"判断，不引入新的权限概念——直接复用 `permission_service.get_visible_user_ids()`。

**整体技术路径**：保守、最小变更、不重写、不换栈。在现有架构上加 service / 加路由 / 加 model + 扩展 init_db 与 chat tool。**唯一新依赖**：无（继续用 SQLModel / FastAPI / DeepSeek SDK）。

---

## Technical Context

**Language/Version**:
- 后端 Python 3.11 / FastAPI 0.110+ / SQLModel / Pydantic v2
- 前端 TypeScript 5 / Next.js 14 (App Router) / React 18

**Primary Dependencies**:
- 后端**新增**：无（用既有 `httpx` 调 DeepSeek REST，JSON 验证用 Pydantic v2）
- 后端**复用**：`fastapi` / `sqlmodel` / `slowapi`（限流，已在 spec 002）/ `cryptography`（已在 spec 002）/ `httpx`（已在）
- 前端**新增**：无（动画用纯 React + CSS transition + setTimeout）
- 前端**复用**：现有 chat 渲染管线（`render-markdown.tsx` / `chat-sidebar.tsx` / `chat-fullscreen.tsx`）

**Storage**:
- 现有 SQLite（`src/backend/app/data/sfa_crm.db`，WAL 模式）
- **新增 2 张表**：`conversation` / `lead_meddicc_evidence`
- **修改 1 张表**：`lead` 加 3 列（`meddicc_score` Float / `meddicc_completion` Int / `meddicc_last_analyzed_at` str）
- **不引入**：Redis / 缓存层 / 全文索引（演示规模够用）

**Testing**:
- pytest 集成测试（**新增**）：
  - conversation CRUD + DataScope
  - meddicc_extractor 抽证据流（含 LLM mock 与真调）
  - score_calculator 各档分边界（0 维度 / 7 维度 / 14+ 条 / 7d / 30d / 30d+）
  - scenario_cards apply 流（多对话注入 + 同步 analyze）
  - Replace 策略（重复 analyze 不重复行）
  - 限流接入（analyze 端点纳入 spec 002 限流装饰器）
- e2e（Playwright）：
  - PC：MEDDICC tab 渲染 / 场景卡应用动画 / 删除证据 / 重新分析
  - Mobile：折叠卡 / 仪表盘渲染（不含场景卡）
  - Chat：自然语言"分析 [公司名]"识别 + ChatMeddiccReportCard 渲染
- 不强制 LLM judge 类回归（沿用 spec 002 风格——LLM 调真的，pytest 用 mock）

**Target Platform**:
- 部署：腾讯云轻量 Linux VM（沿用 spec 002 部署，本 spec 不动 Nginx / certbot）
- 客户端：现代浏览器（Chrome/Edge/Firefox 最近 2 版 + iOS Safari 14+ / Android Chrome 100+）

**Project Type**: Web application（与 spec 001/002 一致），见 Project Structure。

**Performance Goals**（对应 spec.md SC）：
- `/meddicc/analyze` 端点 P95 ≤ 4s（含 LLM 调用 + Replace 写库，SC-002）
- `/scenario-cards/{id}/apply` 端点 P95 ≤ 4s（含批量插对话 + 触发 analyze）
- 仪表盘 GET 响应 < 500ms（按维度聚合查询，SC-007）
- Mobile 折叠面板首屏 < 1s（含 GET /meddicc，SC-007）
- chat 自然语言识别 → analyze_meddicc 工具调用 → 卡片渲染 ≤ 5s（SC-008）
- 单线索累积 50+ conversation 时 analyze API 响应 ≤ 5s（SC-010）

**Constraints**:
- **不引入新中间件**（无 Redis / Celery）—— Replace 策略用 SQLite 事务即可
- **不重写现有 spec 001/002 UI**——MEDDICC tab 仅在 lead detail 页加，chat 卡片仅在 chat sidebar/fullscreen 注入新组件
- **现有 SystemConfig 表结构稳定**——本 spec 不动 SystemConfig（Score 权重暂硬编码于 `score_calculator.py`，未来可选移入）
- **chat_audit 沿用 spec 002 写入路径**——analyze 触发的 chat 调用纳入既有 audit 链路
- **场景卡剧本由 stakeholder 审过才入库**——草稿先放在 `app/services/scenario_cards.py` PR 里 review，不上线前不允许 LLM 自动修改
- **Mobile 简版可接受**——Mobile 不实现场景卡网格 + 单条 evidence 删除，spec.md FR-028 已明示

**Scale/Scope**:
- 新增/改动文件预估约 **32 个**（17 后端 + 15 前端）
- 后端**新增**：3 个 service 模块（`meddicc_extractor.py` / `scenario_cards.py` / `score_calculator.py`）+ 2 个 model（`conversation.py` / `lead_meddicc_evidence.py`）+ 3 个 router（`conversations.py` / `meddicc.py` / `scenario_cards_router.py`）+ 4 个 pytest 文件
- 后端**改动**：5 个文件（`models/lead.py` 加 3 列 / `services/agent_service.py` 加 chat tool / `services/demo_reset_service.py` 清表追加 / `core/init_db.py` seed + 跑 analyze / `main.py` 注册新路由）
- 前端**新增**：7 个组件 + 2 个 lib + 2 个 e2e 文件
- 前端**改动**：4 个文件（lead detail PC + Mobile / chat-sidebar / chat-fullscreen）
- 内容**新增**：5-7 张场景卡剧本（在 `scenario_cards.py` 中，每张 500-1000 字对话）+ 5-10 条种子对话（在 `init_db.py` 中）

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

宪法 v1.1.0（[.specify/memory/constitution.md](../../.specify/memory/constitution.md)）的 6 条核心原则在本 feature 的适用性：

| 原则 | 适用性 | 检查结论 |
|------|--------|----------|
| 一、Ontology 优先 | **强适用** | `Conversation` 与 `LeadMeddiccEvidence` 均为显式实体；evidence 是"事件"性质（每条都有 source_type + source_id 指向触发源）；`Lead.meddicc_score` 概念上是从 evidence 派生（每次重算），缓存仅为查询性能。无"隐式状态"。✅ Pass |
| 二、API 优先，统一操作层 | **强适用** | 8 个端点全在 RESTful API 层；`analyze_meddicc_evidence` 既是 service 也注册为 chat tool，**GUI 与 Agent 共用同一入口**。无内部直连数据层的旁路。✅ Pass |
| 三、规则可配置，不硬编码 | 部分适用 | Score 算法权重（60/25/15/14/7d/30d 等阈值）暂硬编码于 `score_calculator.py`，未来可移入 SystemConfig（spec 003 不实施这步——理由见 Complexity Tracking）。MEDDICC 7 字段定义存在 system prompt 中（属于"配置"语义，可未来移入 LLM_CONFIG）。⚠️ Partial Pass |
| 四、数据完整性不可妥协 | **强适用** | LLM 返回的 source_id 必须 DB 校验（防 FK 幻觉，沿用 spec 002 哲学）；analyze 端点纳入 spec 002 限流 / 熔断；DataScope 权限保数据隔离（conversation/evidence 按 lead.owner_id 判断可见性）。✅ Pass |
| 五、最小化销售录入负担 | **强适用** | AI 自动抽证据，销售只需查看 / 删除 / 重新分析，**完全不需要手填 7 个 MEDDICC 字段**。这是本 spec 对宪法此条的核心兑现。✅ Pass |
| 六、显式优于隐式 | **强适用** | spec.md 37 FR / 4 US / 12 Edge Cases / 10 SC 全部显式声明；Score 算法显式（公式而非黑盒）；evidence 来源显式（source_type + source_id）；HITL 边界显式（spec 003 = AI 自动写自己派生数据 + 用户可删除/重新分析）。✅ Pass |

**8 项技术约束 vs 本 feature**：

| 约束 | 适用性 | 检查 |
|---|---|---|
| 数据层基于 Ontology | ✅ | Conversation / Evidence / Lead 扩展全部按对象 + 关系建模 |
| 技术栈 Next.js + FastAPI + SQLite + Docker Compose | ✅ | 严格沿用 |
| API 层执行业务规则 | ✅ | 数据权限 / 限流 / FK 校验 / Score 算法在 service / API 层 |
| AI Agent 层（Vercel AI SDK + DB 配置 + Tool Use + Skill 检索） | ✅ | analyze_meddicc 注册为 chat tool；LLM Provider 沿用 spec 002 配置 |
| 速率限制（API 层、客户端不可绕过） | ✅ | analyze 端点纳入 spec 002 SlowAPI 装饰器（10/分 + 100/天 + 全站 200/小时） |
| 审计追踪（动作仅追加，不物理删除业务对象） | ⚠️ Partial | conversation / evidence 允许物理删除（演示场景需要），但这俩**不是用户业务主数据**（不是 lead/customer/followup），属于演示派生数据，符合精神 |
| 配置驱动（大区规则 / 阈值 / Provider 配置） | ⚠️ Partial | Score 权重未走 SystemConfig（见原则三说明） |
| 系统集成（课时订单付款 → 商机更新；飞书） | 不适用 | |

**结论**：本 feature 与宪法**基本一致**且强符合"Ontology 优先"、"API 优先"、"最小销售录入负担"、"显式优于隐式"四项核心原则。Score 权重未走 SystemConfig 是显式权衡（在 Complexity Tracking 里说明），不算违宪。

---

## Project Structure

### Documentation (this feature)

```text
specs/003-meddicc-sales/
├── spec.md                           # ✅ 已生成
├── plan.md                           # ✅ 本文件
├── research.md                       # ⏳ Phase 0 输出（AI 抽证据 prompt 设计 / Replace vs Merge / Score 算法选型）
├── data-model.md                     # ⏳ Phase 1 输出（conversation / lead_meddicc_evidence 表定义 + Lead 扩展）
├── quickstart.md                     # ⏳ Phase 1 输出（人工验收：登录 → 进 demo lead → 点场景卡 → 看动画）
├── contracts/                        # ⏳ Phase 1 输出
│   └── api-contracts.md              #   8 个端点契约 + chat tool analyze_meddicc 契约
├── inputs/
│   └── alignment.md                  # ✅ brainstorm 业务对齐凭据
└── tasks.md                          # ⏳ Phase 2 输出（/speckit.tasks 命令产出）
```

### Source Code (repository root)

实际项目布局为前后端分离 Web 应用：

```text
src/
├── backend/                                                   # FastAPI Python 后端
│   └── app/
│       ├── api/
│       │   ├── conversations.py                               # 🆕 GET/POST /leads/{id}/conversations + DELETE /conversations/{id}
│       │   ├── meddicc.py                                     # 🆕 GET /leads/{id}/meddicc + POST /leads/{id}/meddicc/analyze + DELETE /meddicc-evidence/{id}
│       │   └── scenario_cards_router.py                       # 🆕 GET /leads/{id}/scenario-cards + POST /scenario-cards/{id}/apply
│       ├── core/
│       │   └── init_db.py                                     # ⚠️ 改造：seed_demo_business_data() 加 5-10 条种子对话；末尾对每个 demo lead 调用 meddicc_extractor.analyze() 一次
│       ├── services/
│       │   ├── meddicc_extractor.py                           # 🆕 LLM 抽证据 + JSON 解析 + 校验 + Replace 写库 + 重算 score
│       │   ├── scenario_cards.py                              # 🆕 SCENARIO_CARDS 字典（5-7 张）+ apply(lead_id, card_id) 函数
│       │   ├── score_calculator.py                            # 🆕 完整度/深度/活跃度三段公式 + 重算 Lead 衍生字段
│       │   ├── agent_service.py                               # ⚠️ 改造：TOOL_DEFINITIONS 加 analyze_meddicc；execute_tool 派发该 tool
│       │   └── demo_reset_service.py                          # ⚠️ 改造：reset_business_data() 清空表追加 conversation / lead_meddicc_evidence
│       ├── models/
│       │   ├── conversation.py                                # 🆕 Conversation 模型
│       │   ├── lead_meddicc_evidence.py                       # 🆕 LeadMeddiccEvidence 模型
│       │   └── lead.py                                        # ⚠️ 改造：加 meddicc_score / meddicc_completion / meddicc_last_analyzed_at 三列
│       ├── main.py                                            # ⚠️ 微改：注册 3 个新 router
│       └── data/
│           └── sfa_crm.db                                     # 自动 schema 升级（SQLModel.create_all）
└── frontend/
    └── src/
        ├── app/
        │   ├── (authenticated)/
        │   │   └── leads/[id]/page.tsx                        # ⚠️ 改造：tabs 列表加"对话记录"、"MEDDICC 仪表盘"两个新 tab
        │   └── m/(mobile-app)/
        │       └── leads/[id]/page.tsx                        # ⚠️ 改造：加 MEDDICC 折叠面板（默认展开）+ 对话记录折叠面板（默认折叠）
        ├── components/
        │   ├── lead/
        │   │   ├── ConversationTab.tsx                        # 🆕 PC 对话记录 tab（顶部场景卡网格 + 已有对话列表）
        │   │   ├── MeddiccDashboardTab.tsx                    # 🆕 PC 仪表盘 tab（顶部条 + 7 维度网格 + NBA）
        │   │   ├── ScenarioCardGrid.tsx                       # 🆕 场景卡片横向网格
        │   │   ├── MeddiccDimensionCard.tsx                   # 🆕 单维度卡片（含展开/证据列表/删除按钮）
        │   │   └── EvidenceListItem.tsx                       # 🆕 单条证据 row
        │   ├── chat/
        │   │   ├── ChatMeddiccReportCard.tsx                  # 🆕 chat 内嵌 MEDDICC 报告卡片
        │   │   └── chat-sidebar.tsx                           # ⚠️ 微改：渲染 ChatMeddiccReportCard（识别 part type === 'meddicc-report'）
        │   └── mobile/
        │       ├── MobileMeddiccPanel.tsx                     # 🆕 移动端 MEDDICC 折叠面板
        │       └── chat-fullscreen.tsx                        # ⚠️ 微改：同上注入 ChatMeddiccReportCard 渲染
        ├── lib/
        │   ├── meddicc-types.ts                               # 🆕 TS types：Dimension / Evidence / DashboardData / ScenarioCard
        │   └── meddicc-nba-templates.ts                       # 🆕 7 维度的 Next Best Action 文案字典（前端常量）
        └── tests/
            └── e2e/
                ├── pc-meddicc-spec.ts                         # 🆕 Playwright PC 端 5-8 cases
                └── mobile-meddicc-spec.ts                     # 🆕 Playwright Mobile 端 3-5 cases

src/backend/tests/                                              # pytest（沿用现有目录）
├── test_conversations.py                                      # 🆕 CRUD + DataScope + 同步触发 analyze
├── test_meddicc_extractor.py                                  # 🆕 LLM 抽证据 + JSON 校验 + Replace 策略 + FK 防幻觉
├── test_scenario_cards.py                                     # 🆕 apply 注入对话 + 防重复应用 + DataScope
└── test_score_calculator.py                                   # 🆕 各档分边界（0/7 维度，0/14+ 条，0/7d/30d/30d+）
```

**Structure Decision**: **Web application 结构**（与 spec 001/002 一致 — backend + frontend）。

**关键架构决策（详见 research.md）**：

1. **3 个独立 router**（conversations / meddicc / scenario_cards）而非塞进现有 `agent.py`：解耦关注点，每个 router 文件聚焦单一资源；FastAPI 可清晰挂到不同 prefix。
2. **`meddicc_extractor.py` 单独成模块而非塞 `agent_service.py`**：avoid bloat（agent_service 已有 11 个 tool），且 extractor 内部要做严格 JSON validate + Replace 事务，逻辑独立性强。
3. **`score_calculator.py` 抽出**：算法纯函数，便于单测 + 未来移入 SystemConfig 时只改这一个文件。
4. **场景卡内容用 Python dict（`scenario_cards.py`）而非 JSON / YAML 文件**：Python dict 支持注释 + 方便引用 datetime / lead company name 常量；用文件就要 IO + 解析。
5. **前端 7 个组件分散在 `components/lead/` + `components/chat/` + `components/mobile/`**：按场景分目录，避免单目录爆炸；与 spec 001 既有目录结构一致。
6. **TypeScript types 集中在 `lib/meddicc-types.ts`**：所有组件共享同一份 type，避免分散维护；与现有 `lib/onboarding-config.ts` 风格一致。
7. **NBA 文案字典前端常量（`lib/meddicc-nba-templates.ts`）而非后端**：NBA 是按"最弱维度"查表，前端拿到仪表盘数据自己算最弱维度并查文案——避免后端再多一次 LLM 调用。

---

## Complexity Tracking

> 本 feature 的违宪点（弱违反，已在 Constitution Check 标 Partial Pass）：

| 违反项 | 为什么需要 | 拒绝的简单替代方案 |
|---|---|---|
| **Score 权重硬编码于 `score_calculator.py`，未走 SystemConfig 表** | spec 003 是演示导向，权重调整频率低；硬编码读起来更直观，单测覆盖也更直接 | 走 SystemConfig 需要：(1) 新增 4-6 个 SystemConfig key（完整度权重 60 / 深度权重 25 / 14 条阈值 / 7 天阈值 / 30 天阈值 / 活跃度满分 15），(2) 启动时读 + 缓存 + reload 机制。这些工作量与本 spec 的"演示价值产出"不成比例，**spec 005+ 经理调参时再迁** |
| **MEDDICC 7 字段定义存于 LLM system prompt（init_db 写入），非独立 SystemConfig key** | 培训行业本地化定义 + few-shot examples 一起放进 system prompt 是 LLM 调用的天然组合；拆出来反而增加配置耦合 | 拆成独立 SystemConfig：每个维度一个 key，LLM 调用时拼接——但拼接逻辑增加，且违反"prompt 整体性原则"（few-shot 与定义紧密耦合） |
| **DELETE 物理删除 conversation / evidence**（不是软删除） | 演示场景下用户期望"删了就没了"；演示数据每 30 分钟全部重置，没有保留必要 | 软删除（status=deleted）：增加查询过滤复杂性 + UI 处理已删项 + 重置逻辑变复杂——本 spec 演示性质不需要 |

---

## Phase Outputs

- ⏳ **Phase 0** Outline & Research → `research.md`
  - 关键决策 1：MEDDICC 抽证据 prompt 设计（system / user template / few-shot example）
  - 关键决策 2：Replace vs Merge 策略 trade-off + 时序丢失的 spec 004 衔接方案
  - 关键决策 3：Score 算法选型（公式权重 / 阈值 / 活跃度衰减曲线）
  - 关键决策 4：场景卡数据结构（Python dict 字段定义 + 5-7 张草稿大纲）
  - 关键决策 5：仪表盘动画的纯前端实现（圆点延迟 + 数字补间 + Tween 算法选型）
  - 关键决策 6：FK 校验 LLM 幻觉的实现路径（pre-validate vs post-validate）
  - 关键决策 7：限流接入方式（继承 spec 002 装饰器还是单独定义）
- ⏳ **Phase 1** Design & Contracts → `data-model.md` + `contracts/api-contracts.md` + `quickstart.md`
- ⏳ **Phase 2** Tasks → `tasks.md`（由 `/speckit.tasks` 命令产出）

下一步：生成 `research.md`（Phase 0 集中处理 7 个关键技术决策），然后 `data-model.md` / `contracts/` / `quickstart.md`（Phase 1 设计与契约）。
