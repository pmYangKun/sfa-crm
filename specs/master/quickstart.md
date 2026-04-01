# SFA CRM 快速指南

**项目**: SFA CRM | **更新日期**: 2026-04-01

---

## 一、使用指南（给用户看）

### 访问地址

| 地址 | 用途 |
|------|------|
| http://localhost:3000 | 系统入口（自动跳转登录页） |

### 测试账号

| 账号 | 密码 | 角色 | 能看到什么 |
|------|------|------|-----------|
| `admin` | `12345` | 系统管理员 | 全部功能：数据概览、线索、客户、组织管理、用户管理、角色权限、系统配置、操作日志 |
| `manager01` | `12345` | 战队队长 | 数据概览、团队线索、公共线索库、团队客户、团队日报 |
| `sales01` | `12345` | 销售 | 我的线索、公共线索库、我的客户、我的日报 |

### 核心操作流程

1. **登录** → 用上面任意账号登录
2. **创建线索** → 我的线索 → 新建 → 填写公司名、大区、来源、联系人
3. **分配/抢占** → 管理员可分配线索给销售；销售可从公共线索库抢占
4. **跟进记录** → 进入线索详情 → 添加跟进（电话/微信/拜访）
5. **转化客户** → 线索详情 → 点击"转化"→ 线索变为客户
6. **查看日报** → 我的日报（系统根据当天跟进记录自动生成草稿）
7. **AI 助手** → 页面右下角蓝色气泡 → 输入自然语言指令（需先配置 LLM）

### 配置 AI 助手

1. 用 `admin` 账号登录
2. 侧边栏 → 系统配置 → 「AI 模型配置」区域
3. 选择 Provider（Anthropic / OpenAI / DeepSeek）
4. 填入 Model 名称（如 `claude-sonnet-4-20250514`）和 API Key
5. 点击「保存 LLM 配置」
6. 配置完成后，所有用户页面右下角的 AI 聊天气泡即可使用

---

## 二、开发指南（给开发者看）

### 前置条件

- Python 3.11+
- Node.js 20+
- （可选）Docker & Docker Compose

### 本地启动

**后端（终端 1）：**

```bash
cd src/backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# 初始化数据库（建表 + 种入测试数据）
python -c "from app.core.init_db import init_db; init_db()"

# 启动
uvicorn app.main:app --reload --port 8000
```

**前端（终端 2）：**

```bash
cd src/frontend
npm install
npm run dev
```

**验证：**

| 地址 | 预期 |
|------|------|
| http://localhost:8000 | `{"status": "ok", "service": "SFA CRM API"}` |
| http://localhost:8000/docs | Swagger API 文档 |
| http://localhost:3000 | 前端登录页 |

### Docker 一键启动

```bash
cd src
docker-compose up --build        # 前台运行
docker-compose up -d             # 后台运行
```

### 运行测试

```bash
cd src/backend
pytest tests/integration/ -v     # 12 个集成测试
```

### 目录结构

```
src/
├── backend/
│   └── app/
│       ├── api/           # API 路由（每个模块一个文件）
│       ├── models/        # SQLModel ORM 模型
│       ├── services/      # 业务逻辑层（Ontology Actions）
│       ├── core/          # 数据库、认证、配置、依赖注入
│       └── tools/         # AI Tool Use 定义
├── frontend/
│   └── src/
│       ├── app/           # Next.js App Router 页面
│       ├── components/    # UI 组件（nav/chat/leads/...）
│       └── lib/           # API 客户端、AI SDK 配置
└── docker-compose.yml
```

### 开发规范

1. 业务逻辑写在 `services/`，`api/` 层只做参数校验和权限检查
2. 权限双检：功能权限（`require_permission`）+ 数据范围（`get_visible_user_ids`）
3. 状态变更只通过 Action 函数（`assign_lead()`、`convert_lead()` 等），不直接改字段
4. 新增配置项同步更新 `init_db.py` 中的 `SystemConfig` 种子数据
