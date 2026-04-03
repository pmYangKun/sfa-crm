# 大型 VibeCoding 真人秀：用 AI 从零构建 SFA CRM

> 《决胜B端》作者杨堃老师，正在发起一场对传统软件工程的正面挑战。
> 这个 repo 是全程记录。欢迎见证——成功或翻车，都会完整保留。

---

## 快速体验

### 启动

Windows 用户双击 `start.bat`，等待两个终端窗口启动完成后访问：

- **前端：** http://localhost:3000/login
- **后端 API 文档：** http://localhost:8000/docs

> 如果首次启动或数据库被清除，需要先初始化数据库：
> ```bash
> cd src/backend
> python -c "from app.core.init_db import init_db; init_db()"
> ```

### 演示账号

| 账号 | 密码 | 角色 | 数据范围 |
|------|------|------|---------|
| `admin` | `12345` | 系统管理员 | 全部 |
| `sales01` | `12345` | 销售 | 仅自己 |
| `manager01` | `12345` | 战队队长 | 本队及下属 |

### AI Copilot 配置

首次使用需配置 LLM：
1. 用 `admin` 登录
2. 进入「Admin → LLM 配置」
3. 填入 API Key（支持 DeepSeek、Anthropic 等 OpenAI 兼容 Provider）
4. 点击保存并激活

配置完成后，任意用户登录都可以使用右下角的 AI 助手。演示案例见 [`src/demo/copilot-cases.md`](src/demo/copilot-cases.md)。

---

## 这是什么

一个正在进行中的实验性工程项目，目标是：**基于 Spec Coding，从零构建一个 AI-Native 的 SFA CRM 产品**。

项目有四个核心野心：

- **没有 PRD**，全程基于结构化上下文（Spec）驱动，需求描述方式彻底改变
- **Palantir Ontology 方法论落地**，在系统底层对业务对象、对象关系、可执行动作进行显式建模，让 AI 真正理解结构化业务数据
- **所有界面 API 化**，每个操作都有对应接口，AI 可以直接控制界面，而不是靠模拟点击
- **Copilot 模式**，AI Agent 与人协同操控同一套系统，各司其职，真正的人机协作

工具栈：**VS Code + Claude Code**。

---

## Spec Coding 是什么

不写 PRD，用结构化的业务上下文（Spec）直接驱动系统设计和代码生成。

Spec 里有业务逻辑、对象定义、行为约束。AI 基于这些生成代码，出问题改 Spec 不改注释。Spec 是设计的唯一真实来源。

与此配合的还有 **Harness Engineering**：用 CLAUDE.md、Skill 文件、Memory 系统约束 AI 的行为边界，让它不跑偏。

---

## Repo 结构

```
├── articles/                        # 系列文章，每集记录一次对话的过程和结论
│   ├── session-01-skill提炼.md
│   ├── session-02-skill迭代.md
│   ├── session-03-check-prd.md
│   ├── session-04-需求采集.md
│   ├── session-05-ontology.md
│   ├── session-06-老登反击.md
│   ├── session-07-技术栈.md
│   └── session-08-speccoding.md
├── spec/archive/                    # 原始规格文件归档（已整合至 specs/master/spec.md）
├── specs/master/                    # spec-kit 产出文档（设计唯一真相源）
│   ├── spec.md                      # 业务规格
│   ├── plan.md                      # 实现计划
│   ├── data-model.md                # 数据模型
│   ├── contracts/api-contracts.md   # API 接口契约
│   ├── quickstart.md                # 启动指南
│   └── tasks.md                     # 110 个实现任务
├── src/
│   ├── backend/                     # FastAPI 后端（已实现）
│   ├── frontend/                    # Next.js 前端（已实现）
│   └── docker-compose.yml
├── skills/                          # Claude Code Skill 文件
│   └── check-prd/                   # PRD 质量检查工具（独立子项目）
├── memory/                          # Claude 跨会话记忆文件
└── CLAUDE.md                        # Claude Code 项目配置
```

---

## 进度

| 集数 | 内容 | 状态 |
|------|------|------|
| 第一集 | 从两本书提炼方法论 Skill | 完成 |
| 第二集 | Skill 落地与迭代 | 完成 |
| 第三集 | check-prd 工具，解剖 8 份真实企业 PRD | 完成 |
| 第四集 | 业务上下文采集，确定架构方向 | 完成 |
| 第五集 | Ontology 设计：对象建模、Actions、AI-native CRM | 完成 |
| 第六集 | Spec 阶段：线索/客户拆分、RBAC、数据权限分离 | 完成 |
| 第七集 | Plan 阶段：技术栈选型，AI Agent 方案 | 完成 |
| 第八集 | Spec Coding 的正确打开方式：spec-kit 定位与协作分工 | 完成 |
| 编码阶段 | 110 个任务全部实现，14 个 Phase 完成 | 完成 |

---

## 配套公众号

每一集都有对应文章，由 Claude（克劳蛋）执笔，杨老师盖章。

文章存在 `articles/` 目录下，也会同步发布到杨老师的公众号**PM杨堃**。

---

## 开发者快速启动

详细文档见 [`specs/master/quickstart.md`](specs/master/quickstart.md)。

### 一分钟启动

```bash
# 后端
cd src/backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -c "from app.core.init_db import init_db; init_db()"  # 初始化 DB + 种入测试数据
uvicorn app.main:app --reload     # http://localhost:8000/docs

# 前端（新终端）
cd src/frontend
npm install
npm run dev                       # http://localhost:3000
```

### 账号与 AI 配置

见本文档顶部「快速体验」章节。

### 运行集成测试

```bash
cd src/backend
pytest tests/integration/ -v
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | FastAPI + SQLModel + SQLite (WAL) |
| 前端 | Next.js 14 App Router |
| AI Agent | Vercel AI SDK + Anthropic API (Tool Use) |
| 认证 | JWT (python-jose) |
| 权限 | RBAC + DataScope (Role/Permission/UserDataScope) |
| 调度 | APScheduler (自动释放、日报生成) |
| 限流 | SlowAPI (IP + 用户级) |

---

## 关于「极有可能翻车」

这不是谦虚。Ontology 建模、API-first 架构、Copilot 协同——每一个单独拿出来都是重量级工程挑战，三个叠在一起没有人知道会发生什么。

如果翻了，复盘也会完整记录在这里。
