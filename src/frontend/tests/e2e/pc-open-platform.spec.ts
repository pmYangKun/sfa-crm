import { test, expect } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * spec 005 US1/US2/US3/US5 —— PC 端开放平台回归。
 *
 * 移动端等价用例见 mobile-open-platform.spec.ts，两者路径必须完全对等，
 * 不允许出现任何"请到电脑上操作"的分支。
 */

test.describe('PC · /open 开放平台', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'pc-chromium', 'pc only');
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
  });

  test('首屏展示接入地址与两个身份入口，全程零注册', async ({ page }) => {
    await page.goto('/open');

    await expect(page.getByTestId('endpoint')).toContainText('/api/v1/mcp');
    await expect(page.getByTestId('persona-sales')).toBeVisible();
    await expect(page.getByTestId('persona-manager')).toBeVisible();

    // 没有任何注册/登录入口挡在前面
    await expect(page.getByTestId('issued-panel')).toHaveCount(0);
  });

  test('点身份 → 原地展开配置，不跳页', async ({ page }) => {
    await page.goto('/open');
    const urlBefore = page.url();

    await page.getByTestId('persona-manager').click();

    const panel = page.getByTestId('issued-panel');
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel).toContainText('主管');
    expect(page.url()).toBe(urlBefore); // 没跳页

    const snippet = page.getByTestId('config-snippet');
    await expect(snippet).toContainText('streamable_http');
    await expect(snippet).toContainText('Bearer sfa_ro_');
  });

  test('五个客户端各有配置，Codex 走环境变量', async ({ page }) => {
    await page.goto('/open');
    await page.getByTestId('persona-sales').click();
    await expect(page.getByTestId('issued-panel')).toBeVisible({ timeout: 15_000 });

    for (const id of ['workbuddy', 'claude-desktop', 'cursor']) {
      await page.getByTestId(`tab-${id}`).click();
      await expect(page.getByTestId('config-snippet')).toContainText('mcpServers');
    }

    await page.getByTestId('tab-claude-code').click();
    await expect(page.getByTestId('config-snippet')).toContainText('claude mcp add');

    // Codex 单独处理：凭证走环境变量，不内联进配置
    await page.getByTestId('tab-codex').click();
    const codex = page.getByTestId('config-snippet');
    await expect(codex).toContainText('export SFA_CRM_TOKEN');
    await expect(codex).toContainText('bearer_token_env_var');
  });

  test('复制按钮可用', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/open');

    await page.getByTestId('copy-endpoint').click();
    await expect(page.getByTestId('copy-endpoint')).toHaveAttribute(
      'data-copy-state',
      'ok',
    );
  });

  test('工具目录来自后端，恰好 9 个只读工具', async ({ page }) => {
    await page.goto('/open');

    const catalog = page.getByTestId('tool-catalog');
    await expect(catalog).toBeVisible({ timeout: 15_000 });
    await expect(catalog).toHaveAttribute('data-tool-count', '9');

    await expect(page.getByTestId('tool-scan_team_warnings')).toBeVisible();
    // 写操作工具绝不出现
    await expect(page.getByTestId('tool-navigate_create_lead')).toHaveCount(0);
  });

  test('示例问句区可见', async ({ page }) => {
    await page.goto('/open');
    await expect(page.getByTestId('sample-questions')).toBeVisible();
    await expect(page.getByTestId('sample-questions').locator('.q-item')).toHaveCount(6);
  });

  test('页脚三项声明齐全', async ({ page }) => {
    await page.goto('/open');
    const footer = page.getByTestId('open-footer');
    await expect(footer).toContainText('限流');
    await expect(footer).toContainText('每 30 分钟自动重置');
    await expect(footer).toContainText('不提供任何写入接口');
  });

  test('US5 · 工具契约页与接入文档页可达', async ({ page }) => {
    await page.goto('/open/tools');
    await expect(page.getByTestId('tool-catalog')).toHaveAttribute(
      'data-tool-count',
      '9',
      { timeout: 15_000 },
    );

    await page.goto('/open/docs');
    await expect(page.getByTestId('docs-clients')).toBeVisible();
    await expect(page.getByTestId('docs-codex')).toContainText('环境变量');
  });

  test('US5 · llms.txt 可被机器读取', async ({ page }) => {
    const res = await page.request.get('/open/llms.txt');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/plain');

    const body = await res.text();
    expect(body).toContain('/api/v1/mcp');
    expect(body).toContain('scan_team_warnings');
    expect(body).toContain('Authorization');
  });
});
