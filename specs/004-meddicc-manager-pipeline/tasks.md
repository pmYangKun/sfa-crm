# Spec 004 Tasks

**Branch:** `004-meddicc-manager-pipeline`
**Total tasks:** 65

---

## Phase 0: Setup (T001-T005)

- [ ] **T001** [P] 新建分支 `004-meddicc-manager-pipeline` from master
- [ ] **T002** [P] 在 `src/frontend/package.json` 加 `recharts` 依赖，npm install
- [ ] **T003** 写 alembic migration `versions/00X_spec_004_pipeline_fields_and_history.py`：
  - lead 表加 amount / close_date / forecast_category
  - 新建 lead_meddicc_history 表 + 索引
- [ ] **T004** 在 `init_db.py::seed_system_config()` 加 12 条幂等 INSERT（7 spec 004 + 5 spec 003 迁移）
- [ ] **T005** 跑 `alembic upgrade head` + `python -m app.core.init_db` 验证 schema 落地

---

## Phase 1: Foundational Backend (T006-T020)

### Models
- [ ] **T006** `app/models/lead.py`：Lead 类加 amount / close_date / forecast_category 字段，CHECK 约束
- [ ] **T007** `app/models/lead_meddicc_history.py`：LeadMeddiccHistory 新模型

### Warnings Engine
- [ ] **T008** `app/services/warning_engine.py`：
  - 7 条规则函数（silent_deal / brag_without_evidence / close_imminent_low_score / overdue_not_closed / no_champion_after_followups / single_contact_exposed / big_deal_thin_evidence）
  - `compute_warnings_for_lead(lead, context)` 主函数
  - `compute_warnings_batch(leads)` 批量
- [ ] **T009** `tests/unit/test_warning_engine.py`：每条规则正例 + 反例 + 边界值

### History Snapshot
- [ ] **T010** `app/services/meddicc_history_service.py`：
  - `write_snapshot(lead_id, trigger_reason)` 函数
  - `get_history(lead_id, since_days, limit)` 查询
- [ ] **T011** `tests/unit/test_meddicc_history.py`
- [ ] **T012** 修改 `app/services/meddicc_service.py::analyze_meddicc()`：分析完后调 `write_snapshot(trigger_reason='analyze')`
- [ ] **T013** 修改 `app/api/leads.py::update_lead()`：检测 forecast_category 变更，调 `write_snapshot(trigger_reason='forecast_change')`

### AI 校验
- [ ] **T014** `app/services/forecast_validation_service.py`：
  - LLM 调用 + structured output
  - cache 60s 去重
  - timeout 3s
- [ ] **T015** `tests/unit/test_forecast_validation.py`：mock LLM 三 verdict + cache + timeout

### Manager Pipeline 聚合
- [ ] **T016** `app/services/manager_pipeline_service.py`：
  - `query_pipeline(user, filter, sort, pagination)` Pipeline 全表查询（含 warnings count）
  - `query_team_rollup(manager_id)` Team Rollup 聚合
- [ ] **T017** `tests/unit/test_manager_pipeline.py`：DataScope + 排序 + filter + 边界

### Backfill
- [ ] **T018** `app/core/backfill_task.py`：
  - `run()` 异步执行，遍历 active lead 跑 analyze + 写 snapshot
  - idempotent（已有 baseline 跳过）
- [ ] **T019** `tests/integration/test_backfill.py`
- [ ] **T020** 在 `init_db.py` 末尾调度 backfill_task（仅当 history 表为空时）

---

## Phase 2: API Endpoints (T021-T030)

- [ ] **T021** `app/api/manager_pipeline.py`：
  - `GET /api/manager/pipeline`
  - `GET /api/manager/team-rollup`
  - DataScope 应用
- [ ] **T022** `app/api/forecast_validation.py`：`POST /api/leads/{lead_id}/validate-forecast`
- [ ] **T023** `app/api/leads.py::update_lead()` 增强：接受 amount / close_date / forecast_category 字段；forecast 变更时写 history + 同步 stage（已赢单/已丢单）
- [ ] **T024** `app/api/leads.py`：新增 `GET /api/leads/{lead_id}/meddicc-history`
- [ ] **T025** `tests/api/test_manager_pipeline_api.py`：US1 + US4 验收
- [ ] **T026** `tests/api/test_forecast_validation_api.py`：US3 验收
- [ ] **T027** `tests/api/test_meddicc_history_api.py`：US5 验收

### Chat Agent
- [ ] **T028** `app/services/agent_service.py`：注册 4 个新 tool
  - `scan_team_warnings`
  - `team_meddicc_summary`
  - `top_attention_deals`
  - `forecast_category_distribution`
- [ ] **T029** `app/services/agent_system_prompt.py`：经理识别 + 团队问题路由 + nav 链接规则
- [ ] **T030** 跑全部 backend pytest 全绿

---

## Phase 3: Frontend PC (T031-T045)

### 路由 + 入口
- [ ] **T031** `app/manager-pipeline/page.tsx` 主页面框架（Server Component）
- [ ] **T032** 主菜单 sidebar 加"经理 Pipeline" 入口（仅 manager / admin 角色可见）
- [ ] **T033** 主页 onboarding 卡 manager01「📊 团队 MEDDICC 完成度」跳转目标改为 `/manager-pipeline`

### Pipeline 主表
- [ ] **T034** `components/pipeline/forecast-tabs.tsx`：6 tab + 计数显示
- [ ] **T035** `components/pipeline/pipeline-table.tsx`：主表（行 = lead，列见 alignment §10.1）
- [ ] **T036** `components/pipeline/warnings-cell.tsx`：⚠️ N badge + hover tooltip
- [ ] **T037** `components/pipeline/meddicc-dots-compact.tsx`：紧凑 7 圆点（行内用，跟 spec 003 仪表盘版区分）
- [ ] **T038** `components/pipeline/forecast-cell-editor.tsx`：行内 click-to-edit + AI 校验触发

### Team Rollup
- [ ] **T039** `components/pipeline/team-rollup-table.tsx`：Team 视图行 = sales
- [ ] **T040** `components/pipeline/deals-team-toggle.tsx`：视图切换器
- [ ] **T041** drill-down：点 sales 行切回 Deals 视图 + 自动 filter owner

### AI 校验
- [ ] **T042** `components/pipeline/forecast-validation-dialog.tsx`：PC dialog 组件 + 3 按钮

### Trend Chart
- [ ] **T043** `components/leads/meddicc-trend-chart.tsx`：recharts 折线图
- [ ] **T044** 在 lead 详情页 `/leads/[id]/page.tsx` 插入 trend-chart 组件

### PC E2E
- [ ] **T045** `tests/e2e/pc-manager-pipeline.spec.ts`：
  - test 1: manager01 进 Pipeline 全表 + 6 tab 显示
  - test 2: 排序 Score 升序
  - test 3: Deals/Team 切换 + drill-down
  - test 4: 改 forecast_category → AI 校验弹气泡 → 选择
  - test 5: lead 详情页趋势图显示
  - test 6: chat "团队哪几单存在风险"
  - test 7: Warnings 列 hover tooltip
  - 沿用 spec 003 forbidPhrases 反向断言

---

## Phase 4: Frontend Mobile (T046-T058)

- [ ] **T046** `app/m/manager-pipeline/page.tsx` 框架
- [ ] **T047** `components/m/pipeline/mobile-forecast-tabs.tsx`：横滑 6 tab
- [ ] **T048** `components/m/pipeline/deal-card.tsx`：紧凑卡片（含 Score / Warnings / 7 圆点 / 金额 / 最近活动）
- [ ] **T049** `components/m/pipeline/mobile-forecast-edit-sheet.tsx`：BottomSheet（沿用 MobileFormSheet）
- [ ] **T050** `components/m/pipeline/mobile-forecast-validation-dialog.tsx`：全屏 dialog
- [ ] **T051** `components/m/pipeline/mobile-team-rollup.tsx`：sales 卡片栈
- [ ] **T052** `components/m/pipeline/mobile-deals-team-toggle.tsx`
- [ ] **T053** `app/m/leads/[id]/page.tsx` 趋势图集成（复用 PC 组件，宽度自适应）
- [ ] **T054** Mobile 主导航金刚区加"经理 Pipeline" 入口（manager 角色可见）
- [ ] **T055** Mobile 主页 onboarding 卡 manager01 跳转目标更新到 `/m/manager-pipeline`
- [ ] **T056** `tests/e2e/mobile-manager-pipeline.spec.ts`：
  - test 1-7 同 PC，但走 mobile-chrome viewport
  - 卡片渲染 + BottomSheet + 全屏 dialog 各自断言
- [ ] **T057** 修复 Mobile e2e 失败
- [ ] **T058** 跑全量回归（spec 003 既有 67 + spec 004 新加）确认全绿

---

## Phase 5: Demo Data + Polish (T059-T065)

- [ ] **T059** `app/core/seed_data.py` 给 demo lead 标 forecast_category（让 6 tab 都有数据）
- [ ] **T060** `app/core/seed_data.py` 给 demo lead 标 amount + close_date（演示 close_imminent warning）
- [ ] **T061** 增加 5-7 条新 demo lead 横跨 6 个 forecast bucket（保证 manager01 名下有 8-10 条）
- [ ] **T062** 跑 reset-demo.bat 验证 demo 数据 + 趋势图开局有 baseline
- [ ] **T063** `README.md` 更新：spec 004 进度 + 经理 Pipeline 演示路径
- [ ] **T064** `docs/copilot-cases.md` 加经理新 case："团队哪几单存在风险" / "团队 MEDDICC 完成度怎么样" / "今天我该重点看哪几单"
- [ ] **T065** `docs/deploy.md` 同步简化（per Phase A 政策——不切 tag，永远跟 master）

---

## 任务依赖图（关键路径）

```
T001 → T002, T003 → T004, T005 → T006-T007
                              ↓
T006 → T008 ← T009          T007 → T010 ← T011
       T008 → (T012, T013)         T010 → T012, T013
                ↓
              T014 ← T015
                ↓
              T016 ← T017
                ↓
              T018 ← T019 → T020
                ↓
              T021-T024 ← T025-T027
                ↓
              T028-T029 → T030 (backend done)
                ↓
              T031-T045 (PC) ← T031 仅依赖 T030
                ↓
              T046-T058 (Mobile)
                ↓
              T058 (regression all green)
                ↓
              T059-T065 (polish)
```

---

## TDD 节奏

按 spec 003 模式：每个 service / endpoint / component 写法是 **test 先写一个 failing → impl → test 通过 → next**。pytest 单元测试覆盖正反例，Playwright e2e 覆盖完整 user journey。

---

## 提交节奏

预期 ~25-30 commits（参考 spec 003 的 21 commits）。每个 Phase 收口前可 commit 一次：
- `feat(004): T001-T005 setup + alembic migration + system_config seed`
- `feat(004): T006-T020 backend foundational (warnings + history + AI validation + pipeline)`
- `feat(004): T021-T030 backend API + chat tools`
- `feat(004): T031-T045 frontend PC`
- `feat(004): T046-T058 frontend mobile`
- `feat(004): T059-T065 demo data + polish`
- `test(004): regression all green`

---

## Definition of Done

- [ ] 所有 65 任务 ✅
- [ ] backend pytest 100% 通过
- [ ] PC + Mobile e2e 全绿（67 + 8-10 + 8-10 = ~83-87 用例）
- [ ] manual smoke test：manager01 走完 US1-7 体验
- [ ] README 更新
- [ ] PR 合 master 并打 v-spec004 tag
- [ ] MASTER-PLAN 三列映射表更新
