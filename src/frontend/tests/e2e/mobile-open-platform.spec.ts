import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * spec 005 —— 移动端开放平台回归，与 pc-open-platform.spec.ts **完全对等**。
 *
 * 项目硬约束：移动端不是 PC 的简化版，是同一产品的等价入口。
 * 任何"移动端暂不支持 X"都是返工项，因此这里逐条覆盖 PC 上能做的每件事。
 */

test.describe('Mobile · /open 开放平台', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chromium', 'mobile only');
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
  });

  test('首屏在 390px 下不横向溢出', async ({ page }) => {
    await page.goto('/open');
    await expect(page.getByTestId('endpoint')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('身份卡在窄屏保持 2 列并排，不浪费横向空间', async ({ page }) => {
    await page.goto('/open');

    const sales = await page.getByTestId('persona-sales').boundingBox();
    const manager = await page.getByTestId('persona-manager').boundingBox();
    expect(sales).not.toBeNull();
    expect(manager).not.toBeNull();
    // 并排 = 垂直位置基本齐平
    expect(Math.abs(sales!.y - manager!.y)).toBeLessThan(24);
  });

  test('点身份 → 原地展开配置，不跳页', async ({ page }) => {
    await page.goto('/open');
    const urlBefore = page.url();

    await page.getByTestId('persona-manager').click();

    const panel = page.getByTestId('issued-panel');
    await expect(panel).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toBe(urlBefore);
    await expect(page.getByTestId('config-snippet')).toContainText('Bearer sfa_ro_');
  });

  test('五个客户端 tab 在移动端同样可切，Codex 差异同样呈现', async ({ page }) => {
    await page.goto('/open');
    await page.getByTestId('persona-sales').click();
    await expect(page.getByTestId('issued-panel')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('tab-claude-code').click();
    await expect(page.getByTestId('config-snippet')).toContainText('claude mcp add');

    await page.getByTestId('tab-codex').click();
    await expect(page.getByTestId('config-snippet')).toContainText('bearer_token_env_var');
  });

  test('复制按钮在移动端可用', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/open');

    await page.getByTestId('copy-endpoint').click();
    await expect(page.getByTestId('copy-endpoint')).toHaveAttribute(
      'data-copy-state',
      'ok',
    );
  });

  test('工具目录同样是 9 个，且无写操作工具', async ({ page }) => {
    await page.goto('/open');
    const catalog = page.getByTestId('tool-catalog');
    await expect(catalog).toBeVisible({ timeout: 15_000 });
    await expect(catalog).toHaveAttribute('data-tool-count', '9');
    await expect(page.getByTestId('tool-navigate_log_followup')).toHaveCount(0);
  });

  test('示例问句与页脚声明在移动端齐全', async ({ page }) => {
    await page.goto('/open');
    await expect(page.getByTestId('sample-questions').locator('.q-item')).toHaveCount(6);

    const footer = page.getByTestId('open-footer');
    await expect(footer).toContainText('不提供任何写入接口');
  });

  test('US5 · 契约页与文档页在移动端等价可用', async ({ page }) => {
    await page.goto('/open/tools');
    await expect(page.getByTestId('tool-catalog')).toHaveAttribute(
      'data-tool-count',
      '9',
      { timeout: 15_000 },
    );

    await page.goto('/open/docs');
    await expect(page.getByTestId('docs-clients')).toBeVisible();

    // 不允许出现任何把用户赶去 PC 的文案
    const text = (await page.textContent('body')) ?? '';
    expect(text).not.toContain('请到电脑');
    expect(text).not.toContain('暂不支持');
  });
});
