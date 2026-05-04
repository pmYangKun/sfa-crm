# Configuration Contracts: 公网部署安全/治理硬化

**Feature**: [spec.md](../spec.md) | **Data Model**: [data-model.md](../data-model.md)

本 feature 通过 **6 个新 SystemConfig key**（DB 中）+ **多个 .env 字段**（环境变量）驱动行为。所有阈值与开关都可以在不改代码的情况下调整（宪法第三条）。

---

## 1. SystemConfig 新增 key 契约

存储位置：[`src/backend/app/models/system_config.py`](d:/MyProgramming/cc/SFACRM/src/backend/app/models/system_config.py) 的 `system_config` 表（key-value）

### 1.1 `llm_user_minute_limit`

| 项 | 值 |
|---|---|
| 类型 | INTEGER（字符串存储，读取时 int 化） |
| 默认值 | `10` |
| 合法范围 | 1 ≤ x ≤ 100 |
| 含义 | 单 (IP, user) 每分钟 chat 请求上限 |
| 变更生效 | **冷启动**（重启 uvicorn） |
| 写入权限 | `config.manage`（admin 角色） |

### 1.2 `llm_user_daily_limit`

| 项 | 值 |
|---|---|
| 类型 | INTEGER |
| 默认值 | `100` |
| 合法范围 | 10 ≤ x ≤ 1000 |
| 含义 | 单 (IP, user) 每日 chat 请求上限 |
| 变更生效 | 冷启动 |
| 写入权限 | `config.manage` |

### 1.3 `llm_global_hourly_limit`

| 项 | 值 |
|---|---|
| 类型 | INTEGER |
| 默认值 | `200` |
| 合法范围 | 50 ≤ x ≤ 2000 |
| 含义 | 全站 LLM 调用每小时上限，超则熔断 |
| 变更生效 | **热生效**（每次 chat 请求查 SystemConfig） |
| 写入权限 | `config.manage` |

### 1.4 `demo_reset_enabled`

| 项 | 值 |
|---|---|
| 类型 | BOOLEAN（字符串 `"true"` / `"false"` 存储） |
| 默认值 | `"true"` |
| 含义 | 半小时重置总开关 |
| 变更生效 | **热生效**（scheduler job 每次触发查 SystemConfig） |
| 写入权限 | `config.manage` |

### 1.5 `demo_reset_interval_minutes`

| 项 | 值 |
|---|---|
| 类型 | INTEGER |
| 默认值 | `30` |
| 合法范围 | 5 ≤ x ≤ 240 |
| 含义 | 重置间隔分钟数 |
| 变更生效 | **半冷生效**（运行中改值不会立即调整 scheduler 的下个触发点；下个完整周期生效） |
| 写入权限 | `config.manage` |

### 1.6 `prompt_guard_keywords`

| 项 | 值 |
|---|---|
| 类型 | TEXT（JSON 字符串数组） |
| 默认值 | research.md Decision 3 中的初始词表（17 个词） |
| 含义 | jailbreak 关键词词表，匹配采用大小写不敏感子串包含 |
| 变更生效 | **热生效**（带 60 秒进程内缓存） |
| 写入权限 | `config.manage` |

**默认值 JSON**：
```json
[
  "忽略上述", "忽略以上", "ignore previous", "ignore above",
  "disregard instructions", "disregard above",
  "system prompt", "原始 prompt", "原始指令",
  "你现在是", "你将扮演", "扮演一个",
  "不受任何限制", "no restrictions", "override your",
  "jailbreak", "DAN mode", "开发者模式", "developer mode"
]
```

### 1.7 既有 key 的扩展

无；本 feature 不修改既有 SystemConfig key。

---

## 2. 环境变量 (.env) 契约

### 2.1 `JWT_SECRET`

| 项 | 值 |
|---|---|
| 类型 | string（≥ 32 字符） |
| 必填 | **生产 ENV 必填且非占位符** |
| 默认值 | `"change-me-in-production"`（dev 用） |
| 校验 | 启动时 `_assert_production_secrets()` 检测；`ENV=production` 且值是占位符 → `raise SystemExit` |
| 用途 | JWT 签名 |
| 来源 | `cryptography.token_urlsafe(32)` 或 `openssl rand -base64 48` |

### 2.2 `LLM_KEY_FERNET_KEY`

| 项 | 值 |
|---|---|
| 类型 | string（base64 编码的 32 字节，长度 44） |
| 必填 | **生产 ENV 必填**；dev 缺省 fallback |
| 默认值 | dev fallback：`dev-fallback-fernet-key-do-not-use-in-prod-base64==`（启动 warning） |
| 校验 | 启动时尝试 `Fernet(os.environ["LLM_KEY_FERNET_KEY"])` 实例化；ENV=production 缺失 → 拒绝启动 |
| 用途 | 加解密 `llm_config.api_key` |
| 来源 | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

**重要警告**（必入 deploy.md）：
- 丢失此 key = 所有已存的 LLM API Key 永久无法解密
- rotate 必须先解密老数据再用新 key 重新加密
- 生产环境备份此 key 到独立的安全位置（不要与 DB 备份放一起）

### 2.3 `CORS_ORIGINS`

| 项 | 值 |
|---|---|
| 类型 | string（逗号分隔的 URL 列表） |
| 必填 | 生产强烈建议；dev 默认 |
| 默认值 | `"http://localhost:3000"` |
| 生产示例 | `"https://sfacrm.pmyangkun.com"` |
| 校验 | 启动时解析为列表，传给 FastAPI CORSMiddleware |
| 用途 | 允许的浏览器源 |

### 2.4 `ENV`

| 项 | 值 |
|---|---|
| 类型 | enum: `"dev"` / `"production"` |
| 必填 | 否（默认 `"dev"`） |
| 含义 | 区分启动校验严格度——`production` 时拒绝所有占位符密钥 |

### 2.5 LLM Provider Keys（按 provider 选填）

| 项 | 值 |
|---|---|
| `ANTHROPIC_API_KEY` | string；如果运维选 Anthropic 作为默认 LLM 时建议预填，启动时若 DB 中 llm_config 表为空可 fallback 用此值初始化 |
| `DEEPSEEK_API_KEY` | 同上，DeepSeek provider |

> **注**：API Key 主存储是 DB 中的 `llm_config.api_key`（加密）；env 中的是首次部署的便利 fallback，不强制。

---

## 3. `.env.production.example` 文件契约

仓库根新增 [.env.production.example](d:/MyProgramming/cc/SFACRM/.env.production.example)（spec.md FR-034），内容：

```bash
# ==========================================================
# SFA CRM 生产环境配置模板
# 复制为 .env.production 后填入真实值，不要 commit 到 git
# ==========================================================

# 运行环境（启动校验严格度由此驱动）
ENV=production

# ----- 必填密钥 -----

# JWT 签名密钥（≥ 32 字符随机串），生成命令：openssl rand -base64 48
JWT_SECRET=__REPLACE_ME_WITH_REAL_SECRET__

# LLM API Key 加密的 Fernet 密钥（base64，44 字符），生成命令：
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# ⚠️ 丢失此 key = 所有 llm_config.api_key 永久无法解密！必须独立备份。
LLM_KEY_FERNET_KEY=__REPLACE_ME_WITH_FERNET_KEY__

# ----- 域名与跨域 -----

# 允许的浏览器源（多个用逗号分隔，无空格）
CORS_ORIGINS=https://sfacrm.pmyangkun.com

# ----- 数据库 -----

# SQLite 文件路径（绝对路径推荐）
DATABASE_URL=sqlite:////var/lib/sfa-crm/sfa_crm.db

# ----- LLM Provider（选填，首次部署便利 fallback；后续走 admin UI） -----

# ANTHROPIC_API_KEY=sk-ant-...
# DEEPSEEK_API_KEY=sk-...
```

---

## 4. `docker-compose.yml` 契约

文件：[`src/docker-compose.yml`](d:/MyProgramming/cc/SFACRM/src/docker-compose.yml)

**变更点**（spec.md FR-026）：
- `JWT_SECRET=change-me-in-production` 硬编码 → `JWT_SECRET=${JWT_SECRET:?JWT_SECRET must be set}`
- 新增 `LLM_KEY_FERNET_KEY=${LLM_KEY_FERNET_KEY:?LLM_KEY_FERNET_KEY must be set}`
- 新增 `CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:3000}`
- 新增 `ENV=${ENV:-dev}`

`compose up` 时若 `.env` 缺关键 secret，docker-compose 自身报错拒绝启动（不需要进入容器才发现）。

---

## 5. 启动校验契约

文件：[`src/backend/app/core/config.py`](d:/MyProgramming/cc/SFACRM/src/backend/app/core/config.py)

新增函数 `_assert_production_secrets()`，在 FastAPI lifespan **startup 阶段最早**调用：

```python
def _assert_production_secrets() -> None:
    """生产环境密钥强校验。失败 → SystemExit。"""
    if settings.ENV != "production":
        return  # dev 模式下可宽松

    errors = []
    if settings.JWT_SECRET == "change-me-in-production" or not settings.JWT_SECRET:
        errors.append("JWT_SECRET 必须在生产环境设置真实值（≥ 32 字符）")
    if not os.environ.get("LLM_KEY_FERNET_KEY"):
        errors.append("LLM_KEY_FERNET_KEY 必须在生产环境配置（用 Fernet.generate_key() 生成）")
    if not settings.CORS_ORIGINS or "*" in str(settings.CORS_ORIGINS):
        errors.append("CORS_ORIGINS 必须在生产环境配置具体域名（不能用 *）")

    if errors:
        msg = "❌ 生产环境密钥校验失败：\n  - " + "\n  - ".join(errors)
        msg += "\n\n请检查 .env.production，参考 .env.production.example"
        print(msg, file=sys.stderr)
        raise SystemExit(1)
```

---

## 6. 配置变更生效时机一览

| 配置项 | 类型 | 变更后是否需要重启 |
|---|---|---|
| `JWT_SECRET` | env | ✅ 重启（变更后已签发 token 失效） |
| `LLM_KEY_FERNET_KEY` | env | ✅ 重启（且需要 rotate 老数据） |
| `CORS_ORIGINS` | env | ✅ 重启 |
| `llm_user_minute_limit` | DB | ✅ 重启 uvicorn |
| `llm_user_daily_limit` | DB | ✅ 重启 |
| `llm_global_hourly_limit` | DB | ❌ 热生效 |
| `demo_reset_enabled` | DB | ❌ 热生效 |
| `demo_reset_interval_minutes` | DB | ⚠️ 下周期生效 |
| `prompt_guard_keywords` | DB | ❌ 热生效（60s 缓存） |

---

## 7. 输出

✅ Configuration Contracts 完成。覆盖 spec.md FR-007 / FR-009 / FR-016 / FR-025 / FR-026 / FR-028 / FR-032 / FR-034。
