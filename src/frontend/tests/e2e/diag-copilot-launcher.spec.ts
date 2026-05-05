import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

test('PC 登录后右下角 AI launcher 视觉自查', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'pc-chromium', 'pc only');
  const up = await ensureBackendUp(page);
  test.skip(!up, '后端未在 :8000 运行');
  await context.clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByTestId('role-card-manager01').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  // PC 登录后 chat panel 默认展开（commit 27033b9 后行为）→ 先关 chat 才能看到 launcher
  const chatPanel = page.getByTestId('chat-panel');
  await expect(chatPanel).toBeVisible({ timeout: 10_000 });
  await chatPanel.getByTitle('关闭').click();

  const btn = page.getByTestId('chat-toggle-btn');
  await expect(btn).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/copilot-launcher-full.png', fullPage: false });
  await btn.screenshot({ path: 'tests/screenshots/copilot-launcher-btn.png' });

  await btn.hover();
  await page.waitForTimeout(300);
  await btn.screenshot({ path: 'tests/screenshots/copilot-launcher-hover.png' });
});
