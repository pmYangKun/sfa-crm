# UI Contracts: 前端组件输入输出契约

**Feature**: `001-login-mobile-onboarding`
**Date**: 2026-05-03

本文件定义本 feature 新增/改动组件的 props、回调、关键状态契约。实现层不得偏离这些契约——契约改动需先回 spec.md / data-model.md 同步。

---

## 1. `<RoleCard>` （PC + 移动共用）

**Path**: `src/frontend/src/components/auth/role-card.tsx`

```ts
interface RoleCardProps {
  /** 来自 ROLE_CARDS 配置 */
  role: RoleCard;
  /** 卡片布局模式：pc = 横向并列卡 / mobile = 垂直堆叠卡 */
  layout: "pc" | "mobile";
  /** 一键登录回调 */
  onSelect: (loginName: string, password: string) => Promise<void>;
  /** 是否处于登录中（外层透传，禁用点击） */
  busy?: boolean;
}
```

**渲染契约**：
- 必含元素：`displayName` + 描述（`description` 或 `descriptionMobile`，按 layout）+ "一键登录"按钮
- 整张卡片可点击（不只按钮区）
- `busy === true` 时卡片半透明 + 不响应点击 + 显示 spinner
- `accentColor` 用作卡片左边框或顶部色条
- **不暴露**账号/密码输入框

---

## 2. `<HighlightsPanelPC>` / `<HighlightsPanelMobile>`

**Path**:
- `src/frontend/src/components/auth/highlights-panel-pc.tsx`
- `src/frontend/src/components/auth/highlights-panel-mobile.tsx`

```ts
// PC 版无 props，内容内嵌
interface HighlightsPanelPCProps {}

// 移动版同样无 props
interface HighlightsPanelMobileProps {}
```

**渲染契约（PC 版）**：
- 顶部 1 行点题："这不是一次玩具实验，是一场对传统软件工程的正面挑战。"
- 三段方法论，每段：emoji 图标 + 加粗标题 + 1-3 行说明
  1. 🎬 VibeCoding × Spec Coding（含 14 Phase / 132 commit 数字）
  2. 🧬 Palantir Ontology 落地
  3. 🤝 Copilot 人机协同
- 底部："GitHub 源码: github.com/pmYangKun/sfa-crm" + "系列文章: 公众号「pmYangKun」搜 \"VibeCoding\""

**渲染契约（移动版）**：
- 三段每段 1 行核心句 + emoji
- 底部仅 "公众号「pmYangKun」全程记录"
- **不含** GitHub 链接

---

## 3. `<OnboardingPanel>` （PC Dashboard 顶部引导区）

**Path**: `src/frontend/src/components/onboarding/onboarding-panel.tsx`

```ts
interface OnboardingPanelProps {
  /** 当前用户的 loginName，用于过滤 ONBOARDING_CARDS */
  currentRole: "sales01" | "manager01";
}
```

**渲染契约**：
- 顶部欢迎语："你好，{currentRole 显示名}！试试下面的演示问题："
- 卡片网格：基于 `ONBOARDING_CARDS` 过滤 `role === currentRole && (platform === "pc" || platform === "both")`，按数组顺序渲染
- 单张卡片：见 `<OnboardingCard>` 契约
- 对 type="switch-role" 卡片：点击 → 弹 `<RoleSwitchConfirm>` → 确认后 `quickSwitchRole`
- 对 type="demo" 卡片：点击 → `sessionStorage.setItem("pending_prompt", fullPrompt)` → 触发 chat 容器消费

---

## 4. `<OnboardingCardsMobile>`

**Path**: `src/frontend/src/components/onboarding/onboarding-cards-mobile.tsx`

```ts
interface OnboardingCardsMobileProps {
  currentRole: "sales01" | "manager01";
  /** 是否折叠（chat 已有消息时折叠隐藏） */
  collapsed?: boolean;
}
```

**渲染契约**：
- `collapsed === true` → 不渲染（或高度 0）
- `collapsed === false` → 渲染竖向卡片列表，过滤规则同 PC
- 卡片样式更紧凑（无网格，竖向 stack）

---

## 5. `<OnboardingCard>` （单张引导卡，PC + 移动共用）

**Path**: 内嵌于 `onboarding-panel.tsx` 或抽为独立小组件

```ts
interface OnboardingCardProps {
  card: OnboardingCard;
  onClick: () => void;
  variant: "pc" | "mobile";
}
```

**渲染契约**：
- 卡片头：`shortTitle`（含 emoji）
- 卡片体（仅 type="demo"）：`fullPrompt` 全文预览（不省略号截断，让访客看到完整问题）
- 卡片底部按钮："试试看 →"（demo 类）/ "切换 →"（switch-role 类）
- 整张卡片可点击

---

## 6. `<RoleSwitchConfirm>` （切换角色确认弹窗）

**Path**: `src/frontend/src/components/onboarding/role-switch-confirm.tsx`

```ts
interface RoleSwitchConfirmProps {
  open: boolean;
  fromRole: "sales01" | "manager01";
  toRole: "sales01" | "manager01";
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}
```

**渲染契约**：
- 弹窗标题："切换到 [toRole 显示名]？"
- 正文："当前对话和未保存内容将清空。"
- 按钮：[取消] [确认切换]
- 确认后 → 调 `onConfirm` → 父组件触发 `quickSwitchRole(toRole)` → 切换中显示 loading

---

## 7. `<KingKongTabbar>` （移动金刚区底部导航）

**Path**: `src/frontend/src/components/mobile/kingkong-tabbar.tsx`

```ts
interface KingKongTabbarProps {
  /** 当前激活 tab id */
  activeTab: "leads" | "customers" | "chat" | "followups" | "me";
}
```

**渲染契约**：
- 固定在 viewport 底部（`position: fixed; bottom: 0`），高度 ≥ 56px，安全区适配 (iPhone 底部刘海)
- 5 个 tab 等宽分布，中间💬 tab 视觉**凸起**：
  - 圆形浮起按钮，向上突出 ≈ 16-20px
  - 比其他 tab 视觉权重明显大
- 点击任一 tab → `router.push(href)`
- 当前 active tab 高亮

---

## 8. `<ChatFullscreen>` （移动端全屏 Chat 容器）

**Path**: `src/frontend/src/components/mobile/chat-fullscreen.tsx`

```ts
interface ChatFullscreenProps {
  // 自管理
}
```

**渲染契约**：
- 全屏布局：顶部 header（角色名 / 退出快捷）+ 中间消息流 + 底部输入框
- 无消息态：消息流位置渲染 `<OnboardingCardsMobile>`
- 有消息态：渲染消息列表
- 消息中如果包含 `[[nav:label|url]]` 标记或后端返回的 `action: "navigate"` 结构化结果 → 渲染 `<ChatFormCard>`（**不渲染** PC 的 nav 按钮）
- 输入框 + 发送按钮固定底部，避开金刚区高度
- 挂载时检查 `sessionStorage.getItem("pending_prompt")`，存在则自动 send 并 `removeItem`

---

## 9. `<ChatFormCard>` （chat 内嵌待确认卡）

**Path**: `src/frontend/src/components/mobile/chat-form-card.tsx`

```ts
interface ChatFormCardProps {
  state: ChatFormCardState;       // 见 data-model.md 2.1
  onClick: () => void;            // 用户点卡片 → 父组件打开 sheet
}
```

**渲染契约**：
- 卡片头：对象类型徽章（如 "新建线索 / 录入跟进 / 关键事件"）+ 状态徽章
- 卡片体：关键字段预览（≥ 2 个，从 `state.prefill` 取最有信息量的字段）
- 卡片底（按状态变化）：
  - `pending`: "点击审核 →"
  - `editing`: 暗灰，"正在编辑..."
  - `submitting`: "提交中..." + spinner
  - `submitted`: "✅ 已创建" + ID 链接
  - `failed`: "❌ {errorMsg}" + "重试 →"
- 仅 `pending` / `failed` 状态可点

---

## 10. `<MobileFormSheet>` （底部抽屉表单）

**Path**: `src/frontend/src/components/mobile/mobile-form-sheet.tsx`

```ts
interface MobileFormSheetProps {
  open: boolean;
  card: ChatFormCardState;
  onClose: () => void;            // 用户滑下关闭 / 点 X
  onSubmit: (formData: Record<string, unknown>) => Promise<{ id: string }>;
}
```

**渲染契约**：
- 从屏幕底部上滑出现，高度 ≥ 70vh，顶部有抓手栏
- 内部根据 `card.objectType` 动态挂载对应表单组件（参见 Decision 7 中的抽离策略）
- AI 预填值通过 `card.prefill` 传入，已填好的字段视觉不强调"AI 填的"，让用户自然修改
- 底部固定"确认提交"按钮（`onSubmit`）
- 抽屉关闭（向下滑 / X）→ 调 `onClose`，**不丢失**当前编辑中的 form values（父组件保留 `state.prefill` 的最新版本）

---

## 11. `<ChatSidebar>` （现有 PC chat 组件 — 改造点）

**Path**: `src/frontend/src/components/chat/chat-sidebar.tsx`（既有，改造）

**改造契约**：
- **行为不变**：所有现有逻辑（parseNavMarkers / handleNavigate / sessionStorage("copilot_prefill") 写入 / sessionStorage("pending_prompt") **新增读取**）保持
- **仅新增**：挂载时读取 `sessionStorage.getItem("pending_prompt")`，存在则自动 send（与 ChatFullscreen 行为一致）
- **不在 PC 视口下渲染** `<ChatFormCard>`

---

## 12. `<AuthContext>` 改造点

**Path**: `src/frontend/src/lib/auth-context.tsx`（既有，改造）

**新增方法**：

```ts
/** 一键切换角色：内部 = logout + login，全程一次往返，UI 不退到登录页 */
quickSwitchRole(targetLogin: string, targetPassword: string): Promise<void>;
```

**契约**：
- 调 `logout()` 清当前 token / user state
- 立即调 `login(targetLogin, targetPassword)`
- **不**触发 router 重定向到 `/login`（既有 logout 默认行为可能会，需要检查 / 加 `silent` flag）
- 切换成功后 router 跳到目标平台对应的登录后首页（PC = `/dashboard`，移动 = `/m/chat`）
- 失败 → 抛错给调用方，UI 决定是否回退到登录页
- 全流程 ≤ 3 秒（SC-006）

---

## 13. `<MobileShell>` （`/m/(mobile-app)/layout.tsx`）

**渲染契约**：
- 鉴权门：未登录 → `router.replace("/m/login")`
- 顶部：极简 header（角色名 + 极小 logo），可选
- 中间：`{children}` 渲染各 tab 页面
- 底部：`<KingKongTabbar activeTab={当前 tab id} />`
- 中间内容区高度 = `100vh - tabbar 高度`，避免内容被遮挡

**反向重定向（移动 → PC）**：
- 在最早 effect 中检测 `useIsMobile()`，如果是 false（即当前在 PC 视口） → `router.replace(MOBILE_TO_PC_MAP[pathname] || "/dashboard")`，并把 query string 透传
- 映射表 `MOBILE_TO_PC_MAP`（与 § 14 的 PC→移动映射对称）：

  | 移动路径 | PC 路径 | 备注 |
  |----------|---------|------|
  | `/m/login` | `/login` | 登录页 |
  | `/m/chat` | `/dashboard` | 移动默认 chat 全屏 → PC 默认 dashboard（PC 的 chat 是右侧栏，本身就常驻） |
  | `/m/leads` | `/leads` | 直接对应 |
  | `/m/customers` | `/customers` | 直接对应 |
  | `/m/followups` | `/dashboard` | PC 没有独立的"跟进流"页（跟进通过 lead 详情进入），兜底回 dashboard |
  | `/m/me` | `/dashboard` | PC 没有"我的"页（账号信息在侧栏底部 / 退出在侧栏），兜底回 dashboard |

- query string 必须保留（如 `/m/leads?id=xxx&_t=123` → `/leads?id=xxx&_t=123`）
- `_t` 时间戳参数原样透传（PC 表单页依赖它强制 re-mount）

---

## 14. PC `(authenticated)/layout.tsx` 改造点

**改造契约**：
- 在最早 effect 中检测 `useIsMobile()`，如果是 true → `router.replace(PC_TO_MOBILE_MAP[pathname] || "/m/chat")`，并把 query string 透传
- 映射表 `PC_TO_MOBILE_MAP`：

  | PC 路径 | 移动路径 | 备注 |
  |---------|----------|------|
  | `/dashboard` | `/m/chat` | PC dashboard 上的引导卡 → 移动端在 chat 全屏顶部展示 |
  | `/leads` | `/m/leads` | 直接对应 |
  | `/leads/new` | `/m/chat` | 移动端用 chat 内嵌卡片范式录入，无独立"新建"路由 |
  | `/leads/[id]` | `/m/chat` | 移动端用 chat 内嵌卡片范式编辑（本期不深度支持深链编辑），兜底回 chat |
  | `/leads/team` | `/m/leads` | 移动端用一个 lead 列表 tab 兜底（不区分 team / 自己） |
  | `/customers` | `/m/customers` | 直接对应 |
  | `/customers/[id]` | `/m/customers` | 同 lead 详情兜底逻辑 |
  | `/admin/*` | `/m/me` | 移动端不支持 admin 模块（spec.md 范围排除），兜底"我的" |
  | `/public-pool` | `/m/leads` | 移动端不专门做公共池页面（本期范围排除） |
  | `/reports` / `/reports/team` | `/m/chat` | 移动端没有独立报表页，兜底 chat（用户可问 AI 拿报表） |

- query string 必须保留
- 任何**未列出**的 PC 路径 → 兜底 `/m/chat`

**重要约束（防循环重定向）**：
- 每次 `router.replace` 后，目标 layout 的 effect 也会触发；为防双向乒乓，在 `/m/...` 跳到 `/...` 之后，PC layout 的 useIsMobile 必须返回 false（视口确实是 PC），否则会立即被跳回。useIsMobile 的判定基于 `window.matchMedia` 的实时值，跨视口切换时浏览器 resize 事件会先触发，确保 hook 返回值与 URL 同步，不会产生循环。
- 如未来发现循环：在 useIsMobile 加 debounce 100ms。
- PC 视口下行为 100% 不变
