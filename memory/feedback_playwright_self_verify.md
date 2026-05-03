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

**关键补充：mock 测试 ≠ 真实场景验证**

只用 mock route 单点测试会漏掉**布局 / 时序 / 状态叠加 bug**。例：用 mock + 单卡片点击我没发现"chat 面板打开后覆盖右侧 dashboard 区域，第二张卡片被 chat 拦截点击"这个 bug —— 用户点了"以为没反应"，其实是被遮挡。

**所以每个 user story 必须额外跑一个真实 API 串测**：
- 文件命名 `pc-diag-real-api.spec.ts` / `mobile-diag-real-api.spec.ts`
- 不 mock `/api/chat`，用真实 DeepSeek 流，更慢但能暴露真实环境 bug
- 串测剧本：覆盖**多 prompt 顺序**操作（卡片 → 卡片 → 输入框；或卡片 → 输入框 → 重置 → 卡片），不要单点测
- 抓 `pageerror` + `console`，确保无 JS 异常
- 在每个 phase 完成回报前都要跑过这个真实串测，全绿才能说完成
- 单点 + mock 测试是 happy path 单元覆盖；真实串测是布局 / 状态机交叉 / 时序的兜底
