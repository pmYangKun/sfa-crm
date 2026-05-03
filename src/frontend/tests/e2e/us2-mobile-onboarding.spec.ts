import { test, expect } from '@playwright/test';
import { ensureBackendUp, mockChatStream } from './helpers';

/**
 * US2: 移动端访客试玩闭环（spec.md FR-007 ~ FR-014, FR-016, FR-029）
 */

test.beforeEach(async ({ page, context }) => {
  const up = await ensureBackendUp(page);
  test.skip(!up, '后端未在 :8000 运行');
  await context.clearCookies();
  await page.goto('/m/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test.describe('US2: 移动登录页基础（FR-007 ~ FR-009）', () => {
  test('FR-007/008: 移动登录页渲染 Hero + 垂直堆叠双角色卡 + 移动版亮点（无 GitHub）', async ({ page }) => {
    await page.goto('/m/login');
    await expect(page.getByTestId('hero-title-mobile')).toContainText('Native AI CRM');
    await expect(page.getByTestId('role-card-sales01')).toBeVisible();
    await expect(page.getByTestId('role-card-manager01')).toBeVisible();
    await expect(page.getByTestId('highlights-panel-mobile')).toBeVisible();
    await expect(page.getByTestId('highlights-panel-mobile')).toContainText('VibeCoding');
    await expect(page.getByTestId('highlights-panel-mobile')).toContainText('pmYangKun');
    // 移动版不含 GitHub 链接
    await expect(page.getByTestId('highlights-panel-mobile')).not.toContainText('github.com');
    await page.screenshot({ path: 'tests/screenshots/us2-01-mobile-login.png', fullPage: true });
  });

  test('FR-009: 移动登录页 320px 视口下不出现横向滚动', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/m/login');
    const overflowing = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowing).toBe(false);
  });
});

test.describe('US2: 一键登录默认进 Chat 全屏（FR-012 / FR-016）', () => {
  test('FR-012: 点 sales01 卡片登录 → 跳 /m/chat 全屏', async ({ page }) => {
    await page.goto('/m/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/m\/chat/, { timeout: 10_000 });
    await expect(page.getByTestId('chat-fullscreen')).toBeVisible();
    await expect(page.getByTestId('kingkong-tabbar')).toBeVisible();
    await expect(page.getByTestId('tab-chat')).toHaveAttribute('data-active', 'true');
    await page.screenshot({ path: 'tests/screenshots/us2-02-mobile-chat-fullscreen.png', fullPage: true });
  });

  test('FR-016: chat 全屏无消息时顶部展示移动版引导卡片', async ({ page }) => {
    await page.goto('/m/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page).toHaveURL(/\/m\/chat/, { timeout: 10_000 });
    await expect(page.getByTestId('onboarding-cards-mobile')).toBeVisible();
    await expect(page.getByTestId('onboarding-card-mobile-s01-1')).toBeVisible();
  });
});

test.describe('US2: 移动引导卡片点击触发 chat（FR-019 移动等价）', () => {
  test('点 demo 卡 → 用户消息发送 + 引导卡折叠', async ({ page }) => {
    await mockChatStream(page, '已识别到「华南」区域。这是模拟回复。');

    await page.goto('/m/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('onboarding-card-mobile-s01-1').click();
    await expect(page.getByTestId('chat-msg-user')).toContainText('华南', { timeout: 5000 });
    // 有消息后引导卡折叠
    await expect(page.getByTestId('onboarding-cards-mobile')).toHaveCount(0);
  });
});

test.describe('US2: 金刚区导航（FR-011）', () => {
  test('FR-011: 5 个 tab 渲染并能切换', async ({ page }) => {
    await page.goto('/m/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId('tab-leads')).toBeVisible();
    await expect(page.getByTestId('tab-customers')).toBeVisible();
    await expect(page.getByTestId('tab-chat')).toBeVisible();
    await expect(page.getByTestId('tab-followups')).toBeVisible();
    await expect(page.getByTestId('tab-me')).toBeVisible();

    await page.getByTestId('tab-followups').click();
    await expect(page).toHaveURL(/\/m\/followups/);
    await expect(page.getByTestId('mobile-followups-cta')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/us2-03-mobile-followups.png', fullPage: true });

    await page.getByTestId('tab-me').click();
    await expect(page).toHaveURL(/\/m\/me/);
    await expect(page.getByTestId('me-current-role')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/us2-04-mobile-me.png', fullPage: true });
  });
});

test.describe('US2: 我的 - 一键切换角色（FR-013 / FR-014）', () => {
  test('FR-013/014: 我的页 → 切换 → 确认 → 切到对方 → 引导卡变化', async ({ page }) => {
    await page.goto('/m/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('tab-me').click();
    await expect(page.getByTestId('me-current-role')).toContainText('王小明');
    await page.getByTestId('me-switch-btn').click();
    await expect(page.getByTestId('role-switch-confirm')).toBeVisible();
    await page.getByTestId('role-switch-confirm-btn').click();
    await expect(page.getByTestId('role-switch-confirm')).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByTestId('me-current-role')).toContainText('陈队长', { timeout: 5000 });
    await page.screenshot({ path: 'tests/screenshots/us2-05-mobile-me-after-switch.png', fullPage: true });
  });
});
