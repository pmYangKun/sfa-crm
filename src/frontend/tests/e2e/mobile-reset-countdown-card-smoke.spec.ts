import { test, expect } from '@playwright/test';

/**
 * Regression: 移动端倒计时不能用浮动 badge（遮挡 chat 输入/发送按钮）；
 * 必须在 /m/me 页面内嵌 ResetCountdownCard 卡片显示。
 *
 * 用户反馈触发的设计调整 (2026-05-17)：
 * - chat-fullscreen 底部输入区高度 ~70px，原 bottom:80 浮动 badge 正好覆盖发送按钮
 * - 改造：useResetCountdown hook 共享拉取逻辑；ResetCountdownBadge 移动端 return null；
 *   ResetCountdownCard 在 /m/me 页面内嵌
 */
test('移动端 /m/me 有 ResetCountdownCard + 全局浮动 badge 不渲染', async ({ page }) => {
  await page.goto('http://localhost:3000/m/login');
  await page.waitForSelector('[data-testid="manual-login-form-mobile"]');
  await page.fill('[data-testid="manual-login-input-mobile"]', 'sales01');
  await page.fill('[data-testid="manual-password-input-mobile"]', '12345');
  await page.click('[data-testid="manual-login-submit-mobile"]');

  await page.waitForURL(/\/m\/chat/, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // 1. chat 页面不应出现浮动 badge
  await expect(page.locator('[data-testid="reset-countdown-badge"]')).toHaveCount(0);

  // 2. /m/me 页面应该有内嵌卡片
  await page.goto('http://localhost:3000/m/me');
  await page.waitForSelector('[data-testid="me-current-role"]', { timeout: 5_000 });
  const card = page.locator('[data-testid="reset-countdown-card"]');
  await expect(card).toBeVisible({ timeout: 5_000 });
  await expect(card).toContainText(/演示数据自动重置/);
  await expect(card).toContainText(/重置/);
});
