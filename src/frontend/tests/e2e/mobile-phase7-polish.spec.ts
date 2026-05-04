import { test, expect, Route } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * Phase 7 Polish — edge case 验证
 *  T084 AI 预填字段缺失：必填字段红色标记 + 阻止 submit
 *  T085 跨端切换：移动视口下触发 PC layout 弹移动跳转 + 反向
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

test.describe('Phase 7 / T084: AI 预填字段缺失', () => {
  test('AI 只给 company_name，缺 region / source → 必填字段红标 + 阻止提交', async ({ page }) => {
    await page.route('**/api/chat', async (route: Route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: '请审核：[[nav:新建线索|/leads/new?company_name=深圳前海微链]]',
      });
    });

    await page.goto('/m/login');
    await page.getByTestId('role-card-sales01').click();
    await expect(page.getByTestId('chat-fullscreen')).toBeVisible({ timeout: 10_000 });

    await page.fill('input[placeholder="向 AI 提问..."]', 'test');
    await page.click('button[type="submit"]');

    const card = page.locator('[data-testid^="chat-form-card-"]').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    await expect(page.getByTestId('mobile-form-sheet')).toBeVisible();

    // 必填字段被自动加进来（即使 AI 没提供）
    await expect(page.getByTestId('sheet-field-region')).toBeVisible();
    await expect(page.getByTestId('sheet-field-source')).toBeVisible();
    // company_name 已填
    await expect(page.getByTestId('sheet-field-company_name')).toHaveValue('深圳前海微链');

    // region/source 红色 missing 标记
    const regionWrap = page.locator('[data-field-missing="true"]').first();
    await expect(regionWrap).toBeVisible();

    // 直接点提交，应被阻止 + 显示错误
    await page.getByTestId('sheet-submit').click();
    await expect(page.getByTestId('mobile-form-sheet')).toBeVisible();
    await expect(page.getByText('请填完红色标记的必填字段')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/phase7-01-missing-fields.png', fullPage: true });
  });
});

test.describe('Phase 7 / T085: 跨端切换体验', () => {
  test('PC 视口下访问 /m/* 自动弹回 PC 等价路由', async ({ page, request }) => {
    // 用 PC chromium 项目跑这个测试更合适，但本 file 在 mobile project 下。
    // 单独切换 viewport 触发反向跳转。
    await page.setViewportSize({ width: 1440, height: 900 });

    const loginRes = await request.post('http://localhost:8000/api/v1/auth/login', {
      data: { login: 'sales01', password: '12345' },
    });
    const { access_token } = await loginRes.json();

    await page.goto('/m/login');
    await page.evaluate(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('login_name', 'sales01');
    }, { token: access_token });

    await page.goto('/m/leads');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/leads');
    expect(page.url()).not.toContain('/m/leads');
  });
});
