import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * Phase 2 视觉验证：移动端骨架（MobileShell / KingKongTabbar / m/login 占位 / 跨端跳转）
 *
 * Phase 2 限制：
 * - (mobile-app)/chat/page.tsx 等内部 page 未建（属于 T024-T029，US2 范围）
 * - 因此 MobileShell layout 在 Phase 2 还没有任何 page 真正穿过它，鉴权门 / 金刚区
 *   完整渲染需要等 US2 完工后才能视觉验收
 *
 * 本 spec 仅做能可靠验证的部分。US2 完工后将被 us2-mobile-onboarding.spec.ts 替换 / 删除。
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

test.describe('Phase 2: 移动端骨架视觉验证', () => {
  test('/m/login 在移动视口下渲染占位页面', async ({ page }) => {
    await page.goto('/m/login');
    await expect(page.getByTestId('mobile-login-placeholder')).toBeVisible();
    await expect(page.getByText('移动端登录页')).toBeVisible();
    await page.screenshot({
      path: 'tests/screenshots/phase2-01-mobile-login-placeholder.png',
      fullPage: true,
    });
  });

  test('已登录用户访问 /dashboard 在移动视口下被 PC layout 弹去 /m/* 等价路由', async ({
    page,
    request,
  }) => {
    const loginRes = await request.post('http://localhost:8000/api/v1/auth/login', {
      data: { login: 'sales01', password: '12345' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { access_token } = await loginRes.json();

    await page.goto('/m/login');
    await page.evaluate(
      ({ token }) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('login_name', 'sales01');
      },
      { token: access_token },
    );

    // 在移动视口下访问 PC dashboard：PC layout 的视口检测应弹去 /m/chat
    // /m/chat 还没 page（404），但 URL 替换本身是 PC layout 视口门做的工作
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    // 期待 URL 已被替换为 /m/chat（不强断言 page 内容，因为 page 还没建）
    expect(page.url()).toContain('/m/chat');
    await page.screenshot({
      path: 'tests/screenshots/phase2-02-pc-to-mobile-redirect.png',
      fullPage: true,
    });
  });
});
