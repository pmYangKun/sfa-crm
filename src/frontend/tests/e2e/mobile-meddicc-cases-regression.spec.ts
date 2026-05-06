import { test, expect, Page } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 移动端 MEDDICC 销售视角回归用例（spec 003 / 移动端对等改造后）
 *
 * 核心断言：
 *  M-Mobile-1: 移动端从线索列表点进 demo lead → 跳到 /m/leads/{id} → MEDDICC 仪表盘 + 场景卡 + 对话区都可见
 *  M-Mobile-2: 移动端 chat 通过 onboarding 卡发问 → AI 回复带"查看详情"按钮 → 点按钮跳到 /m/leads/{id} 而非 /leads/{id}
 *
 * 真实 LLM。受 spec 002 限流影响时整套约 1-2 分钟。
 */

const DEMO_LEAD_KEYWORD = '前海微链';

async function loginAsSales01Mobile(page: Page) {
  await page.goto('/m/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByTestId('role-card-sales01').click();
  await expect(page).toHaveURL(/\/m\/chat/, { timeout: 15_000 });
}

test.describe('移动端 MEDDICC 全量回归（真实 LLM）', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(test.info().project.name !== 'mobile-chromium', 'mobile only');
    test.setTimeout(120_000);
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
    await context.clearCookies();
  });

  test('Case Mobile-M1 — 移动端线索列表点进 → /m/leads/{id} 仪表盘渲染', async ({ page }) => {
    await loginAsSales01Mobile(page);

    // 切到 leads tab
    await page.goto('/m/leads');
    await expect(page.locator('text=' + DEMO_LEAD_KEYWORD).first()).toBeVisible({ timeout: 10_000 });

    // 点开 demo lead — 期望跳到 /m/leads/{uuid}（带 mobile 前缀）
    await page.locator('text=' + DEMO_LEAD_KEYWORD).first().click();
    await expect(page).toHaveURL(/\/m\/leads\/[a-f0-9-]{36}/, { timeout: 10_000 });

    // MEDDICC 仪表盘 + 场景卡 + 对话区都可见
    await expect(page.getByTestId('meddicc-dashboard')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('scenario-card-grid')).toBeVisible();
    await expect(page.getByTestId('meddicc-conversation-section')).toBeVisible();

    // Score 非零（init_db 已 analyze 过）
    const scoreText = await page.getByTestId('meddicc-score').textContent({ timeout: 10_000 });
    const scoreNum = parseInt((scoreText || '0').match(/\d+/)?.[0] || '0', 10);
    expect(scoreNum).toBeGreaterThan(0);
  });

  test('Case Mobile-M2 — chat 卡片 → AI 详情按钮 → 跳 /m/leads/{id}', async ({ page }) => {
    await loginAsSales01Mobile(page);

    // 在 chat 全屏页找到 MEDDICC 卡片并点击（移动端 testid 加 mobile- 前缀）
    const meddiccCard = page.getByTestId('onboarding-card-mobile-s01-meddicc');
    await expect(meddiccCard).toBeVisible({ timeout: 10_000 });
    await meddiccCard.click();

    // 等 AI 回复（含真实 LLM，最多 60s）
    const assistantMsg = page.getByTestId('chat-msg-assistant').last();
    await expect(assistantMsg).toBeVisible({ timeout: 60_000 });

    // 等流式结束（输入框 disabled → enabled）
    const sendInput = page.locator('input[placeholder="向 AI 提问..."]');
    await expect(sendInput).toBeEnabled({ timeout: 90_000 });

    // 移动端 chat 渲染 ChatFormCard，url=/leads/{uuid}（无 hash）
    // 点击该卡 → 应跳到 /m/leads/{uuid}（移动端对等路由）
    const detailCards = page.locator('[data-testid^="chat-form-card-"]');
    await expect(detailCards.first()).toBeVisible({ timeout: 10_000 });
    await detailCards.first().click();

    await expect(page).toHaveURL(/\/m\/leads\/[a-f0-9-]{36}/, { timeout: 10_000 });
    await expect(page.getByTestId('meddicc-dashboard')).toBeVisible({ timeout: 15_000 });
  });
});
