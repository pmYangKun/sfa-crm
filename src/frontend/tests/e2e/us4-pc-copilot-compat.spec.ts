import { test, expect, Route } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * US4: PC Copilot 兼容性保留（spec.md FR-028）
 * - PC chat-sidebar 在 [[nav:...]] 标记上仍渲染跳转按钮
 * - 不渲染 ChatFormCard / MobileFormSheet（移动端范式）
 * - 点击 nav 按钮跳转到 PC 表单页（带 prefill query）
 */

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

test.describe('US4: PC Copilot 兼容性（FR-028）', () => {
  test('FR-028: PC chat 中 nav 标记仍渲染为跳转按钮，不是移动卡片', async ({ page }) => {
    await page.route('**/api/chat', async (route: Route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: '我帮你预填了线索：[[nav:新建线索|/leads/new?company_name=深圳前海微链&region=华南]]',
      });
    });

    // PC 登录
    await page.goto('/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // 打开 PC chat 面板（点右下角 toggle 按钮）
    await page.getByTestId('chat-toggle-btn').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    // 发消息
    await page.fill('input[placeholder="输入消息..."]', '帮我建一条深圳前海微链');
    await page.locator('button[type="submit"]').click();

    // PC 应该渲染 nav 跳转按钮（按钮文本"新建线索"），不应渲染 ChatFormCard
    await expect(page.getByRole('button', { name: /新建线索/ })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="chat-form-card-"]')).toHaveCount(0);
    await expect(page.getByTestId('mobile-form-sheet')).toHaveCount(0);

    await page.screenshot({ path: 'tests/screenshots/us4-01-pc-chat-nav-button.png', fullPage: true });
  });

  test('PC nav 按钮点击 → 跳转 /leads/new 并写 sessionStorage prefill', async ({ page }) => {
    await page.route('**/api/chat', async (route: Route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: '已预填：[[nav:新建线索|/leads/new?company_name=深圳前海微链&region=华南&source=referral]]',
      });
    });

    await page.goto('/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await page.getByTestId('chat-toggle-btn').click();
    await page.fill('input[placeholder="输入消息..."]', 'test');
    await page.locator('button[type="submit"]').click();

    const navBtn = page.getByRole('button', { name: /新建线索/ });
    await expect(navBtn).toBeVisible({ timeout: 5000 });
    await navBtn.click();

    // URL 跳到 /leads/new 并带 query params
    await expect(page).toHaveURL(/\/leads\/new/, { timeout: 5000 });
    expect(page.url()).toContain('company_name=');

    // sessionStorage.copilot_prefill 写入
    const prefill = await page.evaluate(() => sessionStorage.getItem('copilot_prefill'));
    expect(prefill).toContain('company_name');
    expect(prefill).toContain('region');
  });
});
