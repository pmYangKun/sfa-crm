import { test, expect } from '@playwright/test';

/**
 * Regression: ResetCountdownBadge 必须在登录后右下角可见。
 *
 * 历史 bug (2026-05-17 修复)：曾经从 localStorage.getItem('token') 读 token，
 * 但项目其他地方（auth-context / api.ts / chat-sidebar）都用 'access_token'
 * 作为 key。badge 永远拿不到 token、永远静默 early return、永远不渲染——
 * 而且因为 catch 静默+组件不显示，console 也没错，没有任何外部信号。
 * 修复：ResetCountdownBadge.tsx 把 'token' → 'access_token'。
 */
test('ResetCountdownBadge 登录后右下角可见 + 含倒计时文案', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('[data-testid="manual-login-form"]');
  await page.fill('[data-testid="manual-login-input"]', 'sales01');
  await page.fill('[data-testid="manual-password-input"]', '12345');
  await page.click('[data-testid="manual-login-submit"]');

  await page.waitForURL(/dashboard/, { timeout: 10_000 });

  const badge = page.locator('[data-testid="reset-countdown-badge"]');
  await expect(badge).toBeVisible({ timeout: 5_000 });
  await expect(badge).toContainText(/演示数据.*重置/);
});
