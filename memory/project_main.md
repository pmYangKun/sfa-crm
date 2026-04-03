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

### 已发布文章（9 篇）

均在 `articles/` 目录下，文件名格式 `session-{编号}-{主题}.md`。

| 编号 | 主题 |
|------|------|
| 01 | skill 提炼 |
| 02 | skill 迭代 |
| 03 | check-prd 工具与 PRD 验证 |
| 04 | 需求采集与架构方向 |
| 05 | Ontology 设计 |
| 06 | Spec 阶段：线索客户拆分、RBAC |
| 07 | 技术栈与 AI Agent 架构 |
| 08 | Spec Coding 正确打开方式 |
| 09 | （最新）风格修订版 |

---

## 业务上下文摘要

甲方：企业家培训公司，小课 2 万 + 大课 20 万，销售 200 人全国。
组织：VP → 5 大区总 → 战队队长 → 一线销售。
核心痛点：客户唯一性、公共池防刷、大区规则差异化、销售录入负担。

---

## 当前状态

- ✅ 全部 14 Phase 编码完成（T001-T110）
- ✅ Copilot 端到端跑通（DeepSeek Tool Use）
- ✅ 9 篇公众号文章完成
- 辅助文件：`src/demo/copilot-cases.md`（Copilot 演示案例集）、`start.bat`（一键启动脚本）
