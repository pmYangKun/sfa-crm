# 实现计划：SFA CRM

**分支**: `master` | **日期**: 2026-03-31 | **规格文档**: `specs/master/spec.md`

## 概述

为企业家培训公司的200人销售团队构建 AI-Native SFA CRM。系统管理线索生命周期（公私池、自动释放、转化）、客户跟进和销售活动。核心特色：基于 Ontology 的数据模型（显式 Actions）、GUI API 优先设计（人和 AI Agent 共用同一套接口）、嵌入式 AI Copilot（LLM 可切换）。

技术方案：Next.js 前端 + FastAPI 后端 + SQLite，Docker Compose 部署在腾讯云轻量服务器。AI Agent 通过 Vercel AI SDK 实现，Tool Use 直接映射自 Ontology Actions。

---

## 技术上下文

**语言/版本**: Python 3.11（后端）/ TypeScript / Node.js 20（前端）
**主要依赖**: FastAPI、SQLModel（ORM）、Next.js 14、Vercel AI SDK、Anthropic SDK
**存储**: SQLite（演示/教学规模；Schema 设计保留迁移至 PostgreSQL 的可能）
**测试**: pytest（后端）/ Vitest（前端）
**目标平台**: Linux 服务器（Docker）、Web 浏览器
**项目类型**: Web 应用（前端 + 后端）
**性能目标**: 演示/教学项目——正确性优先于吞吐量；API 响应目标 p95 < 500ms
**约束**: 单服务器部署（Docker Compose）；SQLite 并发写限制在演示规模可接受
**规模/范围**: 演示用——约10用户、数百条线索；架构模式参照生产可扩展性设计

---

## 宪法校验

*对照宪法版本：v1.1.0（生效日期：2026-03-31）*

### Phase 0 前校验（6 项核心原则）

| 原则 | 状态 | 说明 |
|------|------|------|
| 1. Ontology 优先的数据模型 | ✅ 通过 | 所有对象、关系、动作均在 spec 中显式定义 |
| 2. API 优先，统一操作层 | ✅ 通过 | 所有 Actions 暴露为 FastAPI 端点；GUI 和 Agent 使用同一套接口 |
| 3. 业务规则可配置，不硬编码 | ✅ 通过 | SystemConfig 表覆盖私有池上限、阈值、大区规则、LLM 配置 |
| 4. 数据完整性不可妥协 | ✅ 通过 | 唯一性校验、速率限制、并发抢占保护均在 spec 中明确 |
| 5. 最小化销售录入负担 | ✅ 通过 | 日报自动生成；跟进记录驱动日报 |
| 6. 显式优于隐式 | ✅ 通过 | 所有状态变更通过 Actions 触发；DataScope 和权限均显式声明 |

**Phase 0 关卡结果：通过。**

### Phase 1 后复查（技术约束，v1.1.0 新增）

| 约束 | 状态 | 说明 |
|------|------|------|
| 技术栈符合约束 | ✅ 通过 | Next.js / FastAPI / SQLite / Docker Compose，与 constitution v1.1.0 一致 |
| AI Agent 层符合约束 | ✅ 通过 | Vercel AI SDK + LLMConfig 存库可切换 + Actions 映射 Tool Use + Skill 存库 |
| 速率限制在 API 层 | ✅ 通过 | SlowAPI 在 `/leads/{id}/claim` 接口层实施，客户端不可绕过 |
| 审计追踪仅追加 | ✅ 通过 | audit_log 表只写入，无物理删除接口 |
| 配置驱动规则 | ✅ 通过 | 大区规则、池上限、阈值、LLM Provider 全部在 SystemConfig 表 |

**Phase 1 关卡结果：通过——进入 Phase 2（编码）。**

---

## 项目目录结构

### 文档

```text
specs/master/
├── plan.md              ← 本文件
├── research.md          ← Phase 0 产出
├── data-model.md        ← Phase 1 产出
├── quickstart.md        ← Phase 1 产出
├── contracts/           ← Phase 1 产出（API 接口契约）
└── tasks.md             ← Phase 2 产出（/speckit.tasks 生成）
```

### 源代码

```text
src/
├── backend/
├── app/
│   ├── main.py              # FastAPI 应用入口
│   ├── models/              # SQLModel ORM 模型
│   │   ├── lead.py
│   │   ├── customer.py
│   │   ├── contact.py
│   │   ├── followup.py
│   │   ├── key_event.py
│   │   ├── org.py           # OrgNode、User
│   │   ├── auth.py          # Role、Permission、UserRole、RolePermission、UserDataScope
│   │   ├── report.py        # DailyReport
│   │   ├── config.py        # SystemConfig
│   │   ├── skill.py         # Skill
│   │   └── llm_config.py    # LLMConfig、ConversationMessage
│   ├── api/
│   │   ├── leads.py         # Lead CRUD + Actions
│   │   ├── customers.py     # Customer CRUD + Actions
│   │   ├── contacts.py
│   │   ├── followups.py
│   │   ├── key_events.py
│   │   ├── reports.py
│   │   ├── org.py
│   │   ├── users.py
│   │   ├── roles.py
│   │   ├── config.py
│   │   ├── skills.py
│   │   └── agent.py         # Chat + Tool Use 端点
│   ├── services/
│   │   ├── lead_service.py       # 线索动作业务逻辑
│   │   ├── customer_service.py
│   │   ├── permission_service.py # 权限校验 + DataScope 执行
│   │   ├── release_service.py    # 自动释放定时任务
│   │   ├── report_service.py     # 日报自动生成
│   │   ├── uniqueness_service.py # 线索去重逻辑
│   │   ├── rate_limiter.py       # 抢占速率限制
│   │   └── agent_service.py      # LLM 编排、工具调度
│   ├── tools/               # Tool Use 定义（映射自 Ontology Actions）
│   │   ├── lead_tools.py
│   │   ├── customer_tools.py
│   │   ├── followup_tools.py
│   │   └── skill_tools.py
│   └── core/
│       ├── database.py      # SQLite 连接、session
│       ├── auth.py          # JWT、session 中间件
│       └── config.py        # 应用配置加载
├── tests/
│   ├── unit/
│   └── integration/
├── pyproject.toml
└── Dockerfile

├── frontend/
│   ├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── leads/           # 线索列表、详情页
│   │   ├── customers/
│   │   ├── public-pool/
│   │   ├── reports/
│   │   ├── admin/           # 组织、用户、权限、系统配置
│   │   └── layout.tsx       # Chat 侧边栏，全局挂载
│   ├── components/
│   │   ├── leads/
│   │   ├── customers/
│   │   ├── chat/            # AI Agent 聊天侧边栏
│   │   └── ui/              # 公共 UI 组件
│   ├── lib/
│   │   ├── api.ts           # API 客户端（类型化）
│   │   └── ai.ts            # Vercel AI SDK 配置
│   └── types/               # 共享 TypeScript 类型
├── tests/
├── package.json
└── Dockerfile

└── docker-compose.yml
```

**目录结构决策**：源代码统一放在 `src/`，前后端分离（`src/backend/` + `src/frontend/`）。后端 FastAPI 明确分层：models / api 路由 / services / tool 定义。前端 Next.js App Router，Chat 侧边栏挂载在根 layout，全局可见。

---

## 复杂度追踪

无宪法违规，无需复杂度说明。

---

## Phase 0：研究

*详见 `research.md`。*

已有明确决策（无待厘清项）：
- 技术栈已完全确定
- LLM Provider：Claude（Anthropic），通过 Vercel AI SDK 接入
- 数据库：SQLite + SQLModel ORM
- 认证：JWT（无状态，演示场景足够）
- 部署：Docker Compose

Phase 0 研究问题：
1. SQLModel 自引用递归模型最佳实践（OrgNode 树）
2. FastAPI + SQLite 并发写处理（WAL 模式）
3. Vercel AI SDK Tool Use 与 FastAPI 后端的集成架构
4. FastAPI 速率限制实现（内存方案，演示规模）
5. Python 中文公司名模糊匹配库选型
