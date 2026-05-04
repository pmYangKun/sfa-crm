import { test, expect, Page } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 移动端 8 个 copilot case 全量回归（用户 2026-05-04 升级为刚性必跑）
 *
 * 与 pc-copilot-cases-regression 对位：相同 prompt 集，移动端 UI 路径。
 *  1. /m/login 登录
 *  2. 进 /m/chat 全屏 chat-fullscreen
 *  3. 输入框打 prompt 提交
 *  4. 断言 assistant textContent.length > 5
 *  5. 案例 3、5 额外断言 chat 卡片（ChatFormCard）出现 — 移动端写入类 prompt 应渲染卡片而非按钮
 */

interface Case {
  id: number | string;
  desc: string;
  login: 'sales01' | 'manager01';
  prompt: string;
  expectCard?: boolean;
  /** 反向断言：assistant 不能出现的话术（防 AI 幻觉「已创建」） */
  forbidPhrases?: string[];
}

const CASES: Case[] = [
  { id: 1, desc: '自然语言查线索', login: 'sales01', prompt: '帮我看看华南那边的线索有哪些' },
  { id: 2, desc: '跨对象关联（线索 + 联系人）', login: 'sales01', prompt: '深圳前海微链的详细信息帮我看看，联系人都有谁' },
  { id: 3, desc: '一句话多步操作 + 表单预填（核心）', login: 'sales01', prompt: '我今天拜访了深圳前海微链的赵鹏，聊了合作方案，对方很感兴趣。帮我把该做的都做了。', expectCard: true },
  { id: 4, desc: 'AI 洞察策略建议', login: 'sales01', prompt: '北京数字颗粒科技最近情况怎么样？我该怎么跟？' },
  { id: 5, desc: '转化决策', login: 'sales01', prompt: '天津智联云的小课款已经到了，帮我走转化流程', expectCard: true },
  { id: 6, desc: '管理者：谁在偷懒', login: 'manager01', prompt: '帮我看看最近团队里哪个销售跟进最不积极？有没有线索快要被自动释放的？' },
  { id: 7, desc: '数据权限：同工具不同视野', login: 'manager01', prompt: '帮我看看我们团队现在有哪些线索' },
  { id: 8, desc: '队长评估具体线索', login: 'manager01', prompt: '北京华信恒通最近跟得怎么样？' },
  // 创建类 case：AI 不允许说「已创建」，且必须出 navigate_create_lead 的卡片
  {
    id: '9-create',
    desc: '新建线索（HITL 边界）',
    login: 'sales01',
    prompt: '我新建一个华东区的线索：大兴置业有限公司',
    expectCard: true,
    // 只禁过去时「已…创建/已就绪」类，不禁「创建成功后…」这种讲未来
    forbidPhrases: ['已创建', '已成功创建', '线索已创建', '信息已就绪', '已为你完成创建'],
  },
];

async function loginMobile(page: Page, login: Case['login']) {
  await page.goto('/m/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByTestId(`role-card-${login}`).click();
  await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 15_000 });
}

async function sendPromptAndAssertReply(page: Page, prompt: string, replyIndex: number) {
  const input = page.locator('input[placeholder="向 AI 提问..."]');
  await expect(input).toBeEnabled({ timeout: 60_000 });
  await input.fill(prompt);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId('chat-msg-user')).toHaveCount(replyIndex + 1, { timeout: 15_000 });
  await expect.poll(
    async () => page.getByTestId('chat-msg-assistant').count(),
    { timeout: 60_000, message: '至少 1 条 assistant 回复' },
  ).toBeGreaterThanOrEqual(replyIndex + 1);
  await expect.poll(
    async () => ((await page.getByTestId('chat-msg-assistant').nth(replyIndex).textContent()) ?? '').trim().length,
    { timeout: 90_000, message: 'assistant 回复必须非空（>5 字符）' },
  ).toBeGreaterThan(5);
}

test.describe('Mobile 端 8 case 全量回归（真实 LLM）', () => {
  for (const c of CASES) {
    test(`Case ${c.id} — ${c.desc} [${c.login}]`, async ({ page, context }) => {
      test.skip(test.info().project.name !== 'mobile-chromium', 'mobile only');
      test.setTimeout(120_000);
      const up = await ensureBackendUp(page);
      test.skip(!up, '后端未在 :8000 运行');
      await context.clearCookies();

      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await loginMobile(page, c.login);
      await sendPromptAndAssertReply(page, c.prompt, 0);

      if (c.expectCard) {
        // 同 PC：写入类 prompt 涉及多轮工具调用，必须先等流跑完再检 card
        await expect(page.locator('input[placeholder="向 AI 提问..."]')).toBeEnabled({ timeout: 90_000 });
        await expect.poll(
          async () => page.locator('[data-testid^="chat-form-card-"]').count(),
          { timeout: 30_000, message: `Case ${c.id} 期望至少 1 个 chat-form-card` },
        ).toBeGreaterThanOrEqual(1);
      }

      if (c.forbidPhrases?.length) {
        const assistantText = (await page.getByTestId('chat-msg-assistant').first().textContent()) ?? '';
        for (const ph of c.forbidPhrases) {
          expect(assistantText, `Case ${c.id}: assistant 不应说 "${ph}"，实际="${assistantText.slice(0, 200)}"`).not.toContain(ph);
        }
      }

      expect(errors, `pageerror: ${errors.join('\n')}`).toEqual([]);
    });
  }
});
