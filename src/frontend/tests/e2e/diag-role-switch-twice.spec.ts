import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * 回归：role-switch-confirm 模态在切换成功后再次打开，
 * busy state 必须复位（按钮可点、不显示"切换中..."）。
 *
 * 触发路径：sales01 → manager01 → 再点切回 sales01 卡片。
 */
test('PC: 角色切换两次，第二次模态按钮不能卡在 busy', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'pc-chromium', 'pc only');
  const up = await ensureBackendUp(page);
  test.skip(!up, '后端未在 :8000 运行');
  await context.clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // 1. 登录 sales01
  await page.getByTestId('role-card-sales01').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  // 2. 第一次切换：sales01 → manager01
  const switchCard1 = page.getByTestId('onboarding-card-s01-4');
  await expect(switchCard1).toBeVisible();
  await switchCard1.click();
  const confirmBtn1 = page.getByTestId('role-switch-confirm-btn');
  await expect(confirmBtn1).toBeVisible();
  await expect(confirmBtn1).toBeEnabled();
  await expect(confirmBtn1).toHaveText('确认切换');
  await confirmBtn1.click();

  // 等切换完成：onboarding 标题变成 manager01 的"陈队长"
  await expect(page.getByTestId('onboarding-panel')).toContainText('陈队长', { timeout: 10_000 });

  // 3. 第二次打开切换模态：必须可点、不显示"切换中..."
  const switchCard2 = page.getByTestId('onboarding-card-m01-3');
  await expect(switchCard2).toBeVisible();
  await switchCard2.click();
  const confirmBtn2 = page.getByTestId('role-switch-confirm-btn');
  await expect(confirmBtn2).toBeVisible();
  await expect(confirmBtn2).toBeEnabled();
  await expect(confirmBtn2).toHaveText('确认切换');
});
