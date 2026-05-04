# Phase 1 Data Model: 公网部署安全/治理硬化

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

本 feature 引入 **2 张新表** + **5 个新 SystemConfig 配置 key** + **1 张已有表的字段加解密语义改动**。无业务对象 schema 改动。

---

## 1. 新增表：`chat_audit`

**用途**：每条 chat 请求的审计日志，含输入输出摘要、是否被拦截、拦截原因；spec.md FR-005 / SC-011。

**SQLModel 类**：[`src/backend/app/models/chat_audit.py`](d:/MyProgramming/cc/SFACRM/src/backend/app/models/chat_audit.py)（新文件）

### 字段

| 字段 | 类型 | 约束 | 含义 |
|---|---|---|---|
| `id` | INTEGER | PK, autoincrement | 主键 |
| `user_id` | INTEGER | nullable, FK → user.id | 发起 chat 的用户 ID；未登录请求为 NULL |
| `client_ip` | TEXT | NOT NULL | 客户端 IP（从 `X-Forwarded-For` 或 `request.client.host` 取） |
| `user_agent` | TEXT | nullable | 浏览器 ua 字符串（截断 500 字符） |
| `input_length` | INTEGER | NOT NULL | 用户原始输入长度（字符数） |
| `input_excerpt` | TEXT | NOT NULL | 输入前 200 字（脱敏：连续数字串脱敏成 `***`） |
| `output_excerpt` | TEXT | nullable | LLM 回复前 200 字；被拦截的 chat 此字段记固定话术 |
| `blocked_by` | TEXT | nullable | 拦截原因枚举：`prompt_guard` / `rate_limit_minute` / `rate_limit_day` / `llm_circuit_breaker` / NULL=未拦截 |
| `created_at` | DATETIME | NOT NULL, default=now() | 写入时间，UTC |

### 索引

- `idx_chat_audit_created_at` ON `created_at` —— 时间范围查询常用
- `idx_chat_audit_user_blocked` ON `(user_id, blocked_by)` —— "查某用户被拦记录" 与 "查所有被拦记录" 都用得上
- `idx_chat_audit_ip` ON `client_ip` —— 按 IP 排查滥用

### 半小时重置行为

`reset_business_data()` 中**清空**该表（spec.md FR-013）。

### 写入策略

- **Fire-and-forget**：在 chat 端点处理流的 `finally` 块异步写入，**不阻塞响应**
- 拦截类请求（被 prompt_guard / rate_limit / circuit_breaker 拦的）也要写——这是回溯滥用的关键数据
- 写入失败不向上抛异常（避免 audit 故障影响主路径），只 log warning

---

## 2. 新增表：`llm_call_counter`

**用途**：全站 LLM 调用计数器，按小时桶累加；用于 spec.md FR-009 全局熔断判定。

**SQLModel 类**：[`src/backend/app/models/llm_call_counter.py`](d:/MyProgramming/cc/SFACRM/src/backend/app/models/llm_call_counter.py)（新文件）

### 字段

| 字段 | 类型 | 约束 | 含义 |
|---|---|---|---|
| `hour_bucket` | TEXT | PK, length=10 | 小时桶 key，格式 `YYYYMMDDHH`（例如 `2026050414`） |
| `count` | INTEGER | NOT NULL, default=0 | 该小时内累计成功调用 LLM 次数 |
| `updated_at` | DATETIME | NOT NULL | 最后更新时间 |

### 写入策略

- **每次成功调用 LLM 后** + 1（在 `/agent/llm-proxy` 端点流式响应**完成时** 累加，而非进入时——保证只统计真实消耗 token 的请求）
- 用 `INSERT OR REPLACE` 配合 `UPDATE counter SET count = count + 1 WHERE hour_bucket = :h` 实现原子累加
- 熔断判定逻辑：进入 chat 路径前 SELECT 当前小时桶 → 与 `SystemConfig.llm_global_hourly_limit` 比较 → 超过则返回 503（不进 LLM 也不累加计数器）

### 半小时重置行为

`reset_business_data()` 清空该表（spec.md FR-013）。

### 索引

主键 `hour_bucket` 是查询的唯一字段，无需额外索引。

---

## 3. 新增 SystemConfig 配置 key（5 个）

复用现有 `SystemConfig` 表（key-value 模式，[`src/backend/app/models/system_config.py`](d:/MyProgramming/cc/SFACRM/src/backend/app/models/system_config.py)），不改表结构，只在 `init_db` 中**插入 5 个新默认行**。

| key | type | default | 范围 | 含义 |
|---|---|---|---|---|
| `llm_user_minute_limit` | INTEGER | `10` | 1-100 | 单 (IP, user) 每分钟 chat 请求上限（spec.md FR-007） |
| `llm_user_daily_limit` | INTEGER | `100` | 10-1000 | 单 (IP, user) 每日 chat 请求上限（spec.md FR-007） |
| `llm_global_hourly_limit` | INTEGER | `200` | 50-2000 | 全站 LLM 调用每小时上限，超则熔断（spec.md FR-009） |
| `demo_reset_enabled` | BOOLEAN | `true` | `true`/`false` | 半小时重置总开关（spec.md FR-016） |
| `demo_reset_interval_minutes` | INTEGER | `30` | 5-240 | 重置间隔分钟数（spec.md FR-016） |
| `prompt_guard_keywords` | TEXT (JSON) | 见 research.md Decision 3 | JSON 数组 | jailbreak 关键词词表（spec.md FR-002） |

> **注**：`prompt_guard_keywords` 严格说是第 6 个 key，但与 5 个阈值类不同语义。它存储 JSON 数组（["忽略上述", "ignore previous", ...]），匹配采用大小写不敏感子串包含。

### 配置变更生效时机

- 限流值（minute / daily / hourly）：**冷启动生效**——SlowAPI 装饰器在应用启动时绑定阈值；运行时改 SystemConfig 不影响已挂载的装饰器，需重启 uvicorn
- 半小时重置开关与间隔：**热生效**——scheduler job 每次触发前查 SystemConfig，可不重启变更
- prompt_guard_keywords：**热生效**——每次 chat 请求时实时查 SystemConfig（带 60 秒进程内缓存避免 DB 压力）

---

## 4. 已有表 `llm_config` 的字段加解密语义

**模型文件**：[`src/backend/app/models/llm_config.py`](d:/MyProgramming/cc/SFACRM/src/backend/app/models/llm_config.py)

**Schema 不变**：`api_key TEXT NOT NULL` 字段名/类型保持。

**读写路径改造**：
- 写入：`SQLModel.__init__()` 时若传入 `api_key` 是明文，自动用 Fernet 加密后存入；DB 中物理存储是密文
- 读取：访问 `instance.api_key` 时透明解密（用 SQLAlchemy `@validates` 或 Pydantic `field_validator`）
- 持久化与传输边界：DB 行 = 密文；Python 对象 = 明文（仅在内存中）；HTTP 响应 = **永不返回**（spec.md FR-029）

**Fernet key 管理**：
- 来源：env `LLM_KEY_FERNET_KEY`，base64 编码字符串（`Fernet.generate_key().decode()`）
- dev 缺省 fallback：固定字符串 `dev-fallback-fernet-key-do-not-use-in-prod-base64==` + 启动 warning
- 生产强制：`ENV=production` 且 env 缺失 → `raise SystemExit`（spec.md FR-028）

**迁移策略**（首次部署到生产环境）：
1. 先写好新代码（加解密包装），但保留兼容老明文读取
2. 部署到生产 → 启动时跑一次性迁移脚本 `python -m app.scripts.encrypt_existing_llm_keys` → 把所有 llm_config.api_key 从明文转成密文
3. 后续部署只走加密路径
4. 迁移脚本仅本次需要，写到 deploy.md 但不进自动化流程

---

## 5. 实体关系图（ER）

```
┌──────────────────┐       ┌──────────────────┐
│   user (existing)│◄──────│   chat_audit     │
│                  │  user │   (new)          │
│  id PK           │   _id │                  │
│  ...             │       │  id PK           │
└──────────────────┘       │  user_id FK?     │
                           │  client_ip       │
                           │  user_agent      │
                           │  input_length    │
                           │  input_excerpt   │
                           │  output_excerpt  │
                           │  blocked_by      │
                           │  created_at      │
                           └──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│ llm_call_counter │       │ system_config    │
│   (new)          │       │   (existing)     │
│                  │       │                  │
│  hour_bucket PK  │       │  key PK          │
│  count           │       │  value           │
│  updated_at      │       │  ...             │
└──────────────────┘       └──────────────────┘
                              新增 6 个 key 行：
                              - llm_user_minute_limit
                              - llm_user_daily_limit
                              - llm_global_hourly_limit
                              - demo_reset_enabled
                              - demo_reset_interval_minutes
                              - prompt_guard_keywords (JSON)

┌──────────────────┐
│ llm_config       │
│   (existing)     │
│                  │
│  id PK           │
│  provider        │
│  api_key TEXT    │ ◄── 字段类型不变，但物理存储从明文 → Fernet 密文
│  model_name      │
│  ...             │
└──────────────────┘
```

---

## 6. 状态流转

### chat_audit.blocked_by 状态枚举

```
NULL ←─ 通过（默认）
prompt_guard ←─ 黑名单词表命中
rate_limit_minute ←─ 1 分钟内超 10 条
rate_limit_day ←─ 1 天内超 100 条
llm_circuit_breaker ←─ 全站 LLM 1 小时超 200 次
```

每条 chat 请求 **必经过这 4 个 gate**（顺序：prompt_guard → rate_limit_minute → rate_limit_day → llm_circuit_breaker → 调 LLM），任一拦截即停止后续 gate 检查并写 audit。

### llm_call_counter.hour_bucket 滚动

```
2026050413 (上一小时)
2026050414 (当前小时) ←── 累加
2026050415 (下一小时) ←── 滚到下小时后新建行
```

不主动清理老 hour_bucket 行，由半小时 reset_business_data() 一并清。

---

## 7. 性能与容量评估

| 维度 | 评估 |
|---|---|
| chat_audit 增长率 | 5 demo 账号 × 100 条/天 = 500 行/天；30 天 = 15,000 行；半小时重置一直清，实际不会累积 |
| llm_call_counter 增长 | 24 行/天（每小时一行），半小时重置清空 → 任意时刻 ≤ 1 行 |
| chat_audit 写入延迟 | fire-and-forget 异步，对 chat 响应延迟无可见影响 |
| 限流计数器（SlowAPI 内存） | 每个 (IP, user) 组合 1 个计数器，5 账号 × 几个 IP = 30 个 key ≤ 1KB 内存 |
| Fernet 加解密耗时 | 单次 < 1ms，仅在 LLM proxy 调用前/后各一次，可忽略 |

---

## 8. 与 spec 001 的关系

- spec 001 引入的表（无新增业务表）/ 字段全部不动
- spec 001 的 `agent_system_prompt` SystemConfig 行被本 spec 末尾追加边界条款；通过 `init_db.py` 的更新逻辑兼容（既有部署在 `init_db()` 重跑时不会覆盖运行时的 prompt 修改——通过幂等检查保护）

---

## 9. 输出

✅ Phase 1 数据模型完成。下一步生成 `contracts/api-contracts.md` 与 `contracts/config-contracts.md`。
