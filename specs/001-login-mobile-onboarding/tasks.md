---
description: "Task list for 登录页改造 + 移动端 + Onboarding（UX 版）"
---

# Tasks: 登录页改造 + 移动端 + Onboarding（UX 版）

**Input**: Design documents from `/specs/001-login-mobile-onboarding/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本 feature 不强制新增自动化测试（spec assumptions 已说明，验收以 quickstart.md 人工走查为主）。Tasks 中**不包含**自动化测试任务，但保留 `pytest` 既有套件回归（见 Polish 阶段 T999）。

**Organization**: Tasks 按 user story 分组，每个 story 可独立实现 + 独立人工走查。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无依赖）
- **[Story]**: US1 / US2 / US3 / US4
- **路径约定**：所有路径相对项目根 `d:/MyProgramming/cc/SFACRM/`

---

## Phase 1: Setup（共享基建）

**Purpose**: 建立配置单一信源 + 视口检测 hook，所有 user story 都会用到。

- [x] **T001** [P] 创建引导卡片 / 角色卡片配置文件 `src/frontend/src/lib/onboarding-config.ts`，按 `data-model.md § 1.1 + 1.2` 写入 `ROLE_CARDS` 和 `ONBOARDING_CARDS` 两个常量数组。
- [x] **T002** [P] 创建视口检测 hook `src/frontend/src/lib/viewport.ts`，导出 `useIsMobile()`，基于 `matchMedia("(max-width: 768px)")`，挂载后监听 resize 事件。
- [x] **T003** [P] 在 `src/frontend/src/lib/auth-context.tsx` 新增 `quickSwitchRole(targetLogin: string, targetPassword: string): Promise<void>` 方法（实现偏离：未走"先 logout 再 login"避免 (authenticated) layout 在过渡窗口把用户踢回 /login，改为原子替换 token+state；签名保持一致）。

**Checkpoint**: 配置和工具就位，user story 可并行开始。

---

## Phase 2: Foundational（阻塞性基础）

**Purpose**: 建立 PC / 移动跨端的视口路由网关 + Mobile Layout 骨架，US1（PC）虽然不依赖移动 layout 但 US2/US3/US4 全部依赖。

**⚠️ CRITICAL**: 本 phase 之前**任何 user story 不可开始 implementation**（US1 例外，可与 Phase 2 并行，因为 US1 完全在 PC 路径下）。

- [x] **T004** [US1+US2+US3+US4 跨端门] 改造 `src/frontend/src/app/(authenticated)/layout.tsx`：在 useEffect 中调 `useIsMobile()`；如果是移动且当前不在 `/m/*`，按路径映射规则 `router.replace("/m/...")`（映射规则见 `contracts/ui-contracts.md § 14`）。**关键约束**：PC 视口下行为零变化。
- [x] **T005** [P] [US2+US3+US4] 创建 `/m/login` 路由文件夹，新增空白 `src/frontend/src/app/m/login/page.tsx`（占位即可，US2 阶段填充）。占位含 PC 视口反向跳转（foundational 关切）。
- [x] **T006** [P] [US2+US3+US4] 创建 `/m/(mobile-app)/` 路由组：新增 `src/frontend/src/app/m/(mobile-app)/layout.tsx` 实现 `<MobileShell>`（含鉴权门 + `<KingKongTabbar>` 占位 + `{children}` 区域），布局规则见 `contracts/ui-contracts.md § 13`。
- [x] **T007** [P] [US2+US3+US4] 创建金刚区组件 `src/frontend/src/components/mobile/kingkong-tabbar.tsx`，按 `data-model.md § 1.3` 的 `TABS` 常量 + `contracts/ui-contracts.md § 7` 渲染契约，中间💬凸起。
- **新增（tasks.md 未列）**：`src/frontend/src/lib/route-map.ts` —— PC↔移动路径映射的单一信源，T004/T006 共用，避免双向映射规则散落和不对称。

**Checkpoint**: 移动端骨架就位，US2/US3/US4 可开工；US1 可与本 phase 并行。

---

## Phase 3: User Story 1 - PC 端访客试玩闭环（Priority: P1）🎯 MVP

**Goal**: 公众号读者在 PC 上能完成"打开 → 一键登录 → 进 Dashboard 看引导 → 点卡片体验 demo"全闭环。

**Independent Test**: PC 浏览器打开站点 → 点 sales01 卡片登录 → Dashboard 顶部出现引导区 → 点"自然语言查线索"卡片 → 收到 AI 回答。

### Implementation for User Story 1

- [x] **T010** [P] [US1] 创建角色卡片组件 `src/frontend/src/components/auth/role-card.tsx`，按 `contracts/ui-contracts.md § 1` 实现，支持 `layout: "pc" | "mobile"` 两种渲染。
- [x] **T011** [P] [US1] 创建 PC 项目亮点区 `src/frontend/src/components/auth/highlights-panel-pc.tsx`，按 `contracts/ui-contracts.md § 2`（含三段方法论 + GitHub + 公众号）。
- [x] **T012** [P] [US1] 创建 PC 引导区组件 `src/frontend/src/components/onboarding/onboarding-panel.tsx`，按 `contracts/ui-contracts.md § 3` 实现，从 `ONBOARDING_CARDS` 过滤当前角色 + `(platform === "pc" || "both")`。
- [x] **T013** [P] [US1] 创建切换角色确认弹窗 `src/frontend/src/components/onboarding/role-switch-confirm.tsx`，按 `contracts/ui-contracts.md § 6`。
- [x] **T014** [US1] 改造 PC 登录页 `src/frontend/src/app/login/page.tsx`：删除手动账号密码表单 → 渲染 `<HighlightsPanelPC>` + 双 `<RoleCard layout="pc" onSelect={login}>`。点卡片后调 `login(loginName, password)` → 成功跳 `/dashboard`。（依赖 T010, T011）
- [x] **T015** [US1] 改造 PC Dashboard `src/frontend/src/app/(authenticated)/dashboard/page.tsx`：在页面顶部插入 `<OnboardingPanel currentLoginName={loginName} />`，下方保留既有 Dashboard 内容。（依赖 T012, T013；prop 名按 auth-context 实际新增的 `loginName` 适配）
- [x] **T016** [US1] 改造 PC chat 组件 `src/frontend/src/components/chat/chat-sidebar.tsx`：抽出 `sendPrompt`，挂载 useEffect 消费 `sessionStorage.pending_prompt` + 监听 `onboarding:pending-prompt` 自定义事件，存在则自动展开面板并 send。（依赖 T012）
- [x] **T017** [US1] 在 `<OnboardingPanel>` 中实现卡片点击逻辑：demo 卡片 → 写 sessionStorage + dispatchEvent；switch-role 卡片 → 弹确认 → `quickSwitchRole`。（与 T012 同文件实现）

**Checkpoint US1**: PC 闭环可独立走通，对应 quickstart.md A 节全部 ✅。

---

## Phase 4: User Story 2 - 移动端访客试玩闭环（Priority: P1）

**Goal**: 移动端访客能完成"打开 → 一键登录 → 默认进 Chat → 看引导 → 点卡片"+ 金刚区切换基础。

**Independent Test**: 在 DevTools 切到移动视口，打开站点 → 自动跳 `/m/login` → 点角色卡 → 进 `/m/chat` 全屏 → 看到引导 → 点卡片收到 AI 回答 → 切金刚区任一 tab。

### Implementation for User Story 2

- [x] **T020** [P] [US2] 创建移动版项目亮点 `src/frontend/src/components/auth/highlights-panel-mobile.tsx`（精简版三段 + 公众号一行小字，无 GitHub），按 `contracts/ui-contracts.md § 2`。
- [x] **T021** [P] [US2] 创建移动引导卡片组件 `src/frontend/src/components/onboarding/onboarding-cards-mobile.tsx`，按 `contracts/ui-contracts.md § 4`，支持 `collapsed` prop。
- [x] **T022** [US2] 实现移动登录页 `src/frontend/src/app/m/login/page.tsx`：渲染 Hero + `<HighlightsPanelMobile>` + 双 `<RoleCard layout="mobile" onSelect={login}>`（垂直堆叠）。点卡片登录后跳 `/m/chat`。（依赖 T010, T020）
- [x] **T023** [US2] 创建移动全屏 Chat 容器 `src/frontend/src/components/mobile/chat-fullscreen.tsx`（仅基础版：消息列表 + 输入框 + 顶部 `<OnboardingCardsMobile collapsed={messages.length > 0}>`），暂不渲染 ChatFormCard——US3 再加。挂载时消费 `pending_prompt`。按 `contracts/ui-contracts.md § 8`。
- [x] **T024** [US2] 创建路由页面 `src/frontend/src/app/m/(mobile-app)/chat/page.tsx`：仅 `return <ChatFullscreen />`。
- [x] **T025** [P] [US2] 创建路由页面 `src/frontend/src/app/m/(mobile-app)/leads/page.tsx`：复用既有 Lead 列表组件。
- [x] **T026** [US2] ~~抽离 lead-list 组件~~ — 实际未抽离：直接 `import LeadsPage from '@/app/(authenticated)/leads/page'` 复用，符合 spec.md FR-029 + Assumption "可读不崩溃"最低保证策略。如未来移动端需要 fork 列表样式再考虑抽离。
- [x] **T027** [P] [US2] 创建路由页面 `src/frontend/src/app/m/(mobile-app)/customers/page.tsx`：复用既有 PC CustomersPage。
- [x] **T028** [P] [US2] 创建路由页面 `src/frontend/src/app/m/(mobile-app)/followups/page.tsx`：占位 + "去 AI 对话录入"CTA（spec assumption：跟进 detail 录入走 chat 内嵌卡片范式）。
- [x] **T029** [P] [US2] 创建路由页面 `src/frontend/src/app/m/(mobile-app)/me/page.tsx`：当前角色卡片 + 切换按钮（→ confirm → quickSwitchRole）+ 退出登录。
- [x] **T030** [US2] ~~完善 KingKongTabbar activeTab~~ — 已在 T007 创建时实现（`pathname === t.href` + chat 前缀匹配）。

**Checkpoint US2**: 移动端基础闭环可独立走通，对应 quickstart.md B1-B4 + B6 + B7 全部 ✅。US3 的 chat 内嵌卡片范式尚未实现，B5 暂留。

---

## Phase 5: User Story 3 - 移动端 Copilot 写类操作（Chat 内嵌卡片）（Priority: P1）

**Goal**: 移动端用户在 Chat 触发写类操作时，渲染 ChatFormCard + MobileFormSheet 范式，而非 PC 的 nav 按钮。

**Independent Test**: 在移动端 chat 输入"我今天拜访了赵鹏..." → 看到多张待确认卡片 → 点卡片弹抽屉 → 改字段 → 提交 → 卡片变 ✅ 已创建。

### Implementation for User Story 3

- [x] **T040** [US3] 抽离 `parseNavMarkers` 到 `src/frontend/src/lib/parse-nav-markers.ts`，chat-sidebar 改为 import。
- [x] **T041** [US3] **实现偏离**：未抽离 PC 表单组件给 sheet 复用。改用 `src/frontend/src/lib/parse-nav-url.ts` 直接产出 `submit: { path, buildBody }` 配置，sheet 渲染普通字段编辑 + 直接调对应 CRUD 端点。原因：① 移动端不需要 PC 表单的复杂校验 / 布局 ② 不污染 PC 既有表单页代码 ③ 覆盖核心 path（create-lead, log-followup），其他对象类型（keyevent, lead-action）显示"PC 端完成"提示 fallback。
- [x] **T042** [US3] 创建 ChatFormCard 组件 `src/frontend/src/components/mobile/chat-form-card.tsx`，按 `contracts/ui-contracts.md § 9` + `data-model.md § 2.1` 状态机渲染。
- [x] **T043** [US3] 创建 MobileFormSheet 组件 `src/frontend/src/components/mobile/mobile-form-sheet.tsx`，按 `contracts/ui-contracts.md § 10`，从 `parsed.submit` 配置走通用字段表单。
- [x] **T044** [US3] 在 `<ChatFullscreen>` 接入 ChatFormCard 渲染。**新发现并修复 bug**：sheet 必须渲染在 chat-fullscreen `position:fixed` div **外**——否则被父级 stacking context 困住，z-2000 也盖不过 z-800 的 tabbar，导致 sheet 内 submit 按钮无法点击。
- [x] **T045** [US3] sheet open/close + submit 流程已实现：openCardKey state 控制 + handleSheetClose 保存 lastValues + handleSheetSubmit 走 parsed.submit.path + buildBody，成功更新 submitted、失败更新 failed。
- [x] **T046** [US3] 多卡片状态独立：cardStates 用 `Record<cardKey, ChatFormCardState>` 存储，提交一张不影响其他。
- [x] **T047** [US3] 处理 chat 追加新对象：useEffect 监听 messages 变化，新发现的 nav 标记追加到 cardStates；已存在的 cardKey 不覆盖。

**Checkpoint US3**: 对应 quickstart.md B5 全部 ✅。

---

## Phase 6: User Story 4 - PC Copilot 兼容性保留（Priority: P2）

**Goal**: 验证移动端改造后 PC Copilot 行为零回归。本 phase **大部分是回归走查**，无新增代码，除非走查发现回归。

**Independent Test**: PC 浏览器以 sales01 登录 → chat 输入"我今天拜访了赵鹏..." → 仍是 nav 按钮 + 跳转表单页预填，与改造前一致。

### Implementation for User Story 4

- [x] **T060** [US4] 写 us4-pc-copilot-compat.spec.ts e2e 测试：mock chat 返回 nav 标记 → 验证 PC chat 渲染跳转按钮（不是 ChatFormCard）+ 不渲染 mobile-form-sheet + 点击跳转到 /leads/new + sessionStorage prefill 写入。2/2 通过。
- [x] **T061** [US4] 由 T060 e2e 测试覆盖核心兼容性。8 个 demo case 的人工走查留待启动后跑。
- [x] **T062** [US4] 未发现回归，无修复。

**Checkpoint US4**: PC 100% 兼容性确认。

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 影响所有 story 的横切优化和最终 QA。

- [ ] **T080** [P] 视觉打磨：根据真机走查（PC + 移动）调整 `<RoleCard>` / `<HighlightsPanelPC>` / `<OnboardingPanel>` / `<KingKongTabbar>` 的边距、字号、色彩对比度。
- [ ] **T081** [P] 移动端安全区适配（iPhone 底部刘海）：金刚区 + 全屏 chat 输入框使用 `env(safe-area-inset-bottom)`。
- [ ] **T082** [P] 极小屏（320px）适配：登录页双卡 + 金刚区 5 tab 在 320px 不溢出。
- [ ] **T083** [P] 横屏不崩溃 fallback：移动横屏时金刚区位置不错位（最低保证视觉不破，无需横屏专门优化）。
- [ ] **T084** AI 预填字段缺失场景：在 `<MobileFormSheet>` 中识别必填字段为空 → 红色边框提示 + 阻止 submit。
- [ ] **T085** 跨端切换体验：PC 视口登录 → 切到移动视口 → 自动跳 `/m/chat`（保持 token），反向同样。验证 `(authenticated)/layout.tsx` 重定向 + `m/(mobile-app)/layout.tsx` 鉴权门联动。
- [ ] **T086** 最终文案核对：登录页 / 引导卡片 / 弹窗 / 抽屉等所有用户可见文案与 `inputs/alignment.md` 一致；公众号一律为「pmYangKun」；引导卡片 prompt 中"一句话搞定多个动作"已是"帮我把客户、联系人、跟进都录进去"。
- [ ] **T999** 回归既有测试：`cd src/backend && pytest`，确保 100% 通过。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 无依赖，立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1（用到 `useIsMobile` 和 `auth-context.quickSwitchRole`），完成后**移动端 user story 全部解锁**；US1（PC）可与 Phase 2 并行
- **US1 (Phase 3)**: 依赖 Phase 1（不依赖 Phase 2 的移动 layout）
- **US2 (Phase 4)**: 依赖 Phase 2（需要 `<MobileShell>` 和 `<KingKongTabbar>`）
- **US3 (Phase 5)**: 依赖 US2 完成（在 `<ChatFullscreen>` 上扩展）
- **US4 (Phase 6)**: 依赖 US1 + US3 完成（需要验证 PC 不被任何前序改动破坏）
- **Polish (Phase 7)**: 依赖以上全部完成

### Within Each User Story

- 配置 / 工具 hook → 共用组件 → 路由页面 → 串联

### Parallel Opportunities

- **Phase 1**：T001 / T002 / T003 三个 [P] 任务并行
- **Phase 2**：T005 / T006 / T007 [P] 并行（T004 单独，因为它直接动既有 layout 文件）
- **US1**：T010 / T011 / T012 / T013 四个 [P] 组件可并行；T014 / T015 / T016 / T017 串行
- **US2**：T020 / T021 [P] 并行；T025 / T027 / T028 / T029 [P] 并行
- **Polish**：T080 / T081 / T082 / T083 [P] 并行

---

## Implementation Strategy

### MVP First — User Story 1（PC 闭环）

1. ✅ 完成 Phase 1（Setup）
2. ✅ 完成 Phase 3（US1）
3. **STOP & VALIDATE**：用 PC 浏览器跑 quickstart.md A 节，全部 ✅ 视为 MVP 达成
4. 此时已可演示"PC 端 Native AI CRM"，不影响发布

### Incremental Delivery

1. MVP（US1）→ 演示 PC 端 ✅
2. + Phase 2 + US2 → 演示移动端基础闭环 ✅
3. + US3 → 演示移动端 Copilot Chat 内嵌卡片 ✅（这是项目最大亮点）
4. + US4 + Polish → 完整发版

### 单人执行节奏（推荐）

- **Day 1**：Phase 1 + Phase 2 + US1 → 收 PC 闭环
- **Day 2**：US2 → 收移动端骨架闭环
- **Day 3**：US3 → 收 Chat 内嵌卡片范式
- **Day 4**：US4 走查 + Polish + 跑 quickstart.md 全节验收

---

## Notes

- [P] 任务=不同文件、无依赖
- [Story] 标签便于追溯
- 每张卡片改完立即在浏览器看一眼，**不要积攒 5 个 task 一起跑**
- `quickstart.md` 是最终验收圣经，每完成一个 phase 立即跑对应章节
- 不要为了"完成感"绕过未完成的 checkpoint
- PC 视口下任何回归都是 P0 必修
