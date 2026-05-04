# Data Model: 登录页改造 + 移动端 + Onboarding（UX 版）

**Feature**: `001-login-mobile-onboarding`
**Date**: 2026-05-03
**Phase**: 1 — Design & Contracts

> **重要约束**：本 feature **不动后端 SQLModel / 数据库 schema**。下述"实体"全部是**前端配置数据 + 客户端状态**，不进数据库，不影响既有 Ontology。

---

## 1. 配置型实体（前端常量）

### 1.1 RoleCard（角色卡片配置）

存放位置：`src/frontend/src/lib/onboarding-config.ts` 中 `ROLE_CARDS` 常量。

```ts
export interface RoleCard {
  /** 后端登录账号名 */
  loginName: string;        // "sales01" | "manager01"
  /** demo 默认密码（前端硬编码 — 仅 demo 用，UX 版可接受） */
  password: string;         // "12345"
  /** 角色显示名 */
  displayName: string;      // "销售·王小明" / "销售经理·陈队长"
  /** 卡片角色描述（卡片副本，2-3 行） */
  description: string;
  /** 移动端简短副本（展示空间更小） */
  descriptionMobile: string;
  /** 卡片视觉强调色（CSS color） */
  accentColor?: string;
}

export const ROLE_CARDS: RoleCard[] = [
  {
    loginName: "sales01",
    password: "12345",
    displayName: "销售·王小明",
    description: "一线销售视角：用 Chat 跟进客户、查询线索、自动预填表单",
    descriptionMobile: "一线销售视角",
    accentColor: "#1890ff",
  },
  {
    loginName: "manager01",
    password: "12345",
    displayName: "销售经理·陈队长",
    description: "管理视角：问一句\"谁在偷懒\"，AI 帮你看清团队跟进节奏",
    descriptionMobile: "管理视角",
    accentColor: "#722ed1",
  },
];
```

**Validation Rules**:
- `loginName` 必须存在于后端 demo seed 中
- `password` 与后端 seed 一致
- 顺序敏感：数组顺序即登录页展示顺序

---

### 1.2 OnboardingCard（引导卡片配置）

存放位置：同上 `lib/onboarding-config.ts` 中 `ONBOARDING_CARDS` 常量。

```ts
export type OnboardingCardType = "demo" | "switch-role";
export type Platform = "pc" | "mobile" | "both";

export interface OnboardingCard {
  /** 唯一 ID（用于去重 / sessionStorage key） */
  id: string;
  /** 所属角色 */
  role: "sales01" | "manager01";
  /** 平台支持 */
  platform: Platform;
  /** 卡片类型 */
  type: OnboardingCardType;
  /** 短标题（含 emoji），用于卡片头 */
  shortTitle: string;
  /** 完整问题预览 = 点击后真实发到 chat 的 prompt（type === "demo" 时必填） */
  fullPrompt?: string;
  /** 切换目标账号（type === "switch-role" 时必填） */
  switchTo?: "sales01" | "manager01";
  /** 对应 demo case 编号（type === "demo" 时填，溯源 demo/copilot-cases.md） */
  caseRef?: string;
}

export const ONBOARDING_CARDS: OnboardingCard[] = [
  // sales01
  { id: "s01-1", role: "sales01", platform: "both", type: "demo",
    shortTitle: "🔍 自然语言查线索",
    fullPrompt: "帮我看看华南那边的线索有哪些",
    caseRef: "案例 1" },
  { id: "s01-2", role: "sales01", platform: "both", type: "demo",
    shortTitle: "⚡ 一句话搞定多个动作",
    fullPrompt: "我今天拜访了深圳前海微链的赵鹏，聊了合作方案，对方很感兴趣。帮我把客户、联系人、跟进都录进去。",
    caseRef: "案例 3" },
  { id: "s01-3", role: "sales01", platform: "both", type: "demo",
    shortTitle: "🧠 让 AI 给我跟进策略",
    fullPrompt: "北京数字颗粒科技最近情况怎么样？我该怎么跟？",
    caseRef: "案例 4" },
  { id: "s01-4", role: "sales01", platform: "both", type: "switch-role",
    shortTitle: "💡 想看队长视角？切换 manager01",
    switchTo: "manager01" },

  // manager01
  { id: "m01-1", role: "manager01", platform: "both", type: "demo",
    shortTitle: "🚨 谁在偷懒？AI 一眼看穿",
    fullPrompt: "帮我看看最近团队里哪个销售跟进最不积极？有没有线索快要被自动释放的？",
    caseRef: "案例 6" },
  { id: "m01-2", role: "manager01", platform: "both", type: "demo",
    shortTitle: "🔬 评估具体线索跟进情况",
    fullPrompt: "北京华信恒通最近跟得怎么样？",
    caseRef: "案例 8" },
  { id: "m01-3", role: "manager01", platform: "both", type: "switch-role",
    shortTitle: "💡 想看销售视角？切换 sales01",
    switchTo: "sales01" },
];
```

**Validation Rules**:
- `id` 全局唯一
- `type === "demo"` → 必须有 `fullPrompt`，应有 `caseRef`
- `type === "switch-role"` → 必须有 `switchTo`，且 `switchTo !== role`
- `platform === "both"` 是默认；若上线后裁剪，把对应卡片改成 `"pc"` 或 `"mobile"` 即可（无需删除）
- `fullPrompt` 必须使用具体对象名（避免"该做的都做了"这类行话——见 input doc 文案原则）

---

### 1.3 KingKongTab（金刚区 tab 配置）

存放位置：`src/frontend/src/components/mobile/kingkong-tabbar.tsx` 内常量 `TABS`。

```ts
interface KingKongTab {
  id: "leads" | "customers" | "chat" | "followups" | "me";
  icon: string;            // emoji 或 SVG path
  label: string;
  href: string;            // 移动端路由路径，如 "/m/leads"
  raised: boolean;         // 是否凸起（仅 chat = true）
}

const TABS: KingKongTab[] = [
  { id: "leads",     icon: "📋", label: "线索",     href: "/m/leads",     raised: false },
  { id: "customers", icon: "🏢", label: "客户",     href: "/m/customers", raised: false },
  { id: "chat",      icon: "💬", label: "AI",       href: "/m/chat",      raised: true  },
  { id: "followups", icon: "📝", label: "跟进",     href: "/m/followups", raised: false },
  { id: "me",        icon: "👤", label: "我的",     href: "/m/me",        raised: false },
];
```

---

## 2. 客户端状态实体（仅运行时存在）

### 2.1 ChatFormCard 状态机（移动端 Chat 内嵌待确认卡）

```ts
type ChatFormCardStatus = "pending" | "editing" | "submitting" | "submitted" | "failed";

interface ChatFormCardState {
  /** 在 chat 流中的位置（用消息 ID + 卡片在该消息中的索引） */
  cardKey: string;
  /** 对象类型 — 由 navigate URL 路径推断 */
  objectType: "lead" | "lead-followup" | "lead-keyevent" | "lead-action";
  /** 卡片标题（来自后端 navigate.label） */
  title: string;
  /** AI 预填字段（解析自 navigate URL query string） */
  prefill: Record<string, string>;
  /** 目标 URL（PC 模式下点 nav 按钮的跳转 URL） */
  targetUrl: string;
  /** 当前状态 */
  status: ChatFormCardStatus;
  /** 提交后的对象 ID（仅 submitted） */
  createdId?: string;
  /** 错误信息（仅 failed） */
  errorMsg?: string;
}
```

**状态转换图**：

```text
pending  ──点击卡片──▶  editing  ──点抽屉确认──▶  submitting
   ▲                       │                          │
   │                       │                          ├── 成功 ──▶ submitted（终态）
   │                       │                          │
   │                       └─滑下/关闭抽屉─▶ pending  └── 失败 ──▶ failed
   │                                                              │
   └────────点卡片重试──────────────────────────────────────────────┘
```

**状态归属**：每张 ChatFormCard 状态独立保存在前端 `<ChatFullscreen>` 组件的 `useState<Map<cardKey, ChatFormCardState>>` 中，不跨会话持久化（用户离开 chat 全屏再回来，状态丢失视为正常 demo 行为）。

---

## 3. 既有数据约定（不改，但本 feature 依赖）

### 3.1 Demo 账号 Seed

后端在初始化时插入的固定账号（来自既有 `data-model.md` 和 seed 脚本）：

| loginName | 显示名 | 角色 | 密码（demo） |
|-----------|--------|------|--------------|
| admin     | 管理员 | admin | 12345 |
| sales01   | 王小明 | sales | 12345 |
| sales02   | 李销售 | sales | 12345 |
| sales03   | 王销售 | sales | 12345 |
| manager01 | 陈队长 | manager | 12345 |

**本 feature 仅用 sales01 / manager01**。其他账号本期不在登录页暴露。

### 3.2 sessionStorage 键

| Key | 用途 | 写入方 | 读取方 |
|-----|------|--------|--------|
| `copilot_prefill` | PC chat 触发 navigate 时携带的 query 字符串，作为表单页预填来源 | `chat-sidebar.tsx`（既有） | `/leads/[id]/page.tsx` 等表单页（既有） |
| `pending_prompt`（**新增**） | 引导卡片点击后欲发到 chat 的 prompt；chat 容器加载时读取并自动 send | `OnboardingPanel` / `OnboardingCardsMobile`（新增） | `<ChatSidebar>`（PC，改造）/ `<ChatFullscreen>`（移动，新建） |

**Validation Rules（新 key）**：
- 写入时立即 set，不等用户操作
- chat 容器在 `useEffect` 首次挂载时读取并 `removeItem`（一次性消费）
- 如果 chat 容器已经挂载且收到新写入，需要主动监听 storage event 或自定义 event

---

## 4. 实体关系总图

```text
┌─────────────────┐
│  RoleCard 配置  │
│  (常量数组)      │
└────────┬────────┘
         │ 在登录页遍历渲染
         ▼
┌─────────────────────────┐
│  登录页(PC + 移动)        │
│  - 点击 → quickSwitchRole│
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────┐         ┌─────────────────────────┐
│  AuthContext             │◀────────│  OnboardingCard 配置     │
│  (login / quickSwitch)   │         │  (常量数组)              │
└────────┬─────────────────┘         └────────┬────────────────┘
         │ 登录后跳转                          │ 在 OnboardingPanel /
         ▼                                    │  OnboardingCardsMobile
┌──────────────────┐                         │  渲染并按 role/platform 过滤
│  PC: Dashboard    │◀────────────────────────┤
│  移动: /m/chat    │◀────────────────────────┘
└────────┬─────────┘
         │ 用户在 chat 触发 navigate tool
         ▼
┌──────────────────────────────────────────┐
│  PC chat-sidebar: 渲染 nav button         │
│  移动 chat-fullscreen: 渲染 ChatFormCard  │
└────────┬─────────────────────────────────┘
         │ 移动卡片点击
         ▼
┌──────────────────┐
│  MobileFormSheet  │
│  + 既有 LeadForm  │
└────────┬─────────┘
         │ 提交
         ▼
┌──────────────────┐
│  既有 CRUD API    │
└──────────────────┘
```
