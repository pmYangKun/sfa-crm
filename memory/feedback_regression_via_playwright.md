---
name: 用户说"回归测试"时必须走 Playwright 真实前端模拟
description: 触发关键词：回归测试 / 全量测试 / 回归一遍 / 测一下没问题再交付。绝不允许只跑后端 TestClient/curl/单测就声称通过；必须用 Playwright 在 PC + Mobile 模拟真实浏览器操作（登录 → 进 chat → 输入 → 验证非空回复）
type: feedback
---

用户说"回归测试 / 全量测试 / 回归一遍"等关键词时，**回归的核心是确认前端真的能用，不是后端契约对**。

**Why**：2026-05-04 SFA CRM spec 002 阶段，我把 chat/route.ts 改了三轮，每次都自称"回归测试通过"——但只是后端 pytest + TestClient + curl 通过；前端浏览器层的 streaming bug（text-delta 字段名读错、错误被静默吞）一直没抓到。用户在 Web/Mobile 反复看到"输了字没反应"，被迫帮我 debug 多轮，明确说"我要你干什么用，废物"。最后他原话："你不允许只在后台调，应该是真实地去前端模拟操作，我觉得这样子是最直接、最有效的"。

**How to apply**：

1. **触发即知**：用户说"回归测试 / 全量测试 / 回归一遍 / 全部测一下" 这种词，**一定** 包含 Playwright 真实模拟，不能只跑 unit/integration test 就交付。

2. **最小集（不允许少）**：
   - 后端 pytest 全量
   - **PC 端**：Playwright 登录 → 进 Chat → 点引导卡或输入框 → 断言 assistant 气泡 textContent.length > 5（防"流空气泡"假阳性）
   - **移动端**：同上，单独跑一遍（PC 测试不能代替）
   - 用真实 LLM 调用，不允许 mock —— mock 测试抓不到 SDK 集成 bug

3. **覆盖度（2026-05-04 升级，刚性）**：`docs/copilot-cases.md`（或同等 demo case 清单）里的 **每一个 case** 都要在 PC + Mobile 各跑一遍。本来"前 1-2 case"是默认，但移动端"录入跟进卡片提交 500"问题前几次回归没抓到，用户明确说"咱们就定死了，把所有的演示案例 case 都跑一遍"。后续凡是 SFA CRM 这种"有 demo case 清单"的项目，回归 = 全 case × (PC + Mobile) 全跑通。

4. **碰用户报"X 不工作"**：第一反应**自己起 dev server 复现**，绝不先问用户截 DevTools/Network 截图。能我自己看到的就别让用户当 QA。

5. **SFA CRM 项目专用**：执行细节（端口/命令/spec 文件名）见项目根 `D:\MyProgramming\cc\SFACRM\CLAUDE.md`「回归测试约定」段。其它项目按本 feedback 高层规则即可。

6. **失败信号识别**：浏览器 Network 显示 `/api/chat 200 + 0 字节`、用户说"没反应"、气泡显示空 —— 这都是"流空"症状，typically streaming/SDK 集成层 bug，必须 Playwright e2e + textContent 长度断言才能抓到，pytest 抓不到。
