import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 真实 /api/chat（不 mock）的端到端串测，覆盖用户报告的全部 PC 场景。
 * 用真实 LLM：首次点卡片 → 二次点卡片 → 输入框打字 → 都要正常产生 user+assistant 消息。
 */

test.describe('PC 真实 API 串测', () => {
  test.beforeEach(async ({ page, context }) => {
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('登录 → 第 1 卡片 → 第 2 卡片 → 输入框打字 → 全部都有反馈', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByTestId('onboarding-panel')).toBeVisible();

    // 1. 第一张卡片
    await page.getByTestId('onboarding-card-s01-1').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('chat-msg-user').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('chat-msg-assistant').first()).toBeVisible({ timeout: 60_000 });
    expect(await page.getByTestId('chat-msg-user').count()).toBe(1);

    // 2. 第二张卡片（不同 prompt，等第一个回复完）
    // 等 input 重新可用（loading=false）
    await expect(page.locator('input[placeholder="输入消息..."]')).toBeEnabled({ timeout: 60_000 });
    await page.getByTestId('onboarding-card-s01-3').click();
    await expect(page.getByTestId('chat-msg-user')).toHaveCount(2, { timeout: 15_000 });
    await expect.poll(
      async () => page.getByTestId('chat-msg-assistant').count(),
      { timeout: 60_000 },
    ).toBeGreaterThanOrEqual(2);

    // 3. 输入框打字
    await expect(page.locator('input[placeholder="输入消息..."]')).toBeEnabled({ timeout: 60_000 });
    await page.fill('input[placeholder="输入消息..."]', '帮我看看华南的客户');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByTestId('chat-msg-user')).toHaveCount(3, { timeout: 15_000 });
    await expect.poll(
      async () => page.getByTestId('chat-msg-assistant').count(),
      { timeout: 60_000 },
    ).toBeGreaterThanOrEqual(3);

    expect(errors, errors.join('\n')).toEqual([]);
    await page.screenshot({ path: 'tests/screenshots/pc-diag-three-prompts.png', fullPage: true });
  });
});
