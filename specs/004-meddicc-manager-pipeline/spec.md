# Spec 004: MEDDICC 经理过程管理（Manager Pipeline）

**Status:** Draft
**Created:** 2026-05-07
**Branch:** `004-meddicc-manager-pipeline`
**Alignment:** `inputs/alignment.md`

---

## 1. Problem Statement

spec 003 已经做完销售视角的 MEDDICC 自检（一线销售看自己 lead 的 7 维证据 + Score）。**经理视角缺位：** manager01 进系统后没有"看团队整体 Pipeline + 一眼识别哪条 deal 在崩 + 反查销售是否吹牛"的工具。

要解决：
- 经理日常 review 团队 deal 健康度的工具（Pipeline 全表 + Warnings + Forecast 分组）
- 销售拍胸脯把 forecast_category 标"必赢"时，系统能用 MEDDICC 证据反问一句的能力
- 经理用 Chat 取数（"团队哪几单存在风险"）的能力
- 单 lead 长期演化的可视化（趋势图）

## 2. Goals (Top 3)

1. **经理一打开 Pipeline 全表 30 秒内能识别"今天哪 3 单要崩"**——通过 Score 排序 + Warnings 列 + 7 圆点视觉
2. **销售/经理把 forecast_category 升级到必赢/大概率时，如果 MEDDICC 证据不足，AI 反问一句**——HITL 边界的延伸（沿用 spec 002 立的 AI 不直接改主数据原则）
3. **经理用 Chat 一句话取出团队级洞察**——"团队哪几单存在风险" / "MEDDICC 完成度怎么样" / "今天我该重点看哪几条"

## 3. Non-Goals (明确不做)

- ❌ 完整 Sales Forecasting 体系（多层提报链 / 准确率回测 / Quota Coverage）—— 远期独立 spec
- ❌ Sales Stage / 商机阶段字段 —— 用 MEDDICC 完成度替代
- ❌ Pipeline 全表常驻 sparkle ✨ AI 校准建议 —— 仅触发式校验（spec 005+ 升级）
- ❌ Mitigation 文字 AI 实时生成 —— 先硬编码模板（spec 005+ 升级）
- ❌ 团队级趋势图（按周展示团队均值）—— 单 lead 趋势图够
- ❌ Rep Coaching / 跨销售员对比 —— 后续主题攻势
- ❌ AI 主动巡检 cron / 每日报告 —— 后续主题攻势
- ❌ Warning 工作流（已知道 / 已忽略状态机）—— 自动消除

## 4. User Stories

### US1 [P0]: 经理在 Pipeline 全表浏览团队所有 lead

**As a** 销售经理（manager01）
**I want to** 进入 Pipeline 全表页面，按 Forecast Category 分组查看团队所有 active lead
**So that I can** 一眼看清楚团队当下 pipeline 分布 + 识别风险

**Acceptance Criteria:**
- 进 `/manager-pipeline`（PC）或 `/m/manager-pipeline`（移动端）默认显示 Deals 视图
- 顶部 6 个 Forecast Categories tab：进行中 / 必赢 / 大概率 / 乐观估算 / 已赢单 / 已丢单
- 每个 tab 标题显示当前 tab 命中条数 + ⚠️ Warnings 数（如"必赢 (3) ⚠️ 1"）
- 默认选中"进行中"tab
- 主表列：deal name / 备注 / Score / Warnings / MEDDICC 7 圆点 / Activity / Next Call / 金额 / 负责人
- 默认排序：Score 升序（最不健康浮顶）
- DataScope：仅显示 manager01 名下 sales 名下的 lead

### US2 [P0]: 经理看到 deal-level Warnings 并一眼识别风险

**As a** 销售经理
**I want to** 在 Pipeline 全表看到每条 lead 命中的 Warnings 数 + hover 看具体哪几条 + 看到 mitigation 建议
**So that I can** 立即决定是否需要找销售追问 / 给建议

**Acceptance Criteria:**
- 主表 "Warnings" 列对每条 lead 显示 ⚠️ N（N = 命中规则数）
- N=0 显示空白（无 Warning）
- Hover Warnings 单元格显示 tooltip 列出命中的 Warning code + mitigation 简短文字
- 点击 deal 进入详情页能看到完整 Warning 列表 + 每条详细 mitigation
- Warnings 自动消除：条件不再满足时自动从该 deal 上消失（无需手动 dismiss）
- 7 条 Warning 触发条件全部按 `system_config` 阈值（不 hardcode）

### US3 [P1]: 销售/经理升级 forecast_category 到必赢/大概率时 AI 校验

**As a** 销售或销售经理
**I want to** 把某条 lead 的 forecast_category 升级到"必赢"或"大概率"时，如果 MEDDICC 证据不足，AI 反问一句
**So that I can** 避免拍胸脯吹牛，保持销售预测质量

**Acceptance Criteria:**
- forecast_category 从其他值改成"必赢"或"大概率"时触发 AI 校验
- AI 校验调 LLM 看 MEDDICC 7 维证据 + 跟进记录，输出 verdict (support / challenge / abstain) + reasoning + suggested_category
- verdict=challenge 时弹 dialog（PC）或全屏 dialog（Mobile）：
  - 显示 reasoning + missing_dimensions + suggested_category
  - 3 个按钮：[继续标"目标值"] / [改标"建议值"] / [先去补证据]
- verdict=support 或 abstain 直接放行（不弹气泡）
- LLM 调用 3 秒超时直接放行 + toast "AI 暂时校验不上，已放行"
- 同一 lead 60 秒内不重复弹（去重 cache）
- 销售 / 经理两边都触发（system prompt 自适应文案）

### US4 [P0]: 经理切到 Team 视图按销售员聚合查看

**As a** 销售经理
**I want to** 切换到 Team 视图，按销售员聚合看每个下属的健康度
**So that I can** 识别哪个销售在崩，下钻去看具体 deal

**Acceptance Criteria:**
- 主表顶右有 Deals / Team toggle 切换
- Team 视图行 = sales 员工：列 Sales（含头像）/ Active leads 数 / 平均 Score / Warnings 数 / 总金额 / 最近活动
- 默认排序：平均 Score 升序
- 点击 sales 行 drill-down → 切回 Deals 视图 + 自动 filter owner=该 sales
- DataScope：manager 看名下 sales，admin 看全公司，sales 不显示 Team 视图（或仅显示自己一行）

### US5 [P1]: 单 lead 详情页看 MEDDICC Score 趋势图

**As a** 销售或销售经理
**I want to** 进入某条 lead 详情页时看到这条 deal 的 MEDDICC Score 历史趋势
**So that I can** 复盘这条 deal 怎么演化的、判断当前是上升趋势还是下降趋势

**Acceptance Criteria:**
- lead 详情页右上角显示一张 200×120 的小折线图
- 横轴：snapshot_at（最近 30 天）
- 纵轴：meddicc_score（0-100）
- 数据源：`lead_meddicc_history` 快照表
- Hover 数据点显示精确时间 + Score
- 数据点 < 2 时显示空状态文字"暂无趋势数据"
- 移动端宽度自适应

### US6 [P0]: 经理用 Chat 提问团队级问题

**As a** 销售经理
**I want to** 用 Chat 提团队级问题（"团队哪几单存在风险" / "团队 MEDDICC 完成度怎么样"）
**So that I can** 不必手动 filter / 排序，AI 一句话给我答案

**Acceptance Criteria:**
- Chat 识别 manager 角色 + 团队级问题，自动调对应 tool
- 4 个新 tool 可用：
  - `scan_team_warnings` 团队风险扫描
  - `team_meddicc_summary` 团队 MEDDICC 概览
  - `top_attention_deals` Top N 重点关注
  - `forecast_category_distribution` Pipeline 分布
- AI 答完跟具体 deal/sales 相关时必带 [[nav:|/manager-pipeline?...]] 跳转链接
- 不在 Chat 直接修改主数据（沿用 spec 002 HITL 边界）

### US7 [P0]: 移动端等价体验

**As a** 销售或销售经理
**I want to** 在手机上完成 PC 上能做的所有 Pipeline 操作
**So that I can** 路上 / 地铁 / 出差时也能照常 review

**Acceptance Criteria:**
- 全部 PC 功能在移动端可用（Pipeline 全表 / Forecast tab / Warnings / 行内编辑 / AI 校验 / Team Rollup / 趋势图 / Chat）
- 形态调整：
  - Pipeline 全表 → 卡片列表（每条 deal 一张紧凑卡）
  - Forecast Categories 6 tab → 横滑切换
  - 行内编辑 → BottomSheet（沿用 spec 003 MobileFormSheet）
  - AI 校验气泡 → 全屏 dialog
  - Team Rollup → sales 卡片栈
- e2e 双套：PC chrome + Mobile chrome 各跑一遍

---

## 5. Functional Requirements

### Data Model

- **FR-001**: `lead` 表 MUST 新增 3 个可空字段 `amount` (REAL) / `close_date` (TEXT, ISO date) / `forecast_category` (TEXT, default '进行中', CHECK constraint)
- **FR-002**: `lead.forecast_category` 仅当 `stage='active'` 时有效；`stage='converted'` 时强制视为'已赢单'，`stage='lost'` 时强制视为'已丢单'
- **FR-003**: 系统 MUST 新建 `lead_meddicc_history` 快照表（schema 见 alignment.md §4.3）
- **FR-004**: 系统 MUST 在 `system_config` 表新增 7 条 warning 阈值 + 5 条 spec 003 迁移阈值（见 alignment.md §4.4）
- **FR-005**: lead 转化逻辑 MUST 保留 lead 行（不归档迁移）—— 沿用现状

### Warnings Engine

- **FR-006**: 系统 MUST 实现 7 条硬编码规则（见 alignment.md §5.1）
- **FR-007**: Warnings 计算时机 MUST 是 lazy compute on read（无 cron）
- **FR-008**: 单条 Pipeline 查询触发的 Warning 计算 MUST 在 100 lead 量级 < 50ms
- **FR-009**: Warning 自动消除——条件不再满足即从该 lead 移除
- **FR-010**: mitigation 文字 MUST 是硬编码模板（占位符 `{N}` / `{缺失维度}` / `{amount}` 渲染时填入）
- **FR-011**: 7 条规则的阈值 MUST 全部从 `system_config` 读取（admin 可调）

### AI 校验 forecast_category

- **FR-012**: 系统 MUST 提供 `POST /api/leads/{lead_id}/validate-forecast` 接口
- **FR-013**: forecast_category 升级到'必赢'/'大概率'时 MUST 在 PUT 之前触发 AI 校验
- **FR-014**: AI 校验调用 LLM 输出 schema：`{verdict, reasoning, suggested_category, missing_dimensions}`
- **FR-015**: AI 校验 timeout 3 秒；超时直接放行 + toast 提示
- **FR-016**: 同一 lead 60 秒内 AI 校验 MUST 命中 cache（去重）
- **FR-017**: AI 校验 NOT 触发于：降级 / 改成"进行中"/"已赢单"/"已丢单"

### Trend Snapshot

- **FR-018**: 系统 MUST 在每次 `analyze_meddicc(lead_id)` 调用后写一行 history snapshot
- **FR-019**: 系统 MUST 在每次 `lead.forecast_category` 变更时写一行 snapshot
- **FR-020**: 启动 spec 004 时 MUST 异步 backfill 一遍（对 stage='active' lead 跑 analyze + 写 baseline）
- **FR-021**: backfill MUST 不阻塞应用启动；前端在 backfill 期间显示"趋势数据准备中"占位
- **FR-022**: snapshot 永久保留（不轮删）

### Pipeline + Team Rollup

- **FR-023**: 系统 MUST 提供 `GET /api/manager/pipeline` 接口（返回团队 lead + warnings count + meddicc info）
- **FR-024**: `GET /api/manager/pipeline` MUST 应用 DataScope（manager 看下属，admin 全看，sales 仅自己）
- **FR-025**: 系统 MUST 提供 `GET /api/manager/team-rollup` 接口（返回 sales 维度聚合）
- **FR-026**: Pipeline 主表默认排序 Score 升序；Team Rollup 默认排序 平均 Score 升序

### Chat 升级

- **FR-027**: 系统 MUST 在 chat agent 注册 4 个新 tool：`scan_team_warnings` / `team_meddicc_summary` / `top_attention_deals` / `forecast_category_distribution`
- **FR-028**: 经理 system prompt MUST 微调以识别团队级问题
- **FR-029**: 经理 chat 答完团队 / 个人 deal 问题 MUST 带 [[nav:|url]] 跳转链接

### UI

- **FR-030**: PC `/manager-pipeline` 页面 MUST 实现单页 Gong 镜像（顶部 Forecast 6 tab + Deals/Team toggle + 主表）
- **FR-031**: Mobile `/m/manager-pipeline` 页面 MUST 实现卡片化等价体验
- **FR-032**: lead 详情页 MUST 显示 MEDDICC Score 趋势小折线图（PC + Mobile）
- **FR-033**: forecast_category / amount / close_date 行内编辑 PC 直接 click-to-edit / Mobile 弹 BottomSheet
- **FR-034**: AI 校验气泡 PC dialog / Mobile 全屏 dialog
- **FR-035**: Forecast Categories tabs 仅显示条数 + ⚠️ Warning 数，**不显示金额聚合**（避免滑向 Forecasting）

### Permission / DataScope

- **FR-036**: 沿用 spec 003 既有 DataScope 模型，无新权限
- **FR-037**: manager 仅可对自己名下 sales 名下的 lead 修改 forecast_category；admin 可对全公司

### Performance / Limits

- **FR-038**: AI 校验 LLM 调用 MUST 沿用 spec 002 限流（10/min per user, 100/day per user, 200/hour 全站）
- **FR-039**: backfill 时长估算 100 leads × 30s ≈ 50 min；MUST 异步执行
- **FR-040**: lead 表 MUST 加索引 `(owner_id, meddicc_score, close_date)` 优化 Pipeline 查询排序

---

## 6. Edge Cases

- **EC-1**: AI 校验在 `verdict=abstain`（LLM 数据不足）时直接放行，不打扰用户
- **EC-2**: lead 没有 MEDDICC evidence 时 AI 校验 verdict=abstain
- **EC-3**: 趋势图历史 snapshot 数 < 2 显示空状态
- **EC-4**: Team Rollup 中 sales 名下没有 active lead → 显示空行（含 Sales 头像 + 全 0）
- **EC-5**: forecast_category 改成 stage 衍生值（"已赢单"/"已丢单"）时 → 同步更新 stage（保持 invariant）
- **EC-6**: 系统启动 backfill 期间用户点 lead 详情 → 趋势图显示"趋势数据准备中"
- **EC-7**: Pipeline 查询返回空 → 6 个 tab 显示 "(0)"，主表显示 empty state

---

## 7. Open Questions

无（brainstorm 7 题已闭环 + alignment 已写完）。

---

## 8. Acceptance Test Plan

详见 alignment.md §14。预期累计 e2e: 67 (spec 003) + 8-10 PC + 8-10 Mobile = **~83-87 个 e2e**。

---

## 9. References

- `inputs/alignment.md`：完整设计稿
- `Kun's Context/articles/sfa-crm-series/MASTER-PLAN.md`：销售作业全景图
- spec 003 alignment.md §13.1：spec 004 预告
- Gong Help Center "Understanding Deal Boards"
