# Claude Code 项目配置

## 记忆系统路径

**重要：** 本项目的记忆文件存储在 `D:\MyProgramming\cc\SFACRM\memory\`，不使用 C 盘默认路径。

每次对话中：
- 读取记忆：从 `D:\MyProgramming\cc\SFACRM\memory\MEMORY.md` 和相关文件读取
- 写入记忆：写到 `D:\MyProgramming\cc\SFACRM\memory\` 目录下
- **不要**读写 `C:\Users\YK\.claude\projects\` 下的任何路径

---

## 回归测试约定（刚性，不可绕开）

**触发**：用户说"回归测试"、"全量测试"、"回归一遍"、"测一下没问题再交付" 之类。

### 必做的最小集（不允许少）

1. **后端 pytest 全量**：`cd src/backend && python -m pytest tests/`
2. **前端 Playwright 真实模拟**（用 PC + Mobile 两个 project 各跑一次）：
   - 测试文件：`src/frontend/tests/e2e/pc-diag-real-api.spec.ts` + `mobile-diag-real-api.spec.ts`
   - 这两个测试做的事：登录 → 进 Chat → 点引导卡 / 输入框 → **断言 assistant 气泡 textContent.length > 5**（防"流空"假阳性）
   - 命令：`cd src/frontend && npx playwright test pc-diag-real-api mobile-diag-real-api --reporter=list`
3. 用真实 LLM 调用（DB 中 active LLMConfig 必须配真 Key），不允许 mock
4. 报告必须包含：PC pass、Mobile pass、用时、若失败的具体定位

### 严格禁止（用户原话）

- ❌ 只跑后端 TestClient / curl 就声称"回归通过" —— 浏览器层的 streaming / SDK 集成 / hot reload / hydration 问题 TestClient 全抓不到
- ❌ 只跑 unit test 就声称"功能 OK"
- ❌ 让用户帮忙截 DevTools / Network 截图来定位问题 —— 我应该自己起 dev server 复现

### 前置环境

- backend 在 8000：`cd src/backend && python -m uvicorn app.main:app --port 8000`
- frontend 在 3000（用户的 start.bat 通常已起）：Playwright config 里 `reuseExistingServer: true` 会复用
- DB 中需有 active LLMConfig（含真实 LLM Key）；没有的话先 admin UI 配或用 POST /agent/llm-config 注入

### 扩展回归（可选）

如果用户明确要求"覆盖更多 case"，再扩展到 `docs/copilot-cases.md` 里的其它案例。**默认只跑 case 1-2 的核心路径**就足够 smoke。

### 调试用户报告的"X 不工作"问题时

第一反应：**我自己起 dev server 复现**，不要先问用户截图。能我自己看到的就别让用户看。猜错的成本 = 我的 token；让用户当 QA 的成本 = 用户耐心。
