import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 移动端真实 /api/chat 串测：
 *  1. 登录跳 /m/chat → 顶部展示引导卡片
 *  2. 点第一张引导卡 → 真实回复
 *  3. 输入框输入第二条 → 真实回复
 *  4. 「↺ 新对话」清空 → 引导卡再次出现
 *  5. 再点引导卡 → 第三轮真实回复
 */

test.describe('移动端真实 API 串测', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(test.info().project.name !== 'mobile-chromium', 'mobile only');
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
    await context.clearCookies();
    await page.goto('/m/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('登录 → 卡片 1 → 输入框 → 重置 → 卡片 2 → 全部都有反馈', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.getByTestId('role-card-sales01').click();
    await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('onboarding-cards-mobile')).toBeVisible();

    // 1. 点第一张引导卡（s01-1：自然语言查线索）
    await page.getByTestId('onboarding-card-mobile-s01-1').click();
    await expect(page.getByTestId('chat-msg-user').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('chat-msg-assistant').first()).toBeVisible({ timeout: 60_000 });

    // 2. 输入框打字
    await expect(page.locator('input[placeholder="向 AI 提问..."]')).toBeEnabled({ timeout: 60_000 });
    await page.fill('input[placeholder="向 AI 提问..."]', '我想看看华南的客户');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByTestId('chat-msg-user')).toHaveCount(2, { timeout: 15_000 });
    await expect.poll(
      async () => page.getByTestId('chat-msg-assistant').count(),
      { timeout: 60_000 },
    ).toBeGreaterThanOrEqual(2);

    // 3. 「新对话」重置
    await expect(page.getByTestId('reset-chat-btn')).toBeVisible();
    await page.getByTestId('reset-chat-btn').click();
    await expect(page.getByTestId('chat-msg-user')).toHaveCount(0);
    await expect(page.getByTestId('onboarding-cards-mobile')).toBeVisible();

    // 4. 重置后再点不同的引导卡（s01-3）
    await expect(page.locator('input[placeholder="向 AI 提问..."]')).toBeEnabled();
    await page.getByTestId('onboarding-card-mobile-s01-3').click();
    await expect(page.getByTestId('chat-msg-user').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('chat-msg-assistant').first()).toBeVisible({ timeout: 60_000 });

    expect(errors, errors.join('\n')).toEqual([]);
    await page.screenshot({ path: 'tests/screenshots/mobile-diag-full-flow.png', fullPage: true });
  });
});
