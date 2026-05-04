import { test, expect, Route } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 用户反馈 bug 修复回归：
 *  - chat sendPrompt loading 中点卡片直接忽略（用户决策：不再排队后续执行；
 *    见 chat-sidebar.tsx / chat-fullscreen.tsx 注释）
 *  - 移动 chat-fullscreen 加「↺ 新对话」按钮（避免选了卡片后回不到引导态）
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

test.describe('修复：loading 结束后立即发第二条 prompt 不丢', () => {
  test('点卡片 → 等 loading 结束 → 立即发第二条 → 两个 prompt 都被处理', async ({ page }) => {
    let chatCallCount = 0;
    await page.route('**/api/chat', async (route: Route) => {
      chatCallCount++;
      await new Promise((r) => setTimeout(r, 250));
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: `回复 #${chatCallCount}`,
      });
    });

    await page.goto('/m/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 10_000 });

    // 第 1 个 prompt：点卡片触发
    await page.getByTestId('onboarding-card-mobile-s01-1').click();
    // 此时 chat 在 loading（因为 mock 有 250ms 延迟）

    // 第 2 个 prompt：直接在输入框打字 + 提交（loading 期间）
    const textInput = page.locator('input[placeholder="向 AI 提问..."]');
    await textInput.fill('第二条');
    // submit 按钮在 loading 时被 disabled，但表单 onSubmit 仍可手动触发；
    // 改用 keyboard Enter（disabled 情况下 enter 提交会被 form 阻止——
    // 所以等 loading 完成再发第二条更接近真实操作；本测试模拟"快速连发"是
    // 通过等 loading 完成后立即点）
    await expect(page.getByTestId('chat-msg-user').first()).toBeVisible({ timeout: 5000 });
    // 等 input 解锁（loading 结束）后立即发第二条 — 模拟快速连发
    await expect(textInput).toBeEnabled({ timeout: 5000 });
    await textInput.fill('第二条');
    await page.locator('button[type="submit"]').click();

    // 两个 user msg 都出现
    await expect(page.getByTestId('chat-msg-user')).toHaveCount(2, { timeout: 10_000 });
    await expect.poll(() => chatCallCount, { timeout: 10_000 }).toBe(2);
  });
});

test.describe('修复：移动 chat 新对话按钮', () => {
  test('发消息后 → 新对话按钮可见 → 点击 → 消息清空 + 引导卡重现', async ({ page }) => {
    await page.route('**/api/chat', async (route: Route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: '已识别到「华南」区域。',
      });
    });

    await page.goto('/m/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 10_000 });

    // 初始无消息时，没有「新对话」按钮，但有引导卡
    await expect(page.getByTestId('reset-chat-btn')).toHaveCount(0);
    await expect(page.getByTestId('onboarding-cards-mobile')).toBeVisible();

    // 发一个 prompt
    await page.getByTestId('onboarding-card-mobile-s01-1').click();
    await expect(page.getByTestId('chat-msg-user')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('onboarding-cards-mobile')).toHaveCount(0);

    // 「新对话」按钮出现
    await expect(page.getByTestId('reset-chat-btn')).toBeVisible();

    // 点击重置
    await page.getByTestId('reset-chat-btn').click();
    await expect(page.getByTestId('chat-msg-user')).toHaveCount(0);
    await expect(page.getByTestId('onboarding-cards-mobile')).toBeVisible();
    await expect(page.getByTestId('reset-chat-btn')).toHaveCount(0);
  });
});
