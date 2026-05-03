import { test, expect, Route } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * US3: 移动端 Copilot 写类操作（chat 内嵌待确认卡片 + 抽屉表单）
 * 覆盖 spec.md FR-022 ~ FR-027
 */

/** Mock /api/chat 返回带 [[nav:...]] 标记的 assistant 回复 */
async function mockChatWithNav(page: import('@playwright/test').Page, navText: string) {
  await page.route('**/api/chat', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: navText,
    });
  });
}

/** Mock POST /api/v1/leads 返回 fake id */
async function mockCreateLead(page: import('@playwright/test').Page, fakeId: string) {
  await page.route('**/api/v1/leads', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: fakeId, company_name: 'mocked', region: '华南', status: 'active' }),
      });
    } else {
      await route.continue();
    }
  });
}

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

async function loginAsSales01(page: import('@playwright/test').Page) {
  await page.goto('/m/login');
  await page.getByTestId('role-card-sales01').click();
  await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 10_000 });
}

test.describe('US3: chat 内嵌待确认卡片', () => {
  test('FR-022/023: AI 返回 nav 标记 → 渲染 ChatFormCard 而非 nav 按钮', async ({ page }) => {
    await mockChatWithNav(
      page,
      '已为你预填了线索资料，请审核：[[nav:新建线索|/leads/new?company_name=深圳前海微链&region=华南&source=referral]]',
    );

    await loginAsSales01(page);
    await page.fill('input[placeholder="向 AI 提问..."]', '帮我建一条深圳前海微链的线索');
    await page.click('button[type="submit"]');

    // 卡片出现且为待确认态
    await expect(page.locator('[data-testid^="chat-form-card-"]').first()).toBeVisible({ timeout: 5000 });
    const card = page.locator('[data-testid^="chat-form-card-"]').first();
    await expect(card).toContainText('新建线索');
    await expect(card).toContainText('深圳前海微链');
    await expect(card).toHaveAttribute('data-card-status', 'pending');
    await page.screenshot({ path: 'tests/screenshots/us3-01-chat-form-card-pending.png', fullPage: true });
  });

  test('FR-024/025: 点卡片 → 抽屉打开 → 改字段 → 提交 → 卡片变 submitted', async ({ page }) => {
    await mockChatWithNav(
      page,
      '请审核：[[nav:新建线索|/leads/new?company_name=深圳前海微链&region=华南&source=referral]]',
    );
    await mockCreateLead(page, '11111111-2222-3333-4444-555555555555');

    await loginAsSales01(page);
    await page.fill('input[placeholder="向 AI 提问..."]', '建条线索');
    await page.click('button[type="submit"]');

    const card = page.locator('[data-testid^="chat-form-card-"]').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    // 抽屉打开
    await expect(page.getByTestId('mobile-form-sheet')).toBeVisible();
    await expect(page.getByTestId('sheet-field-company_name')).toHaveValue('深圳前海微链');
    await page.screenshot({ path: 'tests/screenshots/us3-02-form-sheet-open.png', fullPage: true });

    // 改字段
    await page.getByTestId('sheet-field-company_name').fill('深圳前海微链科技');

    // 提交
    await page.getByTestId('sheet-submit').click();

    // 抽屉关闭，卡片变 submitted
    await expect(page.getByTestId('mobile-form-sheet')).toHaveCount(0, { timeout: 5000 });
    await expect(card).toHaveAttribute('data-card-status', 'submitted', { timeout: 5000 });
    await expect(card).toContainText('已创建');
    await page.screenshot({ path: 'tests/screenshots/us3-03-card-submitted.png', fullPage: true });
  });

  test('FR-026: 抽屉关闭不丢失编辑值', async ({ page }) => {
    await mockChatWithNav(
      page,
      '请审核：[[nav:新建线索|/leads/new?company_name=深圳前海微链&region=华南]]',
    );

    await loginAsSales01(page);
    await page.fill('input[placeholder="向 AI 提问..."]', '建条线索');
    await page.click('button[type="submit"]');

    const card = page.locator('[data-testid^="chat-form-card-"]').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    // 改字段
    await page.getByTestId('sheet-field-company_name').fill('编辑后的名字');

    // 关闭抽屉（点 X）
    await page.locator('[data-testid="mobile-form-sheet"] button:has-text("✕")').click();
    await expect(page.getByTestId('mobile-form-sheet')).toHaveCount(0);

    // 卡片仍然 pending（未提交）
    await expect(card).toHaveAttribute('data-card-status', 'pending');

    // 重新打开抽屉，编辑值仍在
    await card.click();
    await expect(page.getByTestId('mobile-form-sheet')).toBeVisible();
    await expect(page.getByTestId('sheet-field-company_name')).toHaveValue('编辑后的名字');
  });

  test('FR-027: 多张卡片状态独立', async ({ page }) => {
    await mockChatWithNav(
      page,
      '同时建两个：[[nav:新建线索|/leads/new?company_name=A 公司&region=华南]] 和 [[nav:新建线索|/leads/new?company_name=B 公司&region=华北]]',
    );
    await mockCreateLead(page, '11111111-2222-3333-4444-555555555555');

    await loginAsSales01(page);
    await page.fill('input[placeholder="向 AI 提问..."]', '建两条');
    await page.click('button[type="submit"]');

    const cards = page.locator('[data-testid^="chat-form-card-"]');
    await expect(cards).toHaveCount(2, { timeout: 5000 });
    await expect(cards.nth(0)).toContainText('A 公司');
    await expect(cards.nth(1)).toContainText('B 公司');
    await page.screenshot({ path: 'tests/screenshots/us3-04-two-cards.png', fullPage: true });

    // 提交第一张
    await cards.nth(0).click();
    await page.getByTestId('sheet-submit').click();
    await expect(page.getByTestId('mobile-form-sheet')).toHaveCount(0, { timeout: 5000 });

    // 第一张 submitted，第二张仍 pending
    await expect(cards.nth(0)).toHaveAttribute('data-card-status', 'submitted', { timeout: 5000 });
    await expect(cards.nth(1)).toHaveAttribute('data-card-status', 'pending');
  });
});
