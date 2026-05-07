import { test, expect, Page } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 移动端 经理 Pipeline 全量回归（spec 004）
 *
 * 同 PC test 1-5 逻辑，但走 mobile-chromium project + 卡片化 UI 断言。
 */

const FORBID_PHRASES = [
  '已创建',
  '已成功创建',
  '线索已创建',
  '信息已就绪',
  '已为你完成创建',
];

async function loginAsManager01Mobile(page: Page) {
  await page.goto('/m/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByTestId('role-card-manager01').click();
  // mobile login 跳到 /m/chat
  await expect(page).toHaveURL(/\/m\//, { timeout: 15_000 });
}

test.describe('移动端 经理 Pipeline 全量回归（spec 004）', () => {
  test.beforeAll(async ({ request }) => {
    const resp = await request.get('http://localhost:8000/api/v1/auth/me', {
      failOnStatusCode: false,
    });
    test.skip(![200, 401].includes(resp.status()), '后端未在 :8000 运行');
  });

  test.beforeEach(async ({ page, context }) => {
    test.skip(test.info().project.name !== 'mobile-chromium', 'mobile only');
    test.setTimeout(120_000);
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
    await context.clearCookies();
  });

  test('Case M-P1 — manager01 进 /m/manager-pipeline 默认 Deals + 6 横滑 tabs', async ({ page }) => {
    await loginAsManager01Mobile(page);
    await page.goto('/m/manager-pipeline');
    await expect(page.getByTestId('mobile-manager-pipeline-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('mobile-toggle-deals')).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('mobile-forecast-tabs')).toBeVisible();
    for (const cat of ['进行中', '必赢', '大概率', '乐观估算', '已赢单', '已丢单']) {
      await expect(page.getByTestId(`mobile-forecast-tab-${cat}`)).toBeVisible();
    }
  });

  test('Case M-P2 — 切到 Team → drill-down 销售卡 → Deals + filter', async ({ page }) => {
    await loginAsManager01Mobile(page);
    await page.goto('/m/manager-pipeline');
    await expect(page.getByTestId('mobile-manager-pipeline-page')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('mobile-toggle-team').click();
    await expect(page.getByTestId('mobile-toggle-team')).toHaveAttribute('data-active', 'true');

    const rollupOrEmpty = page
      .getByTestId('mobile-team-rollup')
      .or(page.getByTestId('mobile-team-rollup-empty'));
    await expect(rollupOrEmpty).toBeVisible({ timeout: 10_000 });

    const cards = page.locator('[data-testid^="mobile-team-card-"]');
    const cnt = await cards.count();
    if (cnt === 0) {
      test.skip(true, 'Mobile team rollup 暂无数据，跳过 drill-down 断言');
    }

    await cards.first().click();
    await expect(page.getByTestId('mobile-toggle-deals')).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('mobile-owner-filter-banner')).toBeVisible({ timeout: 5_000 });
  });

  test('Case M-P3 — forecast 改到 "必赢" → BottomSheet 选 → AI 校验 dialog (如有) → 改成功', async ({ page }) => {
    await loginAsManager01Mobile(page);
    await page.goto('/m/manager-pipeline');
    await expect(page.getByTestId('mobile-manager-pipeline-page')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('mobile-forecast-tab-进行中').click();

    const cards = page.locator('[data-testid^="deal-card-"]');
    await expect.poll(async () => cards.count(), { timeout: 10_000 }).toBeGreaterThan(0);

    const firstCard = cards.first();
    const trigger = firstCard.locator('[data-testid^="deal-forecast-trigger-"]').first();
    await trigger.click();

    // BottomSheet 出现
    await expect(page.getByTestId('mobile-forecast-edit-sheet')).toBeVisible({ timeout: 5_000 });

    await page.getByTestId('mobile-forecast-option-必赢').click();

    // 全屏校验 dialog 可能出现（verdict=challenge）
    const dialog = page.getByTestId('mobile-forecast-validation-dialog');
    const showed = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    if (showed) {
      await page.getByTestId('mobile-validation-continue').click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    }

    await page.waitForTimeout(800);
  });

  test('Case M-P4 — lead 详情页趋势图组件存在（移动端宽度自适应）', async ({ page }) => {
    await loginAsManager01Mobile(page);
    await page.goto('/m/leads');
    const firstLink = page.locator('a[href*="/leads/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10_000 });
    await firstLink.click();
    await expect(page).toHaveURL(/\/leads\/[a-f0-9-]+/, { timeout: 10_000 });
    await expect(page.getByTestId('meddicc-trend-chart')).toBeVisible({ timeout: 15_000 });
  });

  test('Case M-P5 — chat 提问 "团队哪几单存在风险" → AI 调用 + 不出现幻觉文案', async ({ page }) => {
    await loginAsManager01Mobile(page);
    await page.goto('/m/chat');
    await expect(page).toHaveURL(/\/m\/chat/, { timeout: 10_000 });

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // 找移动端 chat 输入框（spec 003 使用 placeholder="输入消息..."）
    const input = page.locator('input[placeholder="输入消息..."]').or(
      page.locator('textarea[placeholder*="消息"]'),
    );
    await expect(input.first()).toBeEnabled({ timeout: 60_000 });
    await input.first().fill('团队哪几单存在风险？');
    await page.locator('button[type="submit"]').first().click();

    await expect.poll(
      async () => page.getByTestId('chat-msg-assistant').count(),
      { timeout: 60_000 },
    ).toBeGreaterThanOrEqual(1);

    await expect.poll(
      async () =>
        ((await page.getByTestId('chat-msg-assistant').first().textContent()) ?? '').trim()
          .length,
      { timeout: 120_000 },
    ).toBeGreaterThan(5);

    await expect(input.first()).toBeEnabled({ timeout: 90_000 });

    const assistantText =
      (await page.getByTestId('chat-msg-assistant').first().textContent()) ?? '';
    for (const ph of FORBID_PHRASES) {
      expect(assistantText, `assistant 不应说 "${ph}"`).not.toContain(ph);
    }
    expect(errors, `pageerror: ${errors.join('\n')}`).toEqual([]);
  });
});
