# Spec 004 Plan：MEDDICC 经理过程管理

**Status:** Draft
**Branch:** `004-meddicc-manager-pipeline`

---

## 1. Tech Approach Overview

**Stack（沿用 spec 001-003）：**
- Backend: FastAPI + SQLModel + SQLite + APScheduler
- Frontend: Next.js 14 App Router + Tailwind + Vercel AI SDK
- Charts: **recharts**（spec 004 新引入，单 lead 趋势图用）
- LLM: DeepSeek-chat（沿用 spec 003 抽证据 + AI 校验）
- Tests: pytest（backend）+ Playwright（PC chrome + Mobile chrome）

**新增依赖：**
- `recharts` (Frontend npm install)
- 无 backend 新依赖

---

## 2. Phase Breakdown

### Phase 0: Setup（T001-T005）

- T001: 新建 `004-meddicc-manager-pipeline` 分支（基于 master）
- T002: `recharts` 依赖加进 `src/frontend/package.json`，npm install
- T003: 写 alembic migration `add_lead_pipeline_fields_and_history`：新增 lead 三字段 + lead_meddicc_history 表 + 加索引
- T004: 在 `init_db.py` `seed_system_config()` 加 7 条 warning 阈值 + 5 条 spec 003 迁移阈值的幂等 INSERT
- T005: 跑一遍 alembic upgrade + init_db 确认 schema 落地

### Phase 1: Foundational Backend（T006-T020）

- T006: `Lead` SQLModel 加 amount / close_date / forecast_category 字段
- T007: `LeadMeddiccHistory` SQLModel 新建
- T008: 编写 `services/warning_engine.py`：7 条规则函数 + Warning data class
- T009: pytest 单元测试 `tests/unit/test_warning_engine.py`：每条规则正例 + 反例
- T010: 编写 `services/meddicc_history_service.py`：snapshot 写入 + backfill 逻辑
- T011: pytest `tests/unit/test_meddicc_history.py`
- T012: 在 spec 003 的 `analyze_meddicc()` 加 snapshot 写入钩子
- T013: 在 lead update API 加 forecast_category 变更 snapshot 钩子
- T014: 编写 `services/forecast_validation_service.py`：调 LLM 看 MEDDICC + 输出 schema
- T015: pytest `tests/unit/test_forecast_validation.py`：mock LLM 三种 verdict
- T016: 编写 `services/manager_pipeline_service.py`：Pipeline + Team Rollup 聚合查询
- T017: pytest `tests/unit/test_manager_pipeline.py`：DataScope + 排序 + filter
- T018: 编写 `app/core/backfill_task.py`：异步 backfill 任务（APScheduler 启动时跑一次）
- T019: pytest `tests/integration/test_backfill.py`：idempotent + 进度跟踪
- T020: 在 `init_db.py` 加 backfill 触发（启动后台）

### Phase 2: API Endpoints（T021-T030）

- T021: 编写 `api/manager_pipeline.py`：`GET /api/manager/pipeline`、`GET /api/manager/team-rollup`
- T022: 编写 `api/forecast_validation.py`：`POST /api/leads/{lead_id}/validate-forecast`
- T023: 在 `api/leads.py` 的 PUT lead endpoint 加 forecast_category 变更检测 + history snapshot
- T024: pytest API 测试 `tests/api/test_manager_pipeline_api.py`
- T025: pytest API 测试 `tests/api/test_forecast_validation_api.py`
- T026: 在 `services/agent_service.py` 注册 4 个新 chat tool
- T027: 修改经理 chat system prompt（`prompts/manager_system_prompt.md` 或类似位置）
- T028: pytest `tests/unit/test_chat_team_tools.py`
- T029: 集成测试 `tests/integration/test_chat_manager_flow.py`
- T030: 跑全部 backend pytest 全绿

### Phase 3: Frontend PC（T031-T045）

- T031: 新页面 `app/manager-pipeline/page.tsx` 框架
- T032: 组件 `components/pipeline/forecast-tabs.tsx`：6 tab 切换 + 计数显示
- T033: 组件 `components/pipeline/pipeline-table.tsx`：主表（行 = lead）
- T034: 组件 `components/pipeline/warnings-cell.tsx`：⚠️ N + hover tooltip
- T035: 组件 `components/pipeline/meddicc-dots.tsx`：复用 spec 003 + 紧凑列表版
- T036: 组件 `components/pipeline/forecast-cell-editor.tsx`：行内 click-to-edit
- T037: 组件 `components/pipeline/forecast-validation-dialog.tsx`：AI 校验 dialog（PC）
- T038: 组件 `components/pipeline/team-rollup-table.tsx`：Team 视图
- T039: 组件 `components/pipeline/deals-team-toggle.tsx`：视图切换
- T040: 组件 `components/leads/meddicc-trend-chart.tsx`：recharts 折线图
- T041: 在 lead 详情页插入趋势图组件
- T042: PC navigation：在主菜单加 "经理 Pipeline" 入口（仅 manager / admin 可见）
- T043: PC e2e `tests/e2e/pc-manager-pipeline.spec.ts`：US1/2/3/4/5/6 场景
- T044: 修复 PC e2e 失败
- T045: 主页 onboarding 卡 manager01 「📊 团队 MEDDICC 完成度」更新跳转目标到 `/manager-pipeline`

### Phase 4: Frontend Mobile（T046-T058）

- T046: 新页面 `app/m/manager-pipeline/page.tsx` 框架
- T047: 组件 `components/m/pipeline/mobile-forecast-tabs.tsx`：横滑 6 tab
- T048: 组件 `components/m/pipeline/deal-card.tsx`：紧凑卡片
- T049: 组件 `components/m/pipeline/mobile-forecast-edit-sheet.tsx`：BottomSheet（沿用 MobileFormSheet）
- T050: 组件 `components/m/pipeline/mobile-forecast-validation-dialog.tsx`：全屏 dialog
- T051: 组件 `components/m/pipeline/mobile-team-rollup.tsx`：sales 卡片栈
- T052: 组件 `components/m/pipeline/mobile-deals-team-toggle.tsx`
- T053: Mobile 趋势图（沿用 PC 组件，宽度自适应）
- T054: Mobile navigation：金刚区加 "经理 Pipeline" 入口（manager01 onboarding 卡也加）
- T055: 主页 onboarding 卡 manager01 移动端版同步更新
- T056: Mobile e2e `tests/e2e/mobile-manager-pipeline.spec.ts`：US1/2/3/4/5/6/7 场景
- T057: 修复 Mobile e2e 失败
- T058: 全量回归（spec 003 既有 67 e2e + spec 004 新增）确认全绿

### Phase 5: Demo Data + Polish（T059-T065）

- T059: 在 `seed_data.py` 给 demo lead 标 forecast_category 分布（让 6 tab 都有数据）
- T060: 给 demo lead 标 amount / close_date（演示 close_date 临近 warning）
- T061: 添加 5-7 条新 demo lead（让 manager01 名下 8-10 条 lead 横跨 6 tab）
- T062: README 更新：Spec 004 进度 + 经理 Pipeline 演示路径
- T063: docs/copilot-cases.md 加经理新案例（"团队哪几单存在风险"等）
- T064: 公网部署文档 docs/deploy.md 简化（per Phase A 政策更新——不切 tag）
- T065: 跑一遍 reset-demo.bat 确认 demo 数据干净

---

## 3. Data Model Summary

详见 `data-model.md`。变更摘要：
- `lead` 表加 3 字段：amount / close_date / forecast_category
- `lead_meddicc_history` 新表
- `system_config` 加 12 条配置（7 spec 004 新 + 5 spec 003 迁移）

无破坏性变更（pure additive migration）。

---

## 4. API Contracts Summary

详见 `contracts/api-contracts.md`。新增接口：
- `GET /api/manager/pipeline` —— Pipeline 全表查询（含 forecast filter / sort / DataScope）
- `GET /api/manager/team-rollup` —— Team Rollup 聚合
- `POST /api/leads/{lead_id}/validate-forecast` —— AI 校验 forecast_category
- `GET /api/leads/{lead_id}/meddicc-history` —— 趋势图数据源
- `PUT /api/leads/{lead_id}` 增强 —— 支持 forecast_category / amount / close_date 字段

Chat agent 新增 4 个 tool（不通过 REST 暴露，走 Vercel AI SDK function call）。

---

## 5. Test Strategy

### Unit (pytest)
- Warning 引擎 7 条规则正反例
- AI 校验 service mock LLM 三种 verdict
- History snapshot 触发 + backfill idempotent
- Manager Pipeline + Team Rollup 聚合 + DataScope

### Integration (pytest)
- backfill 启动流程
- forecast_category 变更 → snapshot + 校验 → DB
- chat manager flow（mock LLM）

### E2E (Playwright)
- PC: `pc-manager-pipeline.spec.ts` 覆盖 US1-6
- Mobile: `mobile-manager-pipeline.spec.ts` 覆盖 US1-7
- 既有套件保持全绿（spec 003 67 用例 + spec 004 新增）

### Real LLM regression
- 沿用 spec 003 模式：每场 case 真实 LLM 调用 30-60s
- forbidPhrases 反向断言（不应出现"已创建" / 假 lead_id 等幻觉）

---

## 6. Risks & Mitigations

详见 `inputs/alignment.md` §16。重要风险：

1. **AI 校验慢卡死 forecast 修改** → 3 秒超时直接放行
2. **backfill 时长** → 异步执行 + 占位提示
3. **Warning 误判** → 阈值进 SystemConfig，e2e 覆盖正反例
4. **大量 demo lead 排序慢** → 加索引

---

## 7. Deployment Plan

按 2026-05-07 三修政策：
1. PR 进 master
2. 给 merge commit 打 `v-spec004` annotated tag
3. push origin（含 tag）
4. 立即部署到公网（git pull + alembic upgrade + init_db 触发 backfill + 重启）
5. 公网随之滚到最新版（不切回旧 tag）

---

## 8. Article Output Plan

S2E04 文章题材：
- 主标题候选："经理用 MEDDICC 反查销售吹牛" / "AI 反问那一刻"
- 4 张漫画占位
- 覆盖 7 条 Warning 中的几个戏剧场景 + AI 反问的产品哲学
- 路径 `Kun's Context/articles/sfa-crm-series/season-2/S2104-YYYY-MM-DD-XXX.md`

发布时机：spec 004 PR merge + 公网部署完毕后再写文章 + 用户截图 + 发文。
