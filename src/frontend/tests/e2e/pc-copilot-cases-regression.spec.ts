import { test, expect, Page } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * PC 端 8 个 copilot case 全量回归（用户 2026-05-04 升级为刚性必跑）
 *
 * 案例清单见 docs/copilot-cases.md。每个 case：
 *  1. 用对应账号登录（sales01 或 manager01）
 *  2. 在 chat 输入框打 prompt 提交
 *  3. 断言 assistant 气泡 textContent.length > 5（防"流空"）
 *  4. 案例 3、5 额外断言导航按钮 / chat 卡片可见（写入类 prompt）
 *
 * 真实 LLM，不允许 mock。整套通常需要 8-10 分钟。
 */

interface Case {
  id: number | string;
  desc: string;
  login: 'sales01' | 'manager01';
  prompt: string;
  /** 写入类 case：除了非空回复，还要看到 navigate 按钮（PC 用的是 ChatSidebar 内的 button[onClick=onNavigate]） */
  expectNav?: boolean;
  /** 创建类 case：nav 按钮的 URL 必须含指定 query param（验证 prefill 真的传了） */
  expectNavUrlContains?: string;
  /** 反向断言：assistant 回复不能出现的话术（防 AI 幻觉「已创建」） */
  forbidPhrases?: string[];
}

const CASES: Case[] = [
  { id: 1, desc: '自然语言查线索', login: 'sales01', prompt: '帮我看看华南那边的线索有哪些' },
  { id: 2, desc: '跨对象关联（线索 + 联系人）', login: 'sales01', prompt: '深圳前海微链的详细信息帮我看看，联系人都有谁' },
  { id: 3, desc: '一句话多步操作 + 表单预填（核心）', login: 'sales01', prompt: '我今天拜访了深圳前海微链的赵鹏，聊了合作方案，对方很感兴趣。帮我把该做的都做了。', expectNav: true },
  { id: 4, desc: 'AI 洞察策略建议', login: 'sales01', prompt: '北京数字颗粒科技最近情况怎么样？我该怎么跟？' },
  { id: 5, desc: '转化决策', login: 'sales01', prompt: '天津智联云的小课款已经到了，帮我走转化流程', expectNav: true },
  { id: 6, desc: '管理者：谁在偷懒', login: 'manager01', prompt: '帮我看看最近团队里哪个销售跟进最不积极？有没有线索快要被自动释放的？' },
  { id: 7, desc: '数据权限：同工具不同视野', login: 'manager01', prompt: '帮我看看我们团队现在有哪些线索' },
  { id: 8, desc: '队长评估具体线索', login: 'manager01', prompt: '北京华信恒通最近跟得怎么样？' },
  // 新增创建类 case（2026-05-04 用户报告 AI 会幻觉「已创建」+ prefill 漏 company_name）
  {
    id: '9-create',
    desc: '新建线索（HITL 边界 + prefill）',
    login: 'sales01',
    prompt: '我新建一个华东区的线索：大兴置业有限公司',
    expectNav: true,
    expectNavUrlContains: 'company_name',
    // 只禁过去时「已…创建/已就绪」类，不禁「创建成功后…」这种讲未来
    forbidPhrases: ['已创建', '已成功创建', '线索已创建', '信息已就绪', '已为你完成创建'],
  },
];

async function loginAndOpenChat(page: Page, login: Case['login']) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByTestId(`role-card-${login}`).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  // PC 端登录后默认展开 chat（chat-sidebar 默认 open=true）
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 10_000 });
}

async function sendPromptAndAssertReply(page: Page, prompt: string, replyIndex: number) {
  const input = page.locator('input[placeholder="输入消息..."]');
  await expect(input).toBeEnabled({ timeout: 60_000 });
  await input.fill(prompt);
  await page.locator('button[type="submit"]').click();
  // 等到第 replyIndex+1 个 user 消息出现（就是刚发的）
  await expect(page.getByTestId('chat-msg-user')).toHaveCount(replyIndex + 1, { timeout: 15_000 });
  // 等 assistant 回复出现且非空
  await expect.poll(
    async () => page.getByTestId('chat-msg-assistant').count(),
    { timeout: 60_000, message: '至少 1 条 assistant 回复' },
  ).toBeGreaterThanOrEqual(replyIndex + 1);
  await expect.poll(
    async () => ((await page.getByTestId('chat-msg-assistant').nth(replyIndex).textContent()) ?? '').trim().length,
    { timeout: 90_000, message: 'assistant 回复必须非空（>5 字符）' },
  ).toBeGreaterThan(5);
}

test.describe('PC 端 8 case 全量回归（真实 LLM）', () => {
  test.beforeAll(async ({ request }) => {
    const resp = await request.get('http://localhost:8000/api/v1/auth/me', { failOnStatusCode: false });
    test.skip(![200, 401].includes(resp.status()), '后端未在 :8000 运行');
  });

  for (const c of CASES) {
    test(`Case ${c.id} — ${c.desc} [${c.login}]`, async ({ page, context }) => {
      test.skip(test.info().project.name !== 'pc-chromium', 'pc only');
      test.setTimeout(120_000); // 单 case 最长 2 分钟（含 LLM 工具调用）
      const up = await ensureBackendUp(page);
      test.skip(!up, '后端未在 :8000 运行');
      await context.clearCookies();

      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await loginAndOpenChat(page, c.login);
      await sendPromptAndAssertReply(page, c.prompt, 0);

      if (c.expectNav) {
        // 写入类 prompt 涉及多轮工具调用，AI 可能要 30+ 秒才把 [ui:nav] 标记吐完。
        // 必须先等流跑完（input 重新可用 = loading=false），再轮询 nav 按钮。
        await expect(page.locator('input[placeholder="输入消息..."]')).toBeEnabled({ timeout: 90_000 });
        await expect.poll(
          async () =>
            page
              .locator('[data-testid="chat-msg-assistant"] button')
              .filter({ hasText: '→' })
              .count(),
          { timeout: 30_000, message: `Case ${c.id} 期望至少 1 个 navigate 按钮` },
        ).toBeGreaterThanOrEqual(1);
      }

      // 创建类 case：检查 nav 按钮对应的 URL 包含 prefill 关键 query param
      // navParts 在 chat-sidebar 中通过 onNavigate(url) 处理，但按钮上没直接挂 url。
      // 改通过解析 assistant raw text，找 [[nav:label|url]] 标记里的 url。
      if (c.expectNavUrlContains) {
        const assistantText = (await page.getByTestId('chat-msg-assistant').first().textContent()) ?? '';
        // 注：parseNavMarkers 会把 [[nav:label|url]] 从展示中剥掉，所以 textContent 里看不到原文 url。
        // 改成读最后一条 user msg 后 fetch /api/chat 抓的响应 raw — 但太重。
        // 简化：直接扫页面 DOM 上 navigate 按钮的 onclick handler 不可行（React 合成事件）。
        // 用 page.evaluate 读 React 内部 props 不稳。
        // 折中：让 chat-sidebar MessageContent 的按钮挂上 data-nav-url 属性，下面断言读它。
        const navUrls = await page
          .locator('[data-testid="chat-msg-assistant"] button[data-nav-url]')
          .evaluateAll((els) => els.map((el) => el.getAttribute('data-nav-url') ?? ''));
        const matched = navUrls.some((u) => u.includes(c.expectNavUrlContains!));
        expect(matched, `Case ${c.id} 期望某个 nav URL 含 "${c.expectNavUrlContains}"，实际 URLs=${JSON.stringify(navUrls)}（assistant raw="${assistantText.slice(0, 200)}"）`).toBe(true);
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
