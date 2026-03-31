# 快速启动指南

**项目**: SFA CRM | **日期**: 2026-03-31

---

## 前置条件

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- 有效的 Claude API Key（或其他 LLM Provider Key）

---

## 本地开发启动

### 1. 克隆仓库

```bash
git clone https://github.com/pmYangKun/sfa-crm.git
cd sfa-crm
```

### 2. 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# 初始化数据库（创建表 + 种入初始数据）
python -m app.core.init_db

# 启动开发服务器
uvicorn app.main:app --reload --port 8000
```

后端地址：http://localhost:8000
API 文档：http://localhost:8000/docs

### 3. 启动前端

```bash
cd frontend
npm install

# 复制环境变量
cp .env.example .env.local
# 编辑 .env.local，设置 BACKEND_URL=http://localhost:8000

npm run dev
```

前端地址：http://localhost:3000

### 4. 初始账号

| 账号 | 密码 | 角色 |
|------|------|------|
| `admin` | `admin123` | 系统管理员 |
| `sales01` | `test123` | 销售 |
| `manager01` | `test123` | 战队队长 |

### 5. 配置 LLM

登录 Admin 账号 → 系统配置 → LLM 配置 → 添加 API Key，选择激活。

---

## Docker 一键启动

```bash
# 构建并启动所有服务
docker-compose up --build

# 后台运行
docker-compose up -d
```

服务地址：
- 前端：http://localhost:3000
- 后端 API：http://localhost:8000

---

## 目录结构

```
sfa-crm/
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── models/    # SQLModel ORM 模型
│   │   ├── api/       # API 路由（每个模块一个文件）
│   │   ├── services/  # 业务逻辑层
│   │   ├── tools/     # AI Tool Use 定义
│   │   └── core/      # 数据库、认证、配置
│   └── tests/
├── frontend/          # Next.js 前端
│   └── src/
│       ├── app/       # App Router 页面
│       ├── components/# UI 组件（含 chat/ 侧边栏）
│       └── lib/       # API 客户端、Vercel AI SDK 配置
├── spec/              # 业务规格文档
├── specs/master/      # Plan 阶段产出文档
├── .specify/          # spec-kit 配置
└── docker-compose.yml
```

---

## 开发注意事项

1. **所有业务逻辑写在 `services/` 层**，`api/` 层只做参数校验和权限检查，不写业务逻辑
2. **权限校验必须在 API 层完成**，两层：功能权限（Role+Permission）+ 数据范围（DataScope）
3. **所有状态变更通过 Action 函数触发**（在 `services/` 中对应 `assign_lead()`, `convert_lead()` 等），不直接 update 字段
4. **新增配置项**要同时在 `SystemConfig` 初始数据和 `system_config` 表中添加
5. **Tool Use 定义**（`tools/` 目录）与对应的 `services/` 函数一一对应，命名保持一致
