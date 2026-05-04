# Research: 登录页改造 + 移动端 + Onboarding（UX 版）

**Feature**: `001-login-mobile-onboarding`
**Date**: 2026-05-03
**Phase**: 0 — Outline & Research

本文件记录关键技术决策的调研、理由、备选方案。所有 NEEDS CLARIFICATION 已在 spec 阶段消化，本阶段无残留。

---

## Decision 1: 移动端实现路径 — 独立路由 vs CSS 响应式

**Decision**: 采用 `/m/*` 独立路由前缀 + 客户端视口重定向。

**Rationale**:
- 移动端 layout（金刚区 + 全屏 chat）与 PC layout（侧栏 + 右侧 chat）是**完全不同的组件树**。CSS 响应式（隐藏/显示）会让两套结构在同一 DOM 里共存，移动端会下载并 hydrate 大量永远看不到的 PC 组件，包体显著膨胀。
- spec.md FR-010 显式要求"互不污染"。独立路由是最干净的隔离手段。
- Next.js App Router 的 route group `(mobile-app)` 天然支持"同一前缀下共享 layout"——`/m/(mobile-app)/leads`、`/m/(mobile-app)/chat` 都共享 `/m/(mobile-app)/layout.tsx` 的 MobileShell。
- 业务页面通过**组件级复用**而非路由复用：`/leads/page.tsx` 和 `/m/(mobile-app)/leads/page.tsx` 都 import 同一个 `<LeadList />` 组件。

**Alternatives Considered**:
- **CSS Tailwind 响应式断点**：单 layout 用 `md:hidden` / `md:block` 切换。简单，但违反 FR-010 隔离要求；移动端打包会包含 PC 组件代码。
- **服务端 UA 检测 + 单路由**：性能好，但 SSR 复杂度上升、易出 hydration mismatch。SFA CRM 现有架构是客户端鉴权，没有 SSR 数据负担，没必要引入复杂度。
- **独立子域 m.example.com**：需要部署/DNS 改动——本 feature 显式排除部署相关工作。

---

## Decision 2: 移动端 Chat 内嵌卡片范式 — 后端改 vs 前端改

**Decision**: **零后端改动**，仅前端在移动端视口下把现有 `navigate_*` tool 结果换皮渲染为 `<ChatFormCard>`。

**Rationale**:
- 关键发现：现有 `app/services/agent_service.py` 中所有"写类操作"已经是 `navigate_*` 形式（`navigate_create_lead` / `navigate_log_followup` / `navigate_create_key_event` / `navigate_convert_lead` / `navigate_release_lead` / `navigate_mark_lost`），返回 `{action: "navigate", url: "/leads/...", label: "..."}`，从不直接写库。LLM 始终通过"提示用户去对应表单页提交"完成写类。
- 这正是 spec.md FR-022 想要的"AI 不直接写库 → 用户确认后提交"语义——已经天然成立。
- 因此移动端只需要：在 chat 消息流中检测到 `action: "navigate"` 结果时，**渲染 ChatFormCard** 而非现有的 nav 按钮；卡片 onClick 解析 URL query 字符串作为 prefill，传给 `MobileFormSheet`；抽屉中复用既有表单组件，提交走既有 CRUD 端点。
- 优点：零后端改动 = PC Copilot 行为零回归（FR-028 / SC-007 自动满足）；测试面收敛到前端。

**Alternatives Considered**:
- **后端新增"返回结构化 pending object"的并行 tool 集合**（`propose_create_lead` 等）。需要：① 改 system prompt 让 LLM 在 mobile 模式调新 tool；② 改 chat API 接 `client_mode` 参数；③ 后端测试覆盖新 tool。工作量大、风险高、收益等同。**否决**。
- **AI 直接 streaming 结构化 JSON 而非走 tool**。需要重写 system prompt 和响应解析层，破坏现有 PC tool 流。**否决**。

---

## Decision 3: 移动端视口判定阈值

**Decision**: `matchMedia("(max-width: 768px)")`。<br>视口 ≤ 768px 跳 `/m/*`，> 768px 走 PC `/...`。

**Rationale**:
- 768px 是 Tailwind `md` 断点的常见值，覆盖手机竖屏（≤ 480px）+ 大部分平板竖屏（≤ 768px）。平板竖屏体验更接近移动金刚区而非 PC 侧栏。
- 平板横屏（≥ 1024px）和 PC 桌面共用 PC layout，符合用户对"大屏=工作台"的心智模型。
- 实现：客户端 hook `useIsMobile()`，在 layout 顶部 `useEffect` 中判定并 `router.replace`。

**Alternatives Considered**:
- 480px：只覆盖手机，平板用户落到 PC 侧栏被压缩，体验差。
- 1024px：平板横屏被推到移动 layout，工作场景下不合适。
- **不做自动重定向，让用户自己输入 `/m/*`**：访客根本不知道这个路径，UX 灾难。**否决**。

---

## Decision 4: 一键角色切换实现 — 纯前端 vs 新增后端端点

**Decision**: **纯前端方案**——`AuthContext.quickSwitchRole(targetLogin)` 内部依次调 `logout` + `login(targetLogin, demoPassword)`。

**Rationale**:
- 现有 `auth-context.tsx` 已暴露 `login(loginName, password)` 和 `logout()`。组合即可。
- demo 账号密码是固定值（如 `12345`），可以在前端配置数组里硬编码（仅 demo 用途，本 feature 范围内可接受——见 spec.md Assumptions "前端硬编码用于一键登录"）。
- 全流程一次往返：logout → login，本地实测应远低于 SC-006 的 3 秒约束。
- 不引入后端新端点 = 测试面更小，符合"不引入新后端代码"原则（除非必要）。

**Alternatives Considered**:
- **新增 `POST /api/auth/quick-switch` 后端端点**：避免前端硬编码密码，更"干净"。但 demo 账号密码本来就是公开 demo 用途，硬编码不构成实际安全风险（且这是 UX 版，公网/安全推迟）。否决以保持最小化改动。
- **保持当前账号 session，加一个 "viewing as" 影子模式**：实现复杂、要改后端鉴权，违背"最小化改动"。否决。

---

## Decision 5: 引导卡片配置存放位置

**Decision**: 前端 `lib/onboarding-config.ts` 单一信源（导出 `ONBOARDING_CARDS` 数组 + `ROLE_CARDS` 数组）。

**Rationale**:
- 引导卡片清单（标题 / 完整问题 / 角色 / 平台 / 类型）是**展示层数据**，不是业务规则；放后端会增加无谓的网络往返。
- 配置数组让"上线后看数据决定裁哪张"的策略可以**改一行常量配置 + 重新部署**完成，无需走 spec-kit 流程（与 input doc 的"卡片话术微调不走 spec-kit"原则一致）。
- 与 `src/demo/copilot-cases.md` 形成单向引用：配置项里加 `caseRef: "案例 3"` 字段做溯源。

**Alternatives Considered**:
- 后端 `/api/onboarding/cards` 端点：过度工程，且配置改动比代码部署更频繁，没必要。否决。
- 散落在各组件 JSX 中硬编码：违反宪法 "三、规则可配置"。否决。

---

## Decision 6: ChatFormCard 在 chat 流中的渲染时机

**Decision**: 在前端 chat 消息流的 markdown/文本渲染管线中，识别后端返回的 `action: "navigate"` 结果（来自 tool execution 的 JSON 响应）并替换为 `<ChatFormCard>` 节点。**移动端独占**，PC 仍渲染现有 nav 按钮。

**Rationale**:
- 现有 `chat-sidebar.tsx` 的 `parseNavMarkers` 已处理 `[[nav:label|url]]` 文本标记。移动端 chat 容器复用这套解析逻辑，但替换"如何渲染 nav 段"的实现：PC = `<button>` nav button、Mobile = `<ChatFormCard>`。
- 通过**渲染策略注入**而非 fork chat 组件，避免逻辑分叉。

**Alternatives Considered**:
- 让后端针对 mobile 返回不同的标记格式（如 `[[card:type|url]]`）。需要后端改、增加耦合，否决。
- 把 ChatFormCard 渲染逻辑和 chat-sidebar 完全 fork。代码重复，否决。

---

## Decision 7: MobileFormSheet 内的表单组件复用策略

**Decision**: 从既有 `/leads/[id]/page.tsx` / `/leads/new/page.tsx` 抽离表单字段为独立可挂载组件（如 `<LeadForm initialValues={...} onSubmit={...} />`），sheet 中挂载这些组件。

**Rationale**:
- 表单字段、校验、字段联动逻辑只应有一份实现。PC 表单页和 mobile 抽屉表单都引用同一组件 = 行为一致。
- 抽离后 PC 表单页本身改动最小（外层包裹不变，内部把字段块换成 import 的 component）。

**Alternatives Considered**:
- 移动 sheet 用一套独立的简化表单：字段不一致 → 体验割裂 + 维护翻倍。否决。

---

## Decision 8: 移动端"我的" tab 内 - 切换角色入口

**Decision**: "我的"页面顶部展示当前角色卡片 + "切换到 [对方角色]"大按钮 + 退出登录链接。

**Rationale**:
- 一键切换是 demo 的核心引导，要做主入口；不能藏在二级菜单。
- 同时 chat 引导卡片中的"💡 切换角色"卡片也走同一函数 `quickSwitchRole`。

**Alternatives Considered**:
- "我的"用列表式（账号 / 切换角色 / 退出）。视觉权重不够，访客不容易意识到可切换。否决。

---

## 验证清单

- [x] 所有 spec.md 中的 [NEEDS CLARIFICATION] 已在 spec 阶段消化（本 feature 输入文档已经穷尽对齐，spec 中 0 残留）
- [x] 所有 Decision 与宪法 v1.1.0 一致（特别是"二、API 优先" + "三、规则可配置" + "六、显式优于隐式"）
- [x] 没有引入新依赖
- [x] PC Copilot 现有行为零回归路径成立（Decision 2 + Decision 6）
