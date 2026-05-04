import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 用户反馈跟进：
 *  1. 登录页两栏布局（左角色卡 + 介绍 / 右账号密码登录，常驻可见）
 *  2. Dashboard OnboardingPanel 文案 + 视觉
 */

test.describe('PC 登录页：两栏布局 + 常驻账号密码登录', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(test.info().project.name !== 'pc-chromium', 'pc only');
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('登录表单常驻可见 + 角色卡片同时可见', async ({ page }) => {
    await expect(page.getByTestId('role-cards-container')).toBeVisible();
    await expect(page.getByTestId('manual-login-form')).toBeVisible();
    await expect(page.getByTestId('manual-login-input')).toBeVisible();
    await expect(page.getByTestId('manual-password-input')).toBeVisible();
    await expect(page.getByTestId('manual-login-submit')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/login-two-column.png', fullPage: true });
  });

  test('用 admin/12345 真实登录 → 跳 dashboard', async ({ page }) => {
    await page.getByTestId('manual-login-input').fill('admin');
    await page.getByTestId('manual-password-input').fill('12345');
    await page.getByTestId('manual-login-submit').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('错误密码 → 显示错误 + 不跳转', async ({ page }) => {
    await page.getByTestId('manual-login-input').fill('admin');
    await page.getByTestId('manual-password-input').fill('wrong');
    await page.getByTestId('manual-login-submit').click();
    await expect(page.getByTestId('manual-login-form')).toBeVisible();
    expect(page.url()).toContain('/login');
  });

  test('点角色卡仍然可一键登录（不受表单存在影响）', async ({ page }) => {
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});

test.describe('PC Dashboard OnboardingPanel：文案 + 视觉', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(test.info().project.name !== 'pc-chromium', 'pc only');
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('引导区文案改成"可以直接点击下面的卡片，快速体验这种对话式 CRM 的能力"', async ({ page }) => {
    const panel = page.getByTestId('onboarding-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('可以直接点击下面的卡片');
    await expect(panel).toContainText('对话式 CRM');
  });

  test('引导区有暖橙渐变背景 + 顶部"AI COPILOT 演示"徽标', async ({ page }) => {
    const panel = page.getByTestId('onboarding-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('AI COPILOT 演示');
    await page.screenshot({ path: 'tests/screenshots/onboarding-panel-new-visual.png', fullPage: true });
  });
});
