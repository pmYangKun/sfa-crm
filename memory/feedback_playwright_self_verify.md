---
name: spec coding 必须自己跑测试到全绿才回报
description: SFA CRM 写代码后必须自己用 Playwright 跑 e2e，迭代修到全绿再回来；不要每个 phase 都拉用户确认
type: feedback
---

写代码 + 自跑测试是同一件事。每次写完代码必须自己用 Playwright 跑一遍对应用例，发现失败自己迭代修，直到全绿再向用户报告。**不要每个 phase 都拉用户确认。**

**Why:** 用户希望我自主执行多个 phase 连续推进，而不是写完一个 phase 就停下来等"可以继续吗"。"用户随时能打断"是默认权利，不需要每个分叉都问一次。但前提是**我自己保证质量**——跑完测试确认没问题再回来。

**How to apply:**
- 跑命令：`cd src/frontend && npx playwright test --project=pc-chromium` 或 `--project=mobile-chromium`
- 全量回归命令（多 phase 后用）：`npx playwright test`
- 测试失败的处理顺序：① 先看截图 / trace 判断是代码 bug 还是测试 bug ② 修对应 bug ③ 重跑直到绿 ④ 失败 3 次仍未绿才回来求助
- 每个 user story / phase 必有对应 spec 文件（usX-xxx 或 mobile-/pc-phase-）+ 截图归档进 `tests/screenshots/`
- 报告时附"通过 N/N + 截图清单"，不附无关过程
- 无明显需要用户决策的事不要打断（Yes/No 决策、设计偏离、阻塞点才打断）
