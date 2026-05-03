import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * Playwright 框架自检：在 001 实现开始之前，验证
 *  - 浏览器能启动
 *  - 前端 dev server 自动启起来（playwright.config webServer）
 *  - 后端 :8000 在线
 *  - 旧登录页（账号密码表单）能跑通登录 → 跳 /dashboard
 *
 * 当 T014（PC 登录页改造）完成后，本文件应被删除，由 us1-pc-onboarding.spec.ts 接替。
 */
test.describe('Smoke: pre-001 框架自检', () => {
  test.beforeEach(async ({ page }) => {
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行：cd src/backend && uvicorn app.main:app --port 8000');
  });

  test('旧登录页 sales01 登录跳 dashboard', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await expect(page.locator('h1')).toContainText('SFA CRM');

    await page.fill('input[type="text"]', 'sales01');
    await page.fill('input[type="password"]', '12345');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    await page.screenshot({
      path: 'tests/screenshots/00-smoke-pre-001-dashboard.png',
      fullPage: true,
    });
  });
});
