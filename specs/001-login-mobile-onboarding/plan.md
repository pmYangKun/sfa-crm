# Implementation Plan: 登录页改造 + 移动端 + Onboarding（UX 版）

**Branch**: `001-login-mobile-onboarding` | **Date**: 2026-05-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-login-mobile-onboarding/spec.md`

## Summary

把 SFA CRM 的访客试玩闭环 UX 做完整：PC 登录页改造为"角色卡片一键登录 + 项目亮点"形态、新增完整移动端形态（金刚区导航 + 全屏 Chat）、PC + 移动两端首次登录引导、移动端 Chat 内嵌待确认表单卡片范式。**纯 UX 增量**——不动数据模型、不引入新后端依赖、不涉及部署/安全/限流。

**关键技术发现**：现有后端 `agent_service.execute_tool` 中所有写类操作（创建线索 / 录入跟进 / 关键事件 / 转化 / 释放 / 标记流失）**已经是 `navigate_*` 形式**（返回 `{action: "navigate", url: ...}` 让前端跳转到表单页让用户提交），LLM 从来不直接写库。这意味着移动端"chat 内嵌卡片"范式**不需要改后端 tool 层**——前端在移动端 Chat 中检测到 `action: "navigate"` 时，渲染 `ChatFormCard` + `MobileFormSheet` 而非 PC 的 nav button，提交仍然走现有 CRUD 端点。**spec.md FR-022（AI 不直接写库）实际上已经天然成立。**

---

## Technical Context

**Language/Version**:
- 前端 TypeScript 5 / Next.js 14（App Router）/ React 18
- 后端 Python 3.11 / FastAPI 0.110+

**Primary Dependencies**:
- 前端：`next`、`react`、`@vercel/ai`（AI SDK，已用）、`zod`（已用）。**本次不引入**新的 UI 组件库；自己写最小集（卡片 / 抽屉 / 金刚区 tab）以保持现有"行内 style 风格"一致。
- 后端：`fastapi`、`sqlmodel`、`slowapi`（已声明但本 feature 不新增使用）、`apscheduler`（已声明但本 feature 不新增使用）。**本 feature 不引入任何新后端依赖。**

**Storage**: 现有 SQLite（`src/backend/app/data/`）。**本 feature 不新增表 / 不改 schema。**

**Testing**:
- 现有 `pytest` 测试套件保留运行
- 本 feature 主要验收手段：本地浏览器（PC + DevTools 移动视口模拟）人工走查，详见 `quickstart.md`
- 不强制新增自动化 E2E

**Target Platform**:
- PC：现代浏览器（Chrome/Edge/Firefox 最近 2 个版本）≥ 1280px 视口
- 移动：iOS Safari 14+ / Android Chrome 100+ / 微信内置浏览器 / 视口 320px - 480px 竖屏为主，横屏不可崩溃但不优化

**Project Type**: Web application（前后端分离，前端 Next.js + 后端 FastAPI），见 Project Structure

**Performance Goals**:
- 登录到主页可交互 ≤ 5 秒（SC-001 / SC-002）
- 一键切换角色 ≤ 3 秒（SC-006）
- 引导卡片点击到 chat 中显示用户消息 ≤ 200ms（不含 AI 响应延迟）
- 移动端 Chat 抽屉打开动画 ≤ 300ms

**Constraints**:
- **PC Copilot 现有行为零回归**（FR-028 / SC-007）
- 移动端 320px 视口下无横向滚动（SC-003）
- 不引入新后端依赖（Assumptions）
- 业务页面不重写（FR-029），仅 Layout + 登录页是两套

**Scale/Scope**:
- 新增/改动文件预估 25-35 个（见 Project Structure 详细列表）
- 新增前端组件 ≈ 10 个（Mobile Layout / KingKongTab / 移动版 Chat 全屏 / ChatFormCard / MobileFormSheet / 角色卡 / PC 亮点区 / 移动亮点区 / Onboarding Panel / 切换角色弹窗）
- 改动既有文件 ≈ 5 个（login/page.tsx / authenticated/layout.tsx / dashboard/page.tsx / chat-sidebar.tsx / auth-context.tsx）
- 新增后端代码：可选 1 个端点（角色快速切换，如果决定走后端方案）

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

宪法 v1.1.0 的 6 条核心原则在本 feature 的适用性：

| 原则 | 适用性 | 检查结论 |
|------|--------|----------|
| 一、Ontology 优先 | 不适用 | 本 feature 不动数据模型 / schema / 状态机；既有 Ontology 不变 |
| 二、API 优先 | 适用 | 移动端写类操作仍走现有 CRUD API（不绕过）；新增"角色快速切换"如果走后端方案，须经标准 auth 端点。✅ Pass |
| 三、规则可配置 | 部分适用 | 引导卡片清单 + 角色卡片副本以**配置数组**形式存放（前端 `lib/onboarding-config.ts`），不硬编码在组件 JSX 里。✅ Pass |
| 四、数据完整性 | 不适用 | 本 feature 不动客户去重 / 速率限制 / 池抢占等数据完整性逻辑 |
| 五、最小化录入负担 | 适用 | 移动端 Chat 内嵌卡片范式恰是"AI 替销售预填、销售只确认"——**强符合**本原则。✅ Pass |
| 六、显式优于隐式 | 适用 | spec.md 30 条 FR / 17 个 Acceptance Scenario / 8 个 Edge Case 显式声明；引导卡片配置 / Demo 账号映射均为显式数组而非约定。✅ Pass |

**结论**：本 feature 与宪法**完全一致**。无违宪项。Complexity Tracking 不需要填写。

---

## Project Structure

### Documentation (this feature)

```text
specs/001-login-mobile-onboarding/
├── spec.md                # ✅ 已生成
├── plan.md                # ✅ 本文件
├── research.md            # ✅ Phase 0 输出
├── data-model.md          # ✅ Phase 1 输出（含 Onboarding/RoleCard 配置数据结构 + ChatFormCard 状态机）
├── quickstart.md          # ✅ Phase 1 输出（人工验收步骤）
├── contracts/             # ✅ Phase 1 输出
│   ├── ui-contracts.md            # 前端组件输入输出契约
│   └── role-switch-api.md         # 后端"角色快速切换"端点契约（可选）
├── checklists/
│   └── requirements.md    # ✅ /specify 阶段输出
└── tasks.md               # ⏳ Phase 2 输出（/speckit.tasks 命令产出）
```

### Source Code (repository root)

实际项目布局为**前后端分离 Web 应用**：

```text
src/
├── backend/                          # FastAPI Python 后端
│   └── app/
│       ├── api/
│       │   └── auth.py               # 既有 login/logout 端点；可选新增"角色快速切换"端点
│       ├── services/
│       │   └── agent_service.py      # 既有 tool 层（本 feature 不动）
│       └── models/                   # 既有 SQLModel（本 feature 不动）
└── frontend/                         # Next.js 前端
    └── src/
        ├── app/
        │   ├── login/
        │   │   └── page.tsx                  # ⚠️ 改造：替换为角色卡片 + 项目亮点
        │   ├── m/                            # 🆕 移动端路由前缀（独立 Layout 入口）
        │   │   ├── login/
        │   │   │   └── page.tsx              # 🆕 移动端登录页
        │   │   └── (mobile-app)/             # 🆕 已登录的移动端 Layout（金刚区）
        │   │       ├── layout.tsx            # 🆕 MobileShell（含金刚区 + 鉴权重定向）
        │   │       ├── chat/page.tsx         # 🆕 全屏 Chat（默认进）
        │   │       ├── leads/page.tsx        # 🆕 引用既有 Lead 列表组件
        │   │       ├── customers/page.tsx    # 🆕 引用既有 Customer 列表组件
        │   │       ├── followups/page.tsx    # 🆕 跟进流（最近跟进 + 录入入口）
        │   │       └── me/page.tsx           # 🆕 我的（账号 / 切换角色 / 退出）
        │   └── (authenticated)/
        │       ├── layout.tsx                # ⚠️ 加视口检测：如果是移动视口 → router.replace('/m/...')
        │       └── dashboard/page.tsx        # ⚠️ Dashboard 顶部加 OnboardingPanel
        ├── components/
        │   ├── auth/
        │   │   ├── role-card.tsx                       # 🆕 PC + 移动共用的角色卡片
        │   │   ├── highlights-panel-pc.tsx             # 🆕 PC 项目亮点区
        │   │   └── highlights-panel-mobile.tsx         # 🆕 移动精简亮点
        │   ├── onboarding/
        │   │   ├── onboarding-panel.tsx                # 🆕 PC Dashboard 引导区
        │   │   ├── onboarding-cards-mobile.tsx         # 🆕 移动 Chat 顶部引导
        │   │   └── role-switch-confirm.tsx             # 🆕 切换角色确认弹窗
        │   ├── mobile/
        │   │   ├── kingkong-tabbar.tsx                 # 🆕 底部金刚区（5 入口含中间凸起）
        │   │   ├── chat-fullscreen.tsx                 # 🆕 全屏 Chat 容器
        │   │   ├── chat-form-card.tsx                  # 🆕 chat 内嵌待确认表单卡
        │   │   └── mobile-form-sheet.tsx               # 🆕 底部抽屉表单
        │   ├── chat/
        │   │   └── chat-sidebar.tsx                    # ⚠️ PC 视口下行为不变；抽离消息渲染逻辑给移动端复用
        │   └── nav/
        │       └── sidebar.tsx                          # 既有 PC 侧栏（不动）
        └── lib/
            ├── onboarding-config.ts                    # 🆕 引导卡片清单 + 角色卡片副本（单一信源）
            ├── viewport.ts                             # 🆕 useIsMobile hook（基于 matchMedia 480px）
            └── auth-context.tsx                        # ⚠️ 加 quickSwitchRole(targetLogin) 方法

specs/                                                  # spec-kit feature workspace
├── inputs/login-mobile-launch.md                       # 业务对齐输入（已有）
├── master/                                             # 既有 master 全局 spec（不动）
└── 001-login-mobile-onboarding/                        # 本 feature 工作空间
```

**Structure Decision**: **Web application 结构**（option 2 的 backend + frontend 变体）。

**移动端路由策略**：使用**独立的 `/m/*` 路由前缀** + 视口检测自动跳转（在 `(authenticated)/layout.tsx` 检测移动视口后 `router.replace('/m/...')` 对应路径），而非纯 CSS 响应式。理由：
1. 金刚区 + 全屏 Chat vs 侧栏 + 右栏 Chat 是**完全不同的 layout 树**，CSS 响应式难以做到组件级隔离
2. 独立路由让 PC / 移动 layout 互不污染（FR-010 强约束）
3. 业务页面（Lead / Customer / 跟进流）通过**组件复用**而非路由复用——`/m/leads` 和 `/leads` 都引用同一份列表组件，仅外层 Layout 不同
4. 不引入 `useragent` 服务端检测，避免 SSR 边缘情况；纯客户端 viewport 重定向

**移动端 Chat 内嵌卡片技术路径**：
- 复用现有 `chat-sidebar.tsx` 的 `parseNavMarkers` + 消息渲染逻辑（抽到独立 hook 或 util）
- 在移动端 Chat 容器中，把 `[[nav:label|url]]` 标记 / 后端 `action: "navigate"` 结果**渲染为 `ChatFormCard`** 而非 nav button
- `ChatFormCard.onClick` → 解析 url 中的 query string → 把同样数据丢给 `MobileFormSheet` → 抽屉中渲染对应表单（form 组件需要从既有 `/leads/[id]/page.tsx` / `/leads/new/page.tsx` 抽离出可独立挂载的版本）
- 抽屉提交 → 走既有 CRUD 端点 → 卡片 setState 到 ✅ 已创建

## Complexity Tracking

> 无违宪项，本节留空。

---

## Phase Outputs

- ✅ **Phase 0** Outline & Research → `research.md`
- ✅ **Phase 1** Design & Contracts → `data-model.md` + `contracts/ui-contracts.md` + `contracts/role-switch-api.md` + `quickstart.md`
- ⏳ **Phase 2** Tasks → `tasks.md`（由 `/speckit.tasks` 命令产出）

下一步：运行 `/speckit.tasks` 生成任务拆解。
