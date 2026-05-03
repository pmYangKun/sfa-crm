import { test, expect } from '@playwright/test';
import { ensureBackendUp, mockChatStream } from './helpers';

/**
 * US1: PC 端访客试玩闭环（spec.md FR-001 ~ FR-006, FR-015, FR-019, FR-020）
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

test.describe('US1: PC 登录页基础（FR-001 ~ FR-005）', () => {
  test('FR-001/002/003/004: 登录页渲染 Hero + 双角色卡片 + 项目亮点，无账号密码框', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByTestId('hero-title')).toContainText('Native AI CRM');
    await expect(page.getByTestId('role-card-sales01')).toBeVisible();
    await expect(page.getByTestId('role-card-manager01')).toBeVisible();
    await expect(page.getByTestId('role-card-sales01')).toContainText('销售·王小明');
    await expect(page.getByTestId('role-card-manager01')).toContainText('销售经理·陈队长');

    // 不应有手动账号/密码输入框
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    // 项目亮点
    await expect(page.getByTestId('highlights-panel-pc')).toBeVisible();
    await expect(page.getByTestId('highlights-panel-pc')).toContainText('VibeCoding');
    await expect(page.getByTestId('highlights-panel-pc')).toContainText('Ontology');
    await expect(page.getByTestId('highlights-panel-pc')).toContainText('Copilot');
    await expect(page.getByTestId('highlights-panel-pc')).toContainText('pmYangKun');

    await page.screenshot({ path: 'tests/screenshots/us1-01-login-pc.png', fullPage: true });
  });
});

test.describe('US1: 一键登录 + Dashboard 引导区（FR-006 / FR-015）', () => {
  test('FR-006: 点 sales01 卡片自动登录跳 Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByTestId('onboarding-panel')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/us1-02-dashboard-sales01.png', fullPage: true });
  });

  test('FR-015: sales01 Dashboard 顶部展示 4 张引导卡片（按角色过滤）', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByTestId('onboarding-card-s01-1')).toBeVisible();
    await expect(page.getByTestId('onboarding-card-s01-2')).toBeVisible();
    await expect(page.getByTestId('onboarding-card-s01-3')).toBeVisible();
    await expect(page.getByTestId('onboarding-card-s01-4')).toBeVisible();
    // 不应渲染 manager01 的卡片
    await expect(page.getByTestId('onboarding-card-m01-1')).toHaveCount(0);
  });

  test('manager01 Dashboard 渲染 manager 自己的引导卡片', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('role-card-manager01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByTestId('onboarding-card-m01-1')).toBeVisible();
    await expect(page.getByTestId('onboarding-card-m01-2')).toBeVisible();
    await expect(page.getByTestId('onboarding-card-m01-3')).toBeVisible();
    await expect(page.getByTestId('onboarding-card-s01-1')).toHaveCount(0);
    await page.screenshot({ path: 'tests/screenshots/us1-03-dashboard-manager01.png', fullPage: true });
  });
});

test.describe('US1: 引导卡片点击触发 chat（FR-019）', () => {
  test('FR-019: 点 demo 卡片 → chat 自动打开 + 用户消息发送', async ({ page }) => {
    await mockChatStream(page, '已识别到「华南」区域。这里是模拟回复，便于测试导航通路。');

    await page.goto('/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    await page.getByTestId('onboarding-card-s01-1').click();

    // chat 面板应自动打开
    await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 3000 });
    // 用户消息出现
    await expect(page.getByTestId('chat-msg-user')).toContainText('华南', { timeout: 5000 });

    await page.screenshot({ path: 'tests/screenshots/us1-04-chat-after-card-click.png', fullPage: true });
  });
});

test.describe('US1: 角色切换卡片（FR-020）', () => {
  test('FR-020: 点切换卡 → 弹确认 → 确认后 quickSwitchRole 切到 manager01', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    await page.getByTestId('onboarding-card-s01-4').click();

    // 弹窗出现
    await expect(page.getByTestId('role-switch-confirm')).toBeVisible();
    await expect(page.getByTestId('role-switch-confirm')).toContainText('陈队长');
    await page.screenshot({ path: 'tests/screenshots/us1-05-role-switch-confirm.png', fullPage: true });

    await page.getByTestId('role-switch-confirm-btn').click();

    // 弹窗消失，引导区现在显示 manager01 的卡片
    await expect(page.getByTestId('role-switch-confirm')).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByTestId('onboarding-card-m01-1')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'tests/screenshots/us1-06-after-role-switch.png', fullPage: true });
  });
});
