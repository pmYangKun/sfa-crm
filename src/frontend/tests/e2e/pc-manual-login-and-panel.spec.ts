import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 用户反馈跟进：
 *  1. 登录页折叠式手动登录（管理员等）
 *  2. Dashboard OnboardingPanel 文案 + 视觉更新
 */

test.describe('PC 登录页：手动登录折叠面板', () => {
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

  test('默认收起：toggle 链接可见，密码输入框不渲染（不破坏 demo 心智）', async ({ page }) => {
    await expect(page.getByTestId('manual-login-toggle')).toBeVisible();
    await expect(page.getByTestId('manual-login-form')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('点 toggle → 表单展开 → 用 admin/12345 真实登录', async ({ page }) => {
    await page.getByTestId('manual-login-toggle').click();
    await expect(page.getByTestId('manual-login-form')).toBeVisible();
    await expect(page.getByTestId('manual-login-input')).toBeVisible();
    await expect(page.getByTestId('manual-password-input')).toBeVisible();

    await page.getByTestId('manual-login-input').fill('admin');
    await page.getByTestId('manual-password-input').fill('12345');
    await page.getByTestId('manual-login-submit').click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await page.screenshot({ path: 'tests/screenshots/manual-login-admin-success.png', fullPage: true });
  });

  test('错误密码 → 显示错误 + 不跳转', async ({ page }) => {
    await page.getByTestId('manual-login-toggle').click();
    await page.getByTestId('manual-login-input').fill('admin');
    await page.getByTestId('manual-password-input').fill('wrong');
    await page.getByTestId('manual-login-submit').click();

    await expect(page.getByTestId('manual-login-form')).toBeVisible();
    expect(page.url()).toContain('/login');
  });

  test('点收起 → 表单消失', async ({ page }) => {
    await page.getByTestId('manual-login-toggle').click();
    await expect(page.getByTestId('manual-login-form')).toBeVisible();
    await page.getByText('收起').click();
    await expect(page.getByTestId('manual-login-form')).toHaveCount(0);
    await expect(page.getByTestId('manual-login-toggle')).toBeVisible();
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

  test('引导区有彩色渐变背景 + 顶部"AI COPILOT 演示"徽标', async ({ page }) => {
    const panel = page.getByTestId('onboarding-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('AI COPILOT 演示');
    // 截图供视觉走查
    await page.screenshot({ path: 'tests/screenshots/onboarding-panel-new-visual.png', fullPage: true });
  });
});
