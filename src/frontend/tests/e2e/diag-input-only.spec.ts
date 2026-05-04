import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 真实 API 验证：登录后直接打字 → 后端必须收到非空 messages → 必须返回非空响应
 * 守住 "messagesForApi 闭包赋值 race" 这个 bug 不再回潮。
 */

async function checkRealReply(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
  loginPath: string,
  loginCard: string,
  postLoginCheck: () => Promise<unknown>,
  inputPlaceholder: string,
) {
  let lastReqBody = '';
  let lastResLen = -1;
  page.on('request', (req) => {
    if (req.url().includes('/api/chat')) lastReqBody = req.postData() ?? '';
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/chat')) {
      try {
        lastResLen = (await res.text()).length;
      } catch {}
    }
  });
  page.on('pageerror', (e) => console.log('[PAGEERR]', e.message));

  await context.clearCookies();
  await page.goto(loginPath);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByTestId(loginCard).click();
  await postLoginCheck();

  await page.fill(`input[placeholder="${inputPlaceholder}"]`, '你好');
  await page.locator('button[type="submit"]').click();

  // 等待响应
  await expect.poll(() => lastResLen, { timeout: 60_000, intervals: [500] }).toBeGreaterThan(20);
  // 请求 body 必须含真实用户输入
  expect(lastReqBody).toContain('"content":"你好"');
  // 响应必须不为空
  expect(lastResLen).toBeGreaterThan(20);

  // 用户消息可见
  await expect(page.getByTestId('chat-msg-user').first()).toBeVisible({ timeout: 5_000 });
  // assistant 消息有真实文本（不只是占位）
  const assistantText = await page.getByTestId('chat-msg-assistant').first().textContent();
  expect(assistantText && assistantText.length).toBeGreaterThan(20);
}

test('PC: 输入框直接打字 → 真实非空回复', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'pc-chromium', 'pc only');
  const up = await ensureBackendUp(page);
  test.skip(!up, '后端未在 :8000 运行');

  await checkRealReply(
    page,
    context,
    '/login',
    'role-card-sales01',
    async () => {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
      await page.getByTestId('chat-toggle-btn').click();
      await expect(page.getByTestId('chat-panel')).toBeVisible();
    },
    '输入消息...',
  );
});

test('Mobile: 输入框直接打字 → 真实非空回复', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'mobile-chromium', 'mobile only');
  const up = await ensureBackendUp(page);
  test.skip(!up, '后端未在 :8000 运行');

  await checkRealReply(
    page,
    context,
    '/m/login',
    'role-card-sales01',
    async () => {
      await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 10_000 });
    },
    '向 AI 提问...',
  );
});
