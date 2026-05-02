---
name: Main Project — SFA CRM
description: SFA CRM 全栈项目：从书籍方法论到 Spec Coding 到完整系统，含 AI Copilot
type: project
---

**项目目标：** 将《决胜B端》《决胜体验设计》的方法论转化为可执行的 AI spec/skill，再用 Spec Coding 方式构建 SFA CRM 系统，验证"方法论→AI 规范→复杂系统落地"链路。

**GitHub：** `https://github.com/pmYangKun/sfa-crm`（公开仓库）

**技术栈：** Next.js + FastAPI + SQLite + Docker Compose + Vercel AI SDK

---

## 已完成的里程碑

### 阶段一：方法论 → Skill（2026-03-26 ~ 03-29）

- 从两本书提炼方法论，最终产出 `/check-prd` Skill（17 文件，14 维度）
- 在 8 份真实企业 PRD 上完整验证
- GitHub 独立仓库：`https://github.com/pmYangKun/check-prd-skill`
- **关键结论：** check-prd 是旅途中的副产品，CRM 才是主线；两者完全独立，CRM 不绑书中方法论

### 阶段二：业务讨论 → Spec 设计（2026-03-29 ~ 03-30）

- 三次方向纠偏：最终确定 Ontology 数据底座 + API-first + Copilot 三层架构
- 完成 Ontology 设计（Lead/Customer 拆分、RBAC 四表、OrgNode 树、DataScope 五档）
- 引入 spec-kit，完成 constitution v1.1.0 + spec.md + plan.md + data-model.md + tasks.md（110 任务，14 Phase）
- Spec 文件目录：`spec/`，归档：`spec/archive/`

### 重大设计决策（设计阶段确定，至今未变）

| 决策 | 结论 |
|------|------|
| 线索 vs 客户 | 独立对象，Lead 有状态，Customer 无状态，转化时归档+迁移 |
| 权限 | RBAC 四表（Role/Permission/UserRole/RolePermission）+ DataScope 解耦 |
| 数据可见性 | self_only / current_node / current_and_below / selected_nodes / all |
| 业务规则 | 配置驱动（SystemConfig 表），不硬编码 |
| AI Agent | GUI 和 Agent 共用同一套 API，Ontology Actions → Tool Use |
| Skill 系统 | 提示词文本存 DB，LLM 通过工具调用检索，Provider 可切换 |

### 阶段三：编码实现（2026-03-31 ~ 04-02）

代码目录：`src/backend/` + `src/frontend/`，共 132 次 commit。

| Phase | 任务 | 内容 |
|-------|------|------|
| 1 | T001-T006 | 项目初始化（pyproject/package.json/Docker/lint） |
| 2 | T007-T025 | 基础设施（DB/ORM/RBAC/JWT/FastAPI/前端 API 封装） |
| 3 | T026-T036 | 线索录入 + 去重（rapidfuzz 85 分阈值） |
| 4 | T037-T046 | 线索分配/抢占/释放/标丢失 + 大区规则引擎 |
| 5 | T047-T049 | 定时释放（APScheduler）+ 通知表 |
| 6 | T050-T056 | 线索转化 + Webhook 对接 + 客户管理 |
| 7 | T057-T066 | 跟进记录 + 关键事件 |
| 8-10 | T067-T080 | 转化窗口、联系人管理、日报 |
| 11-12 | T081-T094 | 权限管理 + Admin 后台（组织/用户/角色/配置/审计） |
| 13 | T095-T105 | AI Agent chat sidebar & tool use |
| 14 | T106-T110 | 集成测试、通知铃铛、Dashboard |

后续修复：Copilot 端到端（DeepSeek Tool Use）、TypeScript 编译、Dashboard API、quickstart 文档拆分。

### 文档

- `articles/` 目录已移除，会话记录迁移至 `Kun's Context` 仓库
- `docs/` — PRD 文档（SFA-CRM-PRD.md / .docx）

---

## 业务上下文摘要

甲方：企业家培训公司，小课 2 万 + 大课 20 万，销售 200 人全国。
组织：VP → 5 大区总 → 战队队长 → 一线销售。
核心痛点：客户唯一性、公共池防刷、大区规则差异化、销售录入负担。

---

### 演示体验优化（2026-04-03）

- Chat 面板从浮动小窗改为右侧全高侧栏（Agentforce 风格）
- Chat 导航关键路径：`chat-sidebar.tsx`（handleNavigate）→ sessionStorage(`copilot_prefill`) → 目标页读取；`/leads/new` 用 `useSearchParams` 读 URL 参数
- navigate 工具支持预填表单（sessionStorage 传递 followup_type/content/event_type）
- search_leads/get_lead_detail 返回 detail_url + last_followup_at，防止 LLM 编造 URL
- Copilot 工具增加 DataScope 过滤（search_leads/list_customers），与正式 API 一致
- system prompt 重写为工作流程式，解决 DeepSeek 不调工具就编 URL 的问题
- 新增 sales02（李思远）、sales03（张磊），3 个销售差异化活跃度（高/中/低）
- 新增团队分析能力：manager 可问"谁在偷懒"，AI 按 owner 分组分析跟进节奏
- init_db 自动从 `src/backend/.env` 读取 LLM API Key（不进 Git）
- init_db 增加幂等检查，避免重复初始化报错
- 演示案例精简为 8 个独立案例，含团队偷懒检测（案例 6）
- README 重构：演示信息前置，修正账号密码
- 新增 `reset-demo.bat` 一键重置演示数据

---

## 当前状态

- ✅ 全部 14 Phase 编码完成（T001-T110）
- ✅ Copilot 端到端跑通（DeepSeek Tool Use）
- ✅ 9 篇公众号文章完成
- ✅ 演示体验全面优化（全高面板、预填、团队分析、权限过滤）
- LLM API Key：`src/backend/.env`（在 .gitignore 中）
- 演示案例：`src/demo/copilot-cases.md`（8 个独立案例）
- 一键启动：`start.bat` | 一键重置：`reset-demo.bat`
- 演示账号：admin / sales01（王小明）/ sales02（李思远）/ sales03（张磊）/ manager01（陈队长），密码均为 12345

---

## 内容策略与心智构建（2026-05-02 确立）

SFA CRM 后续作为持续内容母体，构建：
- 「vibe coding 达人」标签
- 「现代 CRM 专家」标签

**顶层目标：** 通过 SFA CRM 公开验证并传递「**对话式 + 行为驱动 + Spec 工程化**」的现代 CRM 形态。SFA CRM 不只是 vibe coding 演示，更是用项目验证杨堃对 RAO / AI Native CRM 判断的载体。

**核心原则：**
- 转化路径不外露——不喊买课/咨询，沿用既有引流（视频号→公众号→个人微信 goYangkunGo）
- 内容寄生在产品迭代和专业讨论上，不为了写而写

**详细路线图（私有，仅本地访问）：**
`D:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM-private\content-plan.md`
（项目内 junction：`docs/private/content-plan.md`，被 .gitignore 屏蔽不进 GitHub）

**结构概要：**

- **阶段 1：奠基（1-2 周）**：公网部署 + Mobile 形态调整（Chat 移动化为主入口）+ 首页 onboarding + GitHub README 门面化 + Session 10 集大成文
- **阶段 1 之后：持续运营期（无终点）**：不再分大 Phase，4 轨道并行螺旋上升，靠主题攻势制造节奏感：
  - 轨道 A：专业讨论（杨老师硬观点）
  - 轨道 B：功能扩展（借鉴 Gong / Headless / RAO）
  - 轨道 C：AI 玩法实验（MCP / Skill / Tool Use）
  - 轨道 D：心智构建（克劳蛋系列）

**两条探索路径**（叙述维度）：
- 路径 1：CRM 业务形态变革（对话驱动、行为驱动、Gong/RAO 哲学）
- 路径 2：ToB 软件 × AI 架构变革（Headless / MCP / 业务自助 SQL/Skill）

**主题攻势节奏**：每 1-2 个月选一主题，4 轨道全部倾斜。不预先承诺顺序，按当下兴趣/热点/反馈动态选取。

下次讨论 SFA CRM 内容/文章/部署时，先读 content-plan.md 看当前主题攻势状态。
