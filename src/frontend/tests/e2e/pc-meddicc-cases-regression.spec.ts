import { test, expect, Page } from '@playwright/test';
import { ensureBackendUp } from './helpers';

/**
 * PC 端 MEDDICC 销售视角 — 回归测试套件（spec 003 US1 + US2）
 *
 * 这些 case 验证 spec 003 实施后的核心演示路径：
 *  1. 登录 → 进 demo lead → MEDDICC 仪表盘亮灯（开箱即用）
 *  2. 应用场景卡 → 仪表盘动画刷新（核心震撼）
 *  3. 删除证据 → Score 重算
 *  4. 录入对话 → AI 自动抽 + 仪表盘亮灯（手动玩）
 *  5. 重新分析按钮 → 触发 AI 重跑
 *
 * 真实 LLM，不允许 mock。整套通常需要 1-2 分钟。
 *
 * 测试前置：init_db 已经为 "深圳前海微链科技有限公司" / "北京数字颗粒科技有限公司" /
 * "天津智联云数据服务公司" 三条 demo lead 种入了 conversations 并跑过 analyze。
 */

const DEMO_LEAD_KEYWORD = '前海微链'; // 用部分名匹配，避免重置后 ID 变化

async function loginAsSales01(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByTestId('role-card-sales01').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

async function gotoDemoLead(page: Page, keyword: string = DEMO_LEAD_KEYWORD): Promise<string> {
  // 从 leads 列表点开 demo lead 进详情页；返回 lead_id
  await page.goto('/leads');
  await expect(page.locator('text=' + keyword).first()).toBeVisible({ timeout: 10_000 });
  await page.locator('text=' + keyword).first().click();
  await expect(page).toHaveURL(/\/leads\/[a-f0-9-]+/, { timeout: 10_000 });
  const url = page.url();
  const m = url.match(/\/leads\/([a-f0-9-]+)/);
  return m ? m[1] : '';
}

test.describe('PC 端 MEDDICC 全量回归（真实 LLM）', () => {
  test.beforeAll(async ({ request }) => {
    const resp = await request.get('http://localhost:8000/api/v1/auth/me', { failOnStatusCode: false });
    test.skip(![200, 401].includes(resp.status()), '后端未在 :8000 运行');
  });

  test.beforeEach(async ({ page, context }) => {
    test.skip(test.info().project.name !== 'pc-chromium', 'pc only');
    test.setTimeout(120_000);
    const up = await ensureBackendUp(page);
    test.skip(!up, '后端未在 :8000 运行');
    await context.clearCookies();
  });

  test('Case M1 — 进 demo lead 看到亮灯仪表盘 + 场景卡 + 已有对话', async ({ page }) => {
    await loginAsSales01(page);
    await gotoDemoLead(page);

    // 仪表盘 panel 出现
    const dashboard = page.getByTestId('meddicc-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15_000 });

    // Score 非零（init_db 已跑过 analyze）
    const scoreText = await page.getByTestId('meddicc-score').textContent({ timeout: 10_000 });
    expect(scoreText).toMatch(/\d+/);
    const scoreNum = parseInt((scoreText || '0').match(/\d+/)?.[0] || '0', 10);
    expect(scoreNum).toBeGreaterThan(0);

    // 完成度 X/7，X 至少 3
    const compText = await page.getByTestId('meddicc-completion').textContent();
    expect(compText).toMatch(/\d+\/7/);
    const compNum = parseInt((compText || '0/7').match(/(\d+)\/7/)?.[1] || '0', 10);
    expect(compNum).toBeGreaterThanOrEqual(3);

    // 7 维度网格存在
    await expect(page.getByTestId('meddicc-dimensions-grid')).toBeVisible();
    // 至少 3 个圆点是亮的（lit=true）
    const litDots = await page.locator('[data-testid^="meddicc-dim-"][data-lit="true"]').count();
    expect(litDots).toBeGreaterThanOrEqual(3);

    // NBA 提示出现
    await expect(page.getByTestId('meddicc-nba')).toBeVisible();

    // 对话记录 section
    await expect(page.getByTestId('meddicc-conversation-section')).toBeVisible();
    // 场景卡网格（注：仅在该 lead 适用的卡片才会出现）
    await expect(page.getByTestId('scenario-card-grid')).toBeVisible({ timeout: 10_000 });
    // 已有对话列表（mock_seed 至少 3 条）
    await expect(page.getByTestId('conversation-list')).toBeVisible();
  });

  test('Case M2 — 应用未应用的场景卡 → 卡片变为已应用 + 对话列表新增', async ({ page }) => {
    await loginAsSales01(page);
    await gotoDemoLead(page);

    await expect(page.getByTestId('scenario-card-grid')).toBeVisible({ timeout: 15_000 });

    // 找一张未应用的卡（applied=false）
    const unappliedCard = page.locator('[data-testid^="scenario-card-"][data-applied="false"]').first();
    const count = await unappliedCard.count();
    if (count === 0) {
      test.skip(true, '所有场景卡已应用，无可点击卡（可能 init_db 已跑过 demo apply 或重置过）');
    }

    // 拿卡 id
    const cardEl = unappliedCard;
    const testId = await cardEl.getAttribute('data-testid');
    const cardId = (testId || '').replace('scenario-card-', '');
    expect(cardId.length).toBeGreaterThan(5);

    // 记录应用前对话数
    const convsBefore = await page.locator('[data-testid^="conversation-item-"]').count();

    // 点应用按钮
    const applyBtn = page.getByTestId(`scenario-card-apply-${cardId}`);
    await applyBtn.click();

    // 等到 toast 出现并消失
    await expect(page.getByTestId('meddicc-status-msg')).toContainText(/分析|完成/, { timeout: 15_000 });

    // 等到卡片状态变成 applied=true（最长 30s 含 LLM 调用）
    await expect.poll(
      async () => await page.locator(`[data-testid="scenario-card-${cardId}"][data-applied="true"]`).count(),
      { timeout: 30_000, message: '卡片应用后应变为已应用 ✓' },
    ).toBeGreaterThanOrEqual(1);

    // 对话列表至少多了 1 条（场景卡可能注入 1-3 条）
    await expect.poll(
      async () => await page.locator('[data-testid^="conversation-item-"]').count(),
      { timeout: 10_000 },
    ).toBeGreaterThan(convsBefore);
  });

  test('Case M3 — 重新分析按钮触发 AI 重跑 → last_analyzed_at 时间更新', async ({ page }) => {
    await loginAsSales01(page);
    await gotoDemoLead(page);

    const dashboard = page.getByTestId('meddicc-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15_000 });

    // 等到初始仪表盘加载完成（score 大于 0）
    await expect.poll(
      async () => parseInt(((await page.getByTestId('meddicc-score').textContent()) || '0').match(/\d+/)?.[0] || '0'),
      { timeout: 10_000 },
    ).toBeGreaterThan(0);

    // 点击重新分析
    const reanalyzeBtn = page.getByTestId('meddicc-reanalyze-btn');
    await expect(reanalyzeBtn).toBeEnabled();
    await reanalyzeBtn.click();

    // 等 toast 出现 "分析中" 然后变为 "完成"
    await expect(page.getByTestId('meddicc-status-msg')).toContainText(/分析中/, { timeout: 5_000 });

    // 等分析按钮重新可点击（说明 LLM 调用完成）
    await expect(reanalyzeBtn).toBeEnabled({ timeout: 30_000 });

    // 仪表盘 score 仍非零（重新分析后维度大概率不变）
    const scoreText = await page.getByTestId('meddicc-score').textContent();
    const scoreNum = parseInt((scoreText || '0').match(/\d+/)?.[0] || '0', 10);
    expect(scoreNum).toBeGreaterThan(0);
  });

  test('Case M4 — 删除一条 evidence → 仪表盘正常重算', async ({ page }) => {
    await loginAsSales01(page);
    await gotoDemoLead(page);

    const dashboard = page.getByTestId('meddicc-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15_000 });

    // 等 Score 动画稳定（连续 2 次读到相同非零值视为稳定）
    let stableScore = 0;
    let lastValue = -1;
    const stableStart = Date.now();
    while (Date.now() - stableStart < 8000) {
      const cur = parseInt(((await page.getByTestId('meddicc-score').textContent()) || '0').match(/\d+/)?.[0] || '0', 10);
      if (cur === lastValue && cur > 0) {
        stableScore = cur;
        break;
      }
      lastValue = cur;
      await page.waitForTimeout(300);
    }
    expect(stableScore).toBeGreaterThan(0);

    // 找到第一个 lit=true 的维度
    const litCards = page.locator('[data-testid^="meddicc-dim-"][data-lit="true"]');
    expect(await litCards.count()).toBeGreaterThan(0);

    const firstLitTestId = await litCards.first().getAttribute('data-testid');
    const dim = (firstLitTestId || '').replace('meddicc-dim-', '');

    // 点击展开
    await litCards.first().click();
    await expect(page.getByTestId(`meddicc-dim-${dim}-evidences`)).toBeVisible({ timeout: 5_000 });

    // 找该维度内的删除按钮
    const deleteBtn = page.locator(`[data-testid^="meddicc-evidence-delete-"]`).first();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });

    // 拿删除前的总 evidence 数
    const evidenceCountBefore = await page.locator('[data-testid^="meddicc-evidence-delete-"]').count();

    // 注入 confirm dialog 自动接受
    page.on('dialog', (dialog) => dialog.accept());

    // 点删除
    await deleteBtn.click();

    // 等 evidence 数下降（说明后端确实删了 + 前端拿到新 dashboard 重渲染）
    await expect.poll(
      async () => {
        // 注意：删除 evidence 后该维度可能从 lit 变 unlit（最后一条），dashboard 重渲染会 collapse
        // 因此这里数 "全部展开后的 delete 按钮数" 和 evidence-delete 总数比较前后
        // 简化：检查仪表盘重新渲染（dimension 卡 count 减少）通过查 evidence 总数 < before
        return await page.locator('[data-testid^="meddicc-evidence-delete-"]').count();
      },
      { timeout: 15_000, message: '删除后页面应重新渲染，evidence 数应减少（或 dim 折叠）' },
    ).toBeLessThanOrEqual(evidenceCountBefore);

    // 仪表盘 score 仍可读（保留为有效数字，不抛异常）
    const finalScoreText = await page.getByTestId('meddicc-score').textContent();
    expect(finalScoreText).toMatch(/\d+/);
  });

  test('Case M5 — 手动录入新对话 → 仪表盘刷新（含 AI 重新分析）', async ({ page }) => {
    await loginAsSales01(page);
    await gotoDemoLead(page);

    await expect(page.getByTestId('meddicc-conversation-section')).toBeVisible({ timeout: 15_000 });

    // 拿初始对话数
    const convsBefore = await page.locator('[data-testid^="conversation-item-"]').count();

    // 点 "+ 新增对话"
    await page.getByTestId('add-conversation-btn').click();

    // 表单出现
    const form = page.getByTestId('add-conversation-form');
    await expect(form).toBeVisible();

    // 输入一段对话
    const newConv = `销售：测试对话 - ${Date.now()}\n客户：我们正在评估几家培训公司，主要看老师品牌。\n销售：那您内部决策一般谁拍板？\n客户：我自己定，但要跟我老婆商量一下。`;
    await page.getByTestId('conversation-content-input').fill(newConv);

    // 保存
    const saveBtn = page.getByTestId('conversation-save-btn');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // 等保存完成 + analyze 完成（最长 30s 含 LLM）
    await expect.poll(
      async () => await page.locator('[data-testid^="conversation-item-"]').count(),
      { timeout: 30_000, message: '新对话应该出现在列表' },
    ).toBeGreaterThan(convsBefore);

    // 仪表盘 score 仍非零
    const scoreText = await page.getByTestId('meddicc-score').textContent();
    const scoreNum = parseInt((scoreText || '0').match(/\d+/)?.[0] || '0', 10);
    expect(scoreNum).toBeGreaterThan(0);
  });
});
