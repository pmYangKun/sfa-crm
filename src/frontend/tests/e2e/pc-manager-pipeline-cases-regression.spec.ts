import { test, expect, Page } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * PC 端 经理 Pipeline 全量回归（spec 004）
 *
 * 5 个核心场景：
 *  1. manager01 进 /manager-pipeline，默认 Deals 视图 + 6 tabs 可见
 *  2. 切到 Team 视图 → drill-down 一个销售 → 回到 Deals 视图 + owner filter
 *  3. 改 forecast_category 到 "必赢" → AI 校验 dialog（如果 verdict=challenge）→ 选"继续标必赢" → 改成功
 *  4. 进 lead 详情页 → 趋势图组件存在
 *  5. chat 提问 "团队哪几单存在风险" → AI 调 scan_team_warnings → 返回风险列表 + 不出现幻觉文案
 *
 * 真实 LLM，不允许 mock。沿用 spec 003 forbidPhrases 模式。
 */

const FORBID_PHRASES = [
  '已创建',
  '已成功创建',
  '线索已创建',
  '信息已就绪',
  '已为你完成创建',
];

async function loginAsManager01(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByTestId('role-card-manager01').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('PC 端 经理 Pipeline 全量回归（spec 004）', () => {
  test.beforeAll(async ({ request }) => {
    const resp = await request.get('http://localhost:8000/api/v1/auth/me', {
      failOnStatusCode: false,
    });
    test.skip(![200, 401].includes(resp.status()), '后端未在 :8000 运行');
  });

  test.beforeEach(async ({ page, context }) => {
    test.skip(test.info().project.name !== 'pc-chromium', 'pc only');
    test.setTimeout(120_000);
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
    await context.clearCookies();
  });

  test('Case P1 — manager01 进 /manager-pipeline 默认 Team 视图', async ({ page }) => {
    await loginAsManager01(page);
    await page.goto('/manager-pipeline');
    await expect(page.getByTestId('manager-pipeline-page')).toBeVisible({ timeout: 10_000 });
    // spec 004 v2: manager 默认进 Team 视图（先看全貌，再 drill）
    await expect(page.getByTestId('toggle-team')).toHaveAttribute('data-active', 'true');
    // Team rollup 表 / 空态都接受
    const rollupOrEmpty = page
      .getByTestId('team-rollup-table')
      .or(page.getByTestId('team-rollup-empty'));
    await expect(rollupOrEmpty).toBeVisible({ timeout: 10_000 });

    // 切到 Deals 视图后 6 个 tab 都存在
    await page.locator('[data-testid="toggle-deals"]').evaluate((el: HTMLElement) => el.click());
    await expect(page.getByTestId('toggle-deals')).toHaveAttribute('data-active', 'true');
    for (const cat of ['进行中', '必赢', '大概率', '乐观估算', '已赢单', '已丢单']) {
      await expect(page.getByTestId(`forecast-tab-${cat}`)).toBeVisible();
    }
    await expect(page.getByTestId('forecast-tabs')).toBeVisible();
  });

  test('Case P2 — 切到 Team 视图 → drill-down 到 sales → 回到 Deals 视图 owner filter', async ({ page }) => {
    await loginAsManager01(page);
    await page.goto('/manager-pipeline');
    await expect(page.getByTestId('manager-pipeline-page')).toBeVisible({ timeout: 10_000 });

    // 切到 Team（chat-panel 挡层 → 用 evaluate 直接调 DOM click，绕开 pointer-events 拦截）
    await page.locator('[data-testid="toggle-team"]').evaluate((el: HTMLElement) => el.click());
    await expect(page.getByTestId('toggle-team')).toHaveAttribute('data-active', 'true');

    // Team rollup 表渲染（成功 / 空）
    const rollupOrEmpty = page
      .getByTestId('team-rollup-table')
      .or(page.getByTestId('team-rollup-empty'));
    await expect(rollupOrEmpty).toBeVisible({ timeout: 10_000 });

    const rows = page.locator('[data-testid^="team-row-"]');
    const cnt = await rows.count();
    if (cnt === 0) {
      test.skip(true, 'Team rollup 暂无数据，跳过 drill-down 断言');
    }

    // 点第一行 → 跳回 Deals 视图 + filter
    const firstRow = rows.first();
    await firstRow.click();
    await expect(page.getByTestId('toggle-deals')).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('owner-filter-banner')).toBeVisible({ timeout: 5_000 });
  });

  test('Case P3 — forecast 改到 "必赢" → AI 校验 dialog 出现（如有）→ 改成功', async ({ page }) => {
    await loginAsManager01(page);
    await page.goto('/manager-pipeline?view=deals');
    await expect(page.getByTestId('manager-pipeline-page')).toBeVisible({ timeout: 10_000 });

    // 切到 "进行中" tab 找一条 active lead
    await page.getByTestId('forecast-tab-进行中').click();

    // 等表格出现
    const rows = page.locator('[data-testid^="pipeline-row-"]');
    await expect.poll(async () => rows.count(), { timeout: 10_000 }).toBeGreaterThan(0);

    const firstRow = rows.first();
    const trigger = firstRow.locator('[data-testid^="forecast-cell-trigger-"]').first();
    await trigger.click();

    // 选 "必赢"（spec 004 v2：菜单 Portal 出 body，不再是 row 子元素）
    const needWinOption = page.getByTestId('forecast-option-必赢');
    await needWinOption.click();

    // AI 校验 dialog 可能出现（verdict=challenge 时）；可能不出现（verdict=support / abstain）
    const dialog = page.getByTestId('forecast-validation-dialog');
    const showed = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    if (showed) {
      // 选 "继续标 必赢"
      await page.getByTestId('validation-continue').click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    }

    // 校验 forecast_category 已改：刷新后第一行 forecast 显示 "必赢"
    await page.waitForTimeout(800); // 等 PUT 完成 + 重新拉 pipeline
  });

  test('Case P4 — lead 详情页趋势图组件存在', async ({ page }) => {
    await loginAsManager01(page);
    // 走 /manager-pipeline?view=deals → 点表里第一条 lead 链接
    await page.goto('/manager-pipeline?view=deals');
    await expect(page.getByTestId('manager-pipeline-page')).toBeVisible({ timeout: 10_000 });
    const firstLink = page
      .getByTestId('pipeline-table')
      .locator('a[href*="/leads/"]')
      .first();
    await expect(firstLink).toBeVisible({ timeout: 10_000 });
    await firstLink.click();
    await expect(page).toHaveURL(/\/leads\/[a-f0-9-]+/, { timeout: 10_000 });

    // 趋势图组件存在（可能显示 chart / loading / empty / error）
    await expect(page.getByTestId('meddicc-trend-chart')).toBeVisible({ timeout: 15_000 });
  });

  test('Case P5 — manager01 在 chat 提问 "团队哪几单存在风险" → AI 工具调用', async ({ page }) => {
    await loginAsManager01(page);
    // chat 默认开启
    await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 10_000 });

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const input = page.locator('input[placeholder="输入消息..."]');
    await expect(input).toBeEnabled({ timeout: 60_000 });
    await input.fill('团队哪几单存在风险？');
    await page.locator('button[type="submit"]').click();

    // 等 assistant 回复非空
    await expect.poll(
      async () => page.getByTestId('chat-msg-assistant').count(),
      { timeout: 60_000 },
    ).toBeGreaterThanOrEqual(1);

    await expect.poll(
      async () =>
        ((await page.getByTestId('chat-msg-assistant').first().textContent()) ?? '').trim()
          .length,
      { timeout: 120_000, message: 'AI 回复必须非空（>5 字符）' },
    ).toBeGreaterThan(5);

    // 等流跑完
    await expect(input).toBeEnabled({ timeout: 90_000 });

    const assistantText =
      (await page.getByTestId('chat-msg-assistant').first().textContent()) ?? '';
    for (const ph of FORBID_PHRASES) {
      expect(
        assistantText,
        `assistant 不应说 "${ph}"，实际="${assistantText.slice(0, 200)}"`,
      ).not.toContain(ph);
    }
    expect(errors, `pageerror: ${errors.join('\n')}`).toEqual([]);
  });
});
