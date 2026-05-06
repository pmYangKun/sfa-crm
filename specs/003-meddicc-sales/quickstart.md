# Phase 1 Quickstart: MEDDICC 销售视角验收手册

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Date**: 2026-05-05

本文档定义 spec 003 实施完成后的**人工验收步骤**——按演示用户视角（公网访客 / 销售 / 经理）逐步走通主路径与边界路径。每步都有可观察的成功标志，对应 spec.md 的 SC（Success Criteria）。

---

## 一、前置条件

实施完成的最小验收门槛：

- [ ] 后端启动 `uvicorn` 无报错（`SQLModel.create_all()` 成功创建 `conversation` + `lead_meddicc_evidence` 表）
- [ ] 后端启动后 `lead` 表已新增 3 列（`meddicc_score / meddicc_completion / meddicc_last_analyzed_at`），既有数据保持完整
- [ ] 前端 `npm run build` 无 TypeScript 错误
- [ ] 后端 pytest 全绿（含本 spec 新增的 4 个测试文件）
- [ ] Playwright 全部用例通过（含本 spec 新增的 PC + Mobile 文件）
- [ ] `init_db` 跑完后种子数据齐全：3 条 demo lead 各有 3-5 条 mock_seed 对话 + 至少 4 个 dimension 亮灯

---

## 二、主路径验收（销售视角）

### Step 1 — 登录 + 进入 demo lead

**操作**：
1. 浏览器访问 `http://localhost:3000`（或公网 demo 站）
2. 登录页选 sales01（王小明），密码 12345
3. 跳转到 `/dashboard` → 点 "线索" → 进入 "深圳前海微链" 详情页

**预期结果**：
- ✅ 详情页加载成功
- ✅ 顶部 tab 列表中**新增**两个 tab："对话记录" / "MEDDICC 仪表盘"
- ✅ 默认 tab 行为不被破坏（沿用现有"联系人"/"跟进"/"关键事件"等 tab）

**对应 SC**: SC-001（5 秒内看到亮灯仪表盘）

---

### Step 2 — 查看 MEDDICC 仪表盘（开箱即用）

**操作**：
1. 点击 "MEDDICC 仪表盘" tab

**预期结果**：
- ✅ 顶部条显示：Score 在 50-90 之间（取决于种子数据质量）+ 完成度 X/7（X ≥ 4）+ "上次分析于 X 分钟前" + "重新分析" 按钮
- ✅ 7 维度卡片以 2 行 4/3 列网格呈现，至少 4 个维度亮灯（`is_lit: true`）
- ✅ 亮灯维度卡显示 evidence 条数（≥1）+ 第一条 evidence 文本预览
- ✅ 灰色维度卡显示 "0 条" + ⚠ 标记
- ✅ 底部 Next Best Action 提示卡片，针对最弱维度给一句建议

**对应 SC**: SC-001 / SC-005（重置后仍亮灯）

---

### Step 3 — 应用场景卡片（核心震撼）

**操作**：
1. 切换回 "对话记录" tab
2. 看到顶部场景卡片网格（5-7 张卡，至少 1-2 张状态是 "应用 →"，部分可能 "已应用 ✓"）
3. 点击任一未应用的场景卡的 "应用 →" 按钮

**预期结果**：
- ✅ 立刻看到 toast/loading "正在分析中..."
- ✅ 2-4 秒内 toast 变为 "✓ 完成"
- ✅ 该场景卡按钮变为 "已应用 ✓"（灰色 / 禁用）
- ✅ 对话列表新增 1-3 条带 "[来自场景卡]" 标签的对话
- ✅ 切回 MEDDICC 仪表盘 tab 看到：
  - Score 数字补间动画（从旧值跳到新值，约 800ms）
  - 圆点逐个亮起动画（按维度顺序，每 100ms 一个）
  - 完成度可能从 X/7 升到 X+1/7（如果该卡覆盖了之前未亮的维度）

**对应 SC**: SC-002（场景卡 ≤4 秒）/ SC-004（scenario_card_id 100% 可追溯）

---

### Step 4 — 手动新增对话（进阶用户）

**操作**：
1. 在 "对话记录" tab 找一条**没有任何对话**的 lead（例如新建一条 lead，或换一条种子库以外的 lead）
2. 点击 "+ 新增对话" 按钮
3. 弹窗内：
   - "对话时间" 默认填当前
   - "对话内容" textarea 粘贴一段约 500 字销售-客户多轮对话
4. 点 "保存"

**预期结果**：
- ✅ 弹窗关闭
- ✅ 对话列表立即新增该条对话（"[手动录入]" 标签）
- ✅ MEDDICC 仪表盘从全灰刷新到至少 1-2 个维度亮灯（耗时 2-4 秒）
- ✅ Score 从 0 跳数到非零值

**对应 SC**: spec.md User Story 2 的 Acceptance Scenario 1

---

### Step 5 — 删除单条证据 + 重新分析

**操作**：
1. 在 "MEDDICC 仪表盘" tab，点击某个亮灯维度卡（如 Pain）展开
2. 看到 evidence 列表，每条带 confidence 条 + 来源跳转链接 + 删除按钮
3. 点击其中一条的删除按钮 → 确认弹窗 → 确认

**预期结果**：
- ✅ 该条 evidence 立即从列表消失
- ✅ Pain 维度卡的 count 减 1
- ✅ 如果 Pain 仅剩 0 条，圆点变灰 + 完成度 -1
- ✅ Score 重新计算（小幅下降）

**操作（续）**：
4. 回到顶部条，点 "重新分析" 按钮

**预期结果**：
- ✅ Score / 完成度 / dimensions 全部重算
- ✅ 刚删除的 evidence 可能被 AI 重新抽出来（取决于 LLM 一致性）
- ✅ "上次分析于" 更新到当前时间

**对应 SC**: spec.md User Story 2 的 AS 2/3

---

### Step 6 — Chat 自然语言入口

**操作**：
1. PC 端在 chat sidebar，输入：`分析深圳前海微链这条线索`
2. 提交

**预期结果**：
- ✅ AI 先调 `search_leads` 找到 lead_id（流式显示中间步骤）
- ✅ AI 再调 `analyze_meddicc(lead_id)` 工具
- ✅ 返回后 chat 渲染 `ChatMeddiccReportCard` 组件，含：
  - 公司名 + Score 大字
  - 7 维度紧凑列表（圆点 + 维度名 + 证据数）
  - Next Best Action 提示
  - "去仪表盘 →" 按钮（点击跳到 PC tab）+ "重新分析" 按钮
- ✅ 端到端时长 ≤5 秒

**对应 SC**: SC-008（chat 识别率 >90%）/ User Story 3

---

### Step 7 — Mobile 端浏览（简版）

**操作**：
1. 浏览器切换到移动端视图（DevTools 模拟 / 真机访问 `/m/login`）
2. 登录 sales01
3. 进入 "深圳前海微链" 移动详情页 (`/m/leads/[id]`)

**预期结果**：
- ✅ 页面顶部显示 lead 基本信息
- ✅ 下方有两个折叠卡：
  - "对话记录 (5)"（默认折叠）
  - "MEDDICC 仪表盘 (Score 78)"（默认展开）
- ✅ 仪表盘卡内：Score 顶部条 + 7 维度纵向 list（圆点 + 维度名 + 证据数）+ "重新分析" 按钮
- ✅ **不显示场景卡片网格**（FR-028）
- ✅ 维度卡可点击展开看 evidence 列表（移动端**只读**，无删除按钮）

**操作（续）**：
4. 切到 chat fullscreen tab，输入 `分析这条线索`
5. 看到渲染的 `ChatMeddiccReportCard`（Mobile 版垂直布局）

**预期结果**：
- ✅ 卡片渲染正常，关键信息保留（可能字号缩小）
- ✅ "去仪表盘 →" 按钮跳转到 `/m/leads/[id]` 折叠卡

**对应 SC**: SC-007（Mobile 折叠面板 < 1s）/ User Story 4

---

## 三、边界路径验收

### Edge 1 — 空 Lead 触发 analyze

**操作**：
1. 在一条 0 对话 / 0 跟进 / 0 事件的 lead 上点 "重新分析"

**预期结果**：
- ✅ 不调 LLM（后端日志无 LLM 调用记录）
- ✅ 仪表盘保持全灰 + Score 0
- ✅ 提示文案 "线索暂无对话/跟进/事件记录，请先录入"

**对应 FR**: FR-010

---

### Edge 2 — LLM 幻觉 source_id

**操作**（需 mock 测试场景）：
1. pytest 中 mock LLM 返回包含 1 个不存在 source_id 的 evidence

**预期结果**：
- ✅ post-validate 跳过该条 evidence（不入库）
- ✅ 日志记录 "hallucinated source_id: ..."
- ✅ API 响应 `evidence_count` 减 1，`skipped_count` +1

**对应 FR**: FR-008 / research.md Decision 6

---

### Edge 3 — 限流命中

**操作**：
1. sales01 用脚本 1 分钟内连续 12 次点 "重新分析"

**预期结果**：
- ✅ 第 11 次开始返回 HTTP 429
- ✅ 前端显示友好气泡 "请求过于频繁，请稍后再试"
- ✅ chat_audit 表记录所有 12 次（含被拒的 2 次）

**对应 FR**: FR-020

---

### Edge 4 — 全局 LLM 熔断

**操作**：
1. 模拟全站 1 小时内累计 LLM 调用超 200 次

**预期结果**：
- ✅ 第 201 次调用（任何用户的 analyze / apply）返回 503
- ✅ 错误响应含 `code: "llm_circuit_open"` + `retry_after_seconds`
- ✅ 前端显示 "演示站当前调用量较高，请稍后再试"

**对应 FR**: FR-020 / research.md Decision 7

---

### Edge 5 — 跨 owner 数据权限

**操作**：
1. sales01 登录，尝试 GET / POST / DELETE 一个属于 sales02 的 lead 的 conversation / evidence

**预期结果**：
- ✅ GET 返回 403 / 404（DataScope 过滤）
- ✅ POST / DELETE 返回 403

**对应 FR**: FR-021

---

### Edge 6 — 半小时数据重置

**操作**：
1. 演示用户在 demo lead 上应用 2 张场景卡 + 删除 1 条 evidence
2. 等到下一个 30 分钟整点
3. 重新登录访问相同 demo lead

**预期结果**：
- ✅ 之前应用的场景卡的对话已被清空
- ✅ 删除过的 evidence 重新出现（init_db 重跑 analyze）
- ✅ Score 恢复到种子状态（约 50-90）

**对应 FR**: FR-033 / SC-005

---

### Edge 7 — 重复应用场景卡

**操作**：
1. 在某 demo lead 上应用 "拜访赵总" 卡片
2. 等待完成 → 卡片状态变 "已应用 ✓"（按钮 disabled）
3. 用 DevTools 强行调 POST `/scenario-cards/{id}/apply` 同一卡 id

**预期结果**：
- ✅ HTTP 400 + `detail: "该卡已应用过，无需重复"`
- ✅ 不重复插入对话
- ✅ 不调 LLM

**对应 FR**: 防重复机制（spec.md Edge Cases 第 6 条）

---

## 四、性能验收

| 指标 | 目标 | 测量方式 |
|---|---|---|
| /meddicc/analyze P95 延迟 | ≤ 4s | Playwright 重复 20 次 / 取 p95 |
| /scenario-cards/{id}/apply P95 延迟 | ≤ 4s | 同上 |
| /meddicc GET 响应 | < 500ms | DevTools Network |
| Mobile 折叠面板首屏 | < 1s | Lighthouse 移动模式 |
| chat 识别 → 卡片渲染 | ≤ 5s | 真实 LLM 调用 |
| 50+ conversation lead 的 analyze | ≤ 5s | pytest 集成测试 |

**测量工具**：
- API 性能：Playwright + `performance.now()` 包裹 fetch
- 前端首屏：DevTools Lighthouse / Performance tab
- 后端：Loguru 写入日志的 `latency_ms` 字段

---

## 五、退路与回滚

如果 spec 003 实施过程中发现重大问题：

| 问题 | 回滚方案 |
|---|---|
| LLM 抽证据完全不工作 | 沿用 spec 002 状态——把 `meddicc/analyze` 端点直接 503 + 前端隐藏 MEDDICC tab |
| Replace 策略导致数据丢失 | 不支持回滚（按 spec 设计每次重算）；演示数据 30min 重置兜底 |
| 限流策略过严误伤 | 调高 SystemConfig 的 `llm_user_minute_limit / llm_user_daily_limit` |
| 场景卡剧本翻车 | 在 `scenario_cards.py` 直接修改 dict + 重启 uvicorn 即生效 |
| 前端动画体验差 | 把 `shouldAnimate` flag 默认设 `false`，仪表盘静态显示也能交付 |

---

## 六、Demo 演示脚本（建议）

**演示给读者看时的 5 分钟剧本**：

1. **0:00-0:30** — 登录页讲解（sales01 角色卡），强调"销售视角"
2. **0:30-1:00** — 进入"深圳前海微链"详情页，展示对话记录 tab + MEDDICC 仪表盘 tab，**强调"已经亮灯"是种子状态**
3. **1:00-1:30** — 切到 MEDDICC 仪表盘，逐个圆点解释 7 字段培训行业含义；点开某维度看 evidence + confidence + 来源
4. **1:30-2:30** — 切回对话记录，**点击场景卡 "拜访赵总"** → 看到动画刷新（演示精华）
5. **2:30-3:30** — 切到 chat sidebar，输入"分析深圳前海微链" → 看到 ChatMeddiccReportCard 渲染
6. **3:30-4:30** — 进入空 lead，**手动粘贴一段对话** → 看到从空到亮的过程
7. **4:30-5:00** — 移动端切换演示 + 收尾"这是真正可用的对话式 CRM"

---

## 七、quickstart.md 完成状态

✅ 7 步主路径覆盖 4 个 User Stories（P1-P4）
✅ 7 个 Edge Cases 验收
✅ 6 项性能指标 + 测量方式
✅ 5 个退路 / 回滚方案
✅ 5 分钟 demo 剧本

**下一步**：commit Phase 0/1 全部产出（plan.md + research.md + data-model.md + contracts/ + quickstart.md）→ 用户 review → 进入 `/speckit.tasks` 拆任务清单。
