---
name: spec coding 必须用 Playwright 自我验证
description: SFA CRM 的 spec coding 任务每个 user story / phase 完成后用 Playwright 自动跑端到端验证，确认通过再向用户报告
type: feedback
---

每个 user story 或 phase 完成后，必须用 Playwright 自动跑一遍端到端验证（含登录模拟、关键路径走查、截图归档），确认通过再向用户报告完成。

**Why:** 用户不希望靠"代码看着像对了"或"手工瞎点"判断 phase 是否真的可交付。前一次 001 spec 中断后留下来的代码就是没自动验证导致大量隐性缺陷。Playwright 自动跑一遍能强制暴露 happy path 上的明显问题。

**How to apply:**
- 项目根 `src/frontend/` 已配置 `@playwright/test` + `playwright.config.ts`，跑命令：`cd src/frontend && npm run test:e2e`
- Playwright config 会自动启动前端 dev server；后端需要本人提前 `cd src/backend && uvicorn app.main:app --port 8000` 起好（测试 helper 会探测后端是否在线，离线则 skip）
- 测试组织：每个 user story 一个 spec 文件，命名 `tests/e2e/usX-<story>.spec.ts`，用 `data-testid` 选择器，每条断言对应 spec.md 里某条 FR
- 测试目标视口：`pc-chromium`（1440×900）跑 US1/US4，`mobile-chromium`（iPhone 12 模拟）跑 US2/US3
- 截图归档到 `tests/screenshots/`，用户随时能看
- 报告给用户时附上："Playwright N/N 通过 + 截图位置"
