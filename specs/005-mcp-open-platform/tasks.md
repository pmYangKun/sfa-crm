---
description: "Task list for spec 005 — MCP 开放平台"
---

# Tasks: MCP 开放平台（只读 MCP Server + `/open` 站点）

**Input**: Design documents from `specs/005-mcp-open-platform/`
**Prerequisites**: plan.md ✅ / spec.md ✅ / research.md ✅ / data-model.md ✅ / contracts/ ✅ / quickstart.md ✅

**Tests**: **包含**。依据宪法「关键路径必须测试」，以及项目既有约定——每个 user story 完成后须跑 Playwright 真实前端模拟验证，且**任何新功能必须 PC + Mobile 双套 e2e**。

**Organization**: 按 user story 分组，每个 story 可独立实现、独立验证、独立交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属 user story（US1–US5）
- 每条任务都带确切文件路径

## Path Conventions

本仓库为 Web app 双目录结构：`src/backend/`（FastAPI）+ `src/frontend/`（Next.js 14 App Router）。

**注意：本仓库无 alembic**，新表由 `SQLModel.metadata.create_all()` 启动时自动创建，**故全程无迁移任务**。

---

## Phase 1: Setup（共享基础）

**Purpose**: 锁定协议实现方式，避免在错误的地基上铺代码

- [X] T001 锁定 MCP SDK 版本并跑通最小挂载示例：在 `src/backend/` 下验证 SDK 的 Streamable HTTP ASGI 应用能挂载进既有 FastAPI，能完成一次连接握手与空工具列举。**本任务不通过则不得进入 T002**（research.md Decision 1 标注：SDK 挂载 API 跨版本有变动，须先验证再叠加鉴权；若确认无法与 FastAPI 共存，改走手写 JSON-RPC 退路并回写 research.md）
- [X] T002 将锁定版本的 MCP SDK 写入 `src/backend/pyproject.toml` 的 dependencies
- [X] T003 [P] 在 `src/backend/app/core/config.py`（或既有配置常量位置）定义 5 个新配置键名常量：`mcp_token_ttl_days` / `mcp_rate_per_minute` / `mcp_rate_per_day` / `mcp_issue_per_ip_per_day` / `mcp_demo_rate_per_hour`

**Checkpoint**: 协议可挂载已验证，依赖已声明

---

## Phase 2: Foundational（阻塞所有 user story）

**Purpose**: 密钥体系 + 工具过滤 + 协议骨架，所有 story 都建立在这之上

**⚠️ CRITICAL**: 本阶段未完成前，任何 user story 不得开工

- [X] T004 [P] 创建 `McpToken` 模型于 `src/backend/app/models/mcp_token.py`，字段与索引严格按 data-model.md §1（`token_hash` UNIQUE+INDEX、`expires_at` INDEX、`user_id` FK+INDEX）
- [X] T005 [P] 在 `src/backend/app/core/database.py` 的 `init_db` 中**幂等补入** 5 个 SystemConfig 默认值（缺失则插入、已存在不覆盖——沿用 spec 002 的既有模式，禁止用"已初始化就整体跳过"的 short-circuit）
- [X] T006 实现 `src/backend/app/services/mcp_token_service.py`：发放（生成 `sfa_ro_` + 32 字节随机、返回明文、仅存 SHA-256 摘要与 12 位前缀）、校验（按 data-model §1 的单一有效性判据）、吊销、成功调用后更新 `last_used_at` 与 `call_count`（依赖 T004、T005）
- [X] T007 实现 `src/backend/app/core/mcp_auth.py`：FastAPI 依赖，从 `Authorization: Bearer` 解析密钥 → 校验 → 返回对应 `User`；三类失效（查无此摘要 / 已过期 / 已吊销）须返回**可区分且人类可读**的 401（依赖 T006）
- [X] T008 [P] 实现 `src/backend/app/services/mcp_tool_registry.py`：从既有 `TOOL_DEFINITIONS` 按 `mode == "read"` **程序化过滤**（禁止手工白名单），并转换为 MCP 工具 schema，保留必填标记与原始 description 语义
- [X] T009 实现 `src/backend/app/api/mcp.py`：MCP 协议端点，承载连接握手 / 工具列举 / 工具调用三类消息；工具调用**必须**转交既有 `execute_tool(user_id, ...)`，不得绕过直接查库（宪法原则二）（依赖 T007、T008）
- [X] T010 在 `src/backend/app/main.py` 挂载 MCP router 与密钥 router，前缀 `/api/v1`（依赖 T009）
- [X] T011 [P] 单测：密钥生命周期（发放→有效→过期→吊销→三类失效响应可区分）于 `src/backend/tests/unit/test_mcp_token_service.py`
- [X] T012 [P] 单测：工具过滤结果恰为 9 个且不含任何 `navigate_*` 于 `src/backend/tests/unit/test_mcp_tool_registry.py`

**Checkpoint**: 密钥可发可验、工具可列、协议可通 —— user story 可以并行开工

---

## Phase 3: User Story 1 — 访客零门槛接入并问出第一个答案（P0）🎯 MVP

**Goal**: 访客打开 `/open`，点身份、复制配置、粘进自己的 AI 助手，立刻问出真实业务数据

**Independent Test**: 干净机器打开 `/open` → 点"以主管身份连接" → 复制配置 → 粘进任一 MCP 客户端 → 问"我团队哪几单有风险" → 收到非空真实结果，全程零注册

### Tests for User Story 1

- [X] T013 [P] [US1] 契约测试：工具列举返回且仅返回 9 个工具、名称与 contracts/mcp-tools.md 一致、入参 schema 与 `TOOL_DEFINITIONS` 完全一致，于 `src/backend/tests/contract/test_mcp_tools_contract.py`
- [X] T014 [P] [US1] 集成测试：领密钥 → 列工具 → 调用 `scan_team_warnings` 返回非空，于 `src/backend/tests/integration/test_mcp_end_to_end.py`

### Implementation for User Story 1

- [X] T015 [US1] 实现 `POST /api/v1/mcp/tokens` 于 `src/backend/app/api/mcp_tokens.py`：按 contracts/http-api.md §2，只接受 `sales` / `manager`（**拒绝 `admin`**），映射账号缺失时明确报错不静默降级
- [X] T016 [US1] 实现 `GET /api/v1/mcp/tokens/me` 于 `src/backend/app/api/mcp_tokens.py`：返回身份、剩余天数、调用次数；**禁止**返回明文或完整摘要
- [X] T017 [US1] 实现 `GET /api/v1/mcp/tools` 公开工具目录端点于 `src/backend/app/api/mcp_tokens.py`：内容由 T008 的过滤结果派生（research Decision 6，杜绝站点与实现漂移）
- [X] T018 [P] [US1] 创建 `/open` 首页骨架于 `src/frontend/app/open/page.tsx`：五屏容器 + 深色终端风基础样式（近黑底、细网格、单色光晕、等宽字体），PC 与移动端等价布局
- [X] T019 [US1] 实现 `src/frontend/components/open/PersonaPicker.tsx`：两张身份卡（销售 · 王小明 / 主管 · 陈队长）+ 点击后**原地展开**配置（不跳页）
- [X] T020 [US1] 实现 `src/frontend/components/open/ClientConfigTabs.tsx`：WorkBuddy / Claude Code / Claude Desktop / Cursor / Codex 五个 tab 各渲染对应语法 + 一键复制；**Codex tab 单独处理**（凭证走环境变量，步骤多一步 export，不套用统一模板）
- [X] T021 [P] [US1] 实现 `src/frontend/components/open/ToolCatalog.tsx`：从 `GET /api/v1/mcp/tools` 取数渲染 9 个工具卡片，供首页总览与 `/open/tools` 复用
- [X] T022 [P] [US1] 实现首页示例问句区于 `src/frontend/app/open/page.tsx`：spec.md §5.3 的六条问句，点击复制
- [X] T023 [US1] PC 端 Playwright e2e 于 `src/frontend/tests/e2e/pc-open-platform.spec.ts`：领密钥 → 配置展开 → 复制 → 工具目录可见
- [X] T024 [US1] 移动端 Playwright e2e 于 `src/frontend/tests/e2e/mobile-open-platform.spec.ts`：与 T023 完全对等的路径，**不得出现任何"请到电脑上操作"分支**

**Checkpoint**: US1 独立可用 —— 这就是 MVP，可以对外放出去了

---

## Phase 4: User Story 2 — 身份决定可见范围（P0）

**Goal**: 同一地址同一套工具，换密钥看到的数据范围截然不同

**Independent Test**: 销售密钥与主管密钥分别问"哪几单有风险"，销售返回集合是主管返回集合的真子集

### Tests for User Story 2

- [X] T025 [P] [US2] 集成测试：双身份对同一工具的返回集合满足 A ⊂ B 且 A ≠ B，于 `src/backend/tests/integration/test_mcp_datascope.py`
- [X] T026 [P] [US2] 集成测试：两种身份的**工具列举结果完全相同**（差异只在数据、不在能力），于 `src/backend/tests/integration/test_mcp_datascope.py`

### Implementation for User Story 2

- [X] T027 [US2] 核验 `src/backend/app/api/mcp.py` 中密钥换得的 `user` 被正确传入 `execute_tool`，确保既有 `get_visible_user_ids` 生效（**不新建任何权限逻辑**）
- [X] T028 [US2] 越权探测响应一致化于 `src/backend/app/api/mcp.py`：请求可见范围外的标识时，返回与"不存在"完全相同的结果，不泄露存在性
- [X] T029 [US2] 在 `src/frontend/components/open/PersonaPicker.tsx` 补充两身份可见范围的说明文案，让访客理解差异从何而来
- [X] T030 [US2] PC + 移动端 e2e 补充双身份对比场景于 `src/frontend/tests/e2e/pc-open-platform.spec.ts` 与 `mobile-open-platform.spec.ts`

**Checkpoint**: US1 + US2 均独立可用；本 feature 的核心叙事已成立

---

## ~~Phase 5: User Story 3 — 未接入也能看见它真的在跑（P1）~~ ⛔ 2026-08-16 撤销

> 已实现并通过测试，随后按用户决定**整体移除**（首页演示区 + 后端端点 + 测试 + 组件 + 配置）。
> 处置清单见 spec.md §8。下列任务保留作为历史记录。

**Goal**: 访客零配置点一下预置问句，看到真实工具调用与返回

**Independent Test**: 不领密钥、不做任何配置，点击首页演示区问句，观察工具调用与结果被逐步打印

### Tests for User Story 3

- [X] T031 [P] [US3] 集成测试：演示区配额耗尽后，访客自领密钥的调用**不受影响**，于 `src/backend/tests/integration/test_mcp_demo_quota.py`

### Implementation for User Story 3

- [X] T032 [US3] 实现 `POST /api/v1/mcp/demo` 演示代理端点于 `src/backend/app/api/mcp.py`：服务端从环境变量读取演示密钥，流式返回"调用工具 → 返回结果"过程；**密钥禁止出现在任何响应体中**
- [X] T033 [US3] 预置问句标识白名单于 `src/backend/app/api/mcp.py`：只接受 `question_id`，**拒绝自由文本**，避免演示区变成不受控的公开问答入口
- [X] T034 [US3] 实现 `src/frontend/components/open/LiveDemo.tsx`：流式渲染工具调用过程，置于第 3 屏与第 4 屏之间
- [X] T035 [US3] PC 端 e2e 覆盖演示区于 `src/frontend/tests/e2e/pc-open-platform.spec.ts`
- [X] T036 [US3] 移动端 e2e 覆盖演示区于 `src/frontend/tests/e2e/mobile-open-platform.spec.ts`

**Checkpoint**: 访客在投入配置成本之前就能确认这不是静态宣传页

---

## Phase 6: User Story 4 — 公开暴露下的稳定与安全（P1）

**Goal**: 在完全公开、鼓励分享的前提下，平台不被拖垮、不成为攻击他人的跳板

**Independent Test**: 单密钥打满额度触发 429；演示数据中植入伪装指令文本，验证返回时被标记为不可信并截断

### Tests for User Story 4

- [X] T037 [P] [US4] 集成测试：MCP 端点打满限流后，**内置 Copilot 聊天仍可正常使用**（两者限流 key 必须独立——2026-05-21 串桶事故的守护测试），于 `src/backend/tests/integration/test_mcp_rate_limit.py`
- [X] T038 [P] [US4] 集成测试：发放密钥 → 调通一次 → 触发一次演示数据重置 → 再调仍成功，于 `src/backend/tests/integration/test_mcp_survives_demo_reset.py`（守护 FR-030；`demo_reset_service` 是**显式删除列表**，`McpToken` 默认即被保留，本测试防的是未来有人把它加进列表）
- [X] T039 [P] [US4] 单测：自由文本注入消毒（不可信标记 + 长度截断）于 `src/backend/tests/unit/test_mcp_sanitize.py`

### Implementation for User Story 4

- [X] T040 [US4] 在 `src/backend/app/services/rate_limiter.py` 新增 `get_token_key`（返回密钥摘要前缀，无有效密钥时回落 IP），**严禁复用 `get_ip_user_key`**
- [X] T041 [US4] 将限流应用到 MCP 端点与密钥发放端点，阈值**全部从 SystemConfig 读取**、代码中不得出现字面量（宪法原则三）
- [X] T042 [US4] 实现密钥发放频率限制（每来源每日 `mcp_issue_per_ip_per_day`）于 `src/backend/app/api/mcp_tokens.py`
- [X] T043 [US4] 实现自由文本注入消毒于 `src/backend/app/services/mcp_tool_registry.py`（或工具返回后处理层）：用户可编辑文本包裹不可信标记 + 长度截断，**重点覆盖 `get_followup_history`**（9 个工具中唯一大量输出访客可编辑文本者）
- [X] T044 [US4] 完善三类失效与超额的人类可读文案于 `src/backend/app/core/mcp_auth.py`：过期时须明确说"已过期"并给出 `/open` 重领地址（这些文案会被 AI 助手直接转述给用户）
- [X] T045 [US4] 在 `src/backend/app/services/demo_reset_service.py` 删除列表相邻处添加注释：**`McpToken` 属凭证表，禁止加入本列表**
- [X] T046 [US4] 在 `src/frontend/app/open/page.tsx` 页脚落实三项声明：限流规则 / 数据为虚构演示数据且定期重置 / **本平台不提供任何写入接口**

**Checkpoint**: 可以长期开着不用盯

---

## Phase 7: User Story 5 — 自助查阅工具契约与接入文档（P2）

**Goal**: 不接入也能查到完整契约与可照做的接入步骤

**Independent Test**: 直接访问工具页与文档页，核对 9 个工具契约完整、5 种客户端步骤可照做

### Implementation for User Story 5

- [X] T047 [P] [US5] 实现 `/open/tools` 页面于 `src/frontend/app/open/tools/page.tsx`：9 个工具的完整参数、必填标识、返回结构、示例问法（复用 T021 组件，数据同源）
- [X] T048 [P] [US5] 实现 `/open/docs` 页面于 `src/frontend/app/open/docs/page.tsx`：5 种客户端分步接入、鉴权说明、限流规则、错误码、FAQ；Codex 的环境变量差异单独成节
- [X] T049 [US5] 实现 `/open/llms.txt` Route Handler 于 `src/frontend/app/open/llms.txt/route.ts`：`text/plain; charset=utf-8`，工具清单从 `GET /api/v1/mcp/tools` 取数，内容须足以让 AI 助手自行生成配置
- [X] T050 [US5] PC + 移动端 e2e 覆盖两个新页面于 `src/frontend/tests/e2e/pc-open-platform.spec.ts` 与 `mobile-open-platform.spec.ts`

**Checkpoint**: 全部 5 个 story 独立可用

---

## Phase 8: Polish & Cross-Cutting

- [X] T051 更新 `docs/deploy.md` 的 nginx 模板：`/api/v1/` location 增补 `proxy_buffering off`，并写明**漏配的表现是工具调用长时间无响应而非渲染问题**
- [X] T052 演示密钥的环境变量纳入部署 secrets 管理，更新 `.env.production.example` 与 `docs/deploy.md`
- [ ] T053 **五客户端逐个实测**（WorkBuddy / Claude Code / Claude Desktop / Cursor / Codex），各问一句、各截一张图；**不得靠推断代替实测**（SC-004）
  > ⏸ **未执行**：需要在装有这些客户端的机器上人工操作，AI 无法代劳。协议层已由契约测试与本地真实调用验证（9 工具列举 + 工具调用 + 两身份数据范围差异全部通过），但「某个客户端能不能连上」必须实机验证。
- [ ] T054 部署后自检：打开 `/open` 查看页面源码与网络请求，确认演示密钥在任何位置都搜不到（FR-021）
  > ⏸ **待部署后执行**。本地已验证：`curl /open | grep -c sfa_ro_` 结果为 0，e2e 也断言了页面内容不含 `sfa_ro_`。
- [X] T055 按 quickstart.md §二 逐条走验收清单（SC-003 / 004 / 005 / 006 / 007 + FR-027）
- [X] T056 全量回归：后端 pytest 全绿 + PC/Mobile 双套 Playwright 全绿，无既有用例回归

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**：无依赖，立即可开始。**T001 是全局第一关，未通过不得继续**
- **Phase 2 Foundational**：依赖 Phase 1，**阻塞所有 user story**
- **Phase 3–7 User Stories**：均依赖 Phase 2 完成；之后可并行或按优先级串行
- **Phase 8 Polish**：依赖所需 story 全部完成

### User Story Dependencies

- **US1 (P0)**：Phase 2 后即可开工，不依赖其他 story —— **它单独完成即构成可交付 MVP**
- **US2 (P0)**：Phase 2 后即可开工。复用 US1 的端点，但可独立测试（后端集成测试即可验证，不必等前端）
- **US3 (P1)**：Phase 2 后即可开工，独立于 US1/US2
- **US4 (P1)**：Phase 2 后即可开工。其中 T037 需 US1 端点存在方可完整验证
- **US5 (P2)**：Phase 2 后即可开工，与 US1 共用工具目录端点与组件

### Within Each Story

- 测试先写并确认失败 → 模型 → 服务 → 端点 → 前端 → e2e
- 每个 story 完成即跑一次 PC + Mobile e2e，不攒到最后

### Parallel Opportunities

- T003 与 T001/T002 无冲突（不同文件）
- Phase 2 内 T004 / T005 / T008 可并行；T011 / T012 可并行
- Phase 2 完成后，US1 / US3 / US5 可由不同人并行推进
- 各 story 内标 [P] 的测试任务可并行

---

## Parallel Example: User Story 1

```text
# 测试先行，两条并行：
Task: "契约测试 9 个工具 in src/backend/tests/contract/test_mcp_tools_contract.py"
Task: "集成测试 端到端 in src/backend/tests/integration/test_mcp_end_to_end.py"

# 前端组件并行：
Task: "首页骨架 in src/frontend/app/open/page.tsx"
Task: "ToolCatalog in src/frontend/components/open/ToolCatalog.tsx"
Task: "示例问句区 in src/frontend/app/open/page.tsx"
```

---

## Implementation Strategy

### MVP First（只做 US1）

1. Phase 1 Setup —— **T001 先过**
2. Phase 2 Foundational（阻塞项，必须全完成）
3. Phase 3 US1
4. **STOP + 验证**：干净机器实测一次完整接入
5. 可对外放出

### Incremental Delivery

1. Setup + Foundational → 地基就位
2. \+ US1 → 独立验证 → **MVP 可交付**
3. \+ US2 → 核心叙事成立（身份即范围）
4. \+ US3 → 站点自证
5. \+ US4 → 可长期开着
6. \+ US5 → 完整开放平台形态

---

## Notes

- 全程无数据库迁移任务（本仓库无 alembic，`create_all` 自动建表）
- `McpToken` **默认已免于**演示数据重置（删除列表是显式的）——T038 与 T045 是**防未来回归**，不是补缺
- 限流 key 独立于内置聊天，是 2026-05-21 串桶事故的直接教训，T037 守住它
- 任何"移动端暂不支持"的路径都是返工项，不是可接受的中间态
- 每完成一个任务或一组逻辑相关任务即提交
