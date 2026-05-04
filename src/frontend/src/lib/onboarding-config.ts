/**
 * 引导卡片 + 角色卡片配置（单一信源）
 * 详细数据结构见 specs/001-login-mobile-onboarding/data-model.md § 1
 */

export interface RoleCard {
  /** 后端登录账号名 */
  loginName: string;
  /** demo 默认密码（前端硬编码 — 仅 demo 用，UX 版可接受） */
  password: string;
  /** 角色显示名 */
  displayName: string;
  /** 卡片角色描述（PC，2-3 行） */
  description: string;
  /** 移动端简短副本 */
  descriptionMobile: string;
  /** 卡片视觉强调色 */
  accentColor: string;
}

export const ROLE_CARDS: RoleCard[] = [
  {
    loginName: 'sales01',
    password: '12345',
    displayName: '销售·王小明',
    description: '一线销售视角：用 Chat 跟进客户、查询线索、自动预填表单',
    descriptionMobile: '一线销售视角',
    accentColor: '#1890ff',
  },
  {
    loginName: 'manager01',
    password: '12345',
    displayName: '销售经理·陈队长',
    description: '管理视角：问一句"谁在偷懒"，AI 帮你看清团队跟进节奏',
    descriptionMobile: '管理视角',
    accentColor: '#722ed1',
  },
];

export type OnboardingCardType = 'demo' | 'switch-role';
export type Platform = 'pc' | 'mobile' | 'both';

export interface OnboardingCard {
  /** 唯一 ID */
  id: string;
  /** 所属角色 */
  role: 'sales01' | 'manager01';
  /** 平台支持 */
  platform: Platform;
  /** 卡片类型 */
  type: OnboardingCardType;
  /** 短标题（含 emoji） */
  shortTitle: string;
  /** 完整问题预览（type === "demo" 时必填，点击后真实发到 chat） */
  fullPrompt?: string;
  /** 切换目标账号（type === "switch-role" 时必填） */
  switchTo?: 'sales01' | 'manager01';
  /** 对应 demo case 编号（溯源 src/demo/copilot-cases.md） */
  caseRef?: string;
}

export const ONBOARDING_CARDS: OnboardingCard[] = [
  // sales01
  {
    id: 's01-1',
    role: 'sales01',
    platform: 'both',
    type: 'demo',
    shortTitle: '🔍 自然语言查线索',
    fullPrompt: '帮我看看华南那边的线索有哪些',
    caseRef: '案例 1',
  },
  {
    id: 's01-2',
    role: 'sales01',
    platform: 'both',
    type: 'demo',
    shortTitle: '⚡ 一句话搞定多个动作',
    fullPrompt:
      '我今天拜访了深圳前海微链的赵鹏，聊了合作方案，对方很感兴趣。帮我把客户、联系人、跟进都录进去。',
    caseRef: '案例 3',
  },
  {
    id: 's01-3',
    role: 'sales01',
    platform: 'both',
    type: 'demo',
    shortTitle: '🧠 让 AI 给我跟进策略',
    fullPrompt: '北京数字颗粒科技最近情况怎么样？我该怎么跟？',
    caseRef: '案例 4',
  },
  {
    id: 's01-4',
    role: 'sales01',
    platform: 'both',
    type: 'switch-role',
    shortTitle: '💡 想看队长视角？切换 manager01',
    switchTo: 'manager01',
  },

  // manager01
  {
    id: 'm01-1',
    role: 'manager01',
    platform: 'both',
    type: 'demo',
    shortTitle: '🚨 谁在偷懒？AI 一眼看穿',
    fullPrompt: '帮我看看最近团队里哪个销售跟进最不积极？有没有线索快要被自动释放的？',
    caseRef: '案例 6',
  },
  {
    id: 'm01-2',
    role: 'manager01',
    platform: 'both',
    type: 'demo',
    shortTitle: '🔬 评估具体线索跟进情况',
    fullPrompt: '北京华信恒通最近跟得怎么样？',
    caseRef: '案例 8',
  },
  {
    id: 'm01-3',
    role: 'manager01',
    platform: 'both',
    type: 'switch-role',
    shortTitle: '💡 想看销售视角？切换 sales01',
    switchTo: 'sales01',
  },
];

/** 根据 loginName 找到对应 RoleCard */
export function getRoleCardByLogin(loginName: string): RoleCard | undefined {
  return ROLE_CARDS.find((r) => r.loginName === loginName);
}

/** 当前用户的引导卡片清单（按平台过滤） */
export function getOnboardingCardsForRole(
  loginName: string,
  platform: 'pc' | 'mobile',
): OnboardingCard[] {
  if (loginName !== 'sales01' && loginName !== 'manager01') return [];
  return ONBOARDING_CARDS.filter(
    (c) => c.role === loginName && (c.platform === platform || c.platform === 'both'),
  );
}
