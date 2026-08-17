# Phase 1 Data Model: MCP 开放平台

**Feature**: 005-mcp-open-platform
**Date**: 2026-08-13

**范围提示：本 feature 只新增 1 张基础设施表 + 4 个配置项，不新增、不修改任何业务对象。**

---

## 1. 新增实体：`McpToken`（表名 `mcp_token`）

访客领取的接入密钥。属基础设施实体，非 Ontology 业务对象（豁免理由见 plan.md Complexity Tracking）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | str (UUID) | PK | |
| `token_hash` | str | **UNIQUE, INDEX, NOT NULL** | 密钥明文的 SHA-256 摘要。明文不入库 |
| `token_prefix` | str | NOT NULL | 明文前 12 位（如 `sfa_ro_a3f9`），供页面与日志展示，便于用户辨认自己的密钥 |
| `user_id` | str | **FK → user.id**, NOT NULL, INDEX | 密钥映射到的演示账号 |
| `persona` | str | NOT NULL | `sales` \| `manager`，用于展示与统计（真实权限来自 `user_id`） |
| `scope` | str | NOT NULL, default `read` | 预留字段。本期恒为 `read`；写操作那一版将引入 `draft` / `write` |
| `expires_at` | datetime | NOT NULL, INDEX | 发放时间 + 有效期配置值 |
| `created_at` | datetime | NOT NULL | |
| `created_ip` | str | NULL 允许 | 发放来源，用于发放频率限制与滥用排查 |
| `last_used_at` | datetime | NULL 允许 | 每次成功调用后更新 |
| `call_count` | int | NOT NULL, default 0 | 累计成功调用次数 |
| `revoked_at` | datetime | NULL 允许 | 非空即视为已吊销 |

### 关系

- `McpToken.user_id` → `User.id`（多对一）。一个演示账号可对应任意多把有效密钥（访客各领各的，互不影响）
- 无其他外键。**不与任何业务对象产生关联**

### 有效性判定（单一判据，供实现统一引用）

密钥有效 ⟺ `revoked_at IS NULL` **且** `expires_at > now()`

三种无效情形对外的响应必须可区分且可读：

| 情形 | 对外表现 |
|---|---|
| 摘要查不到 | 凭证无效，提示前往 `/open` 领取 |
| `expires_at` 已过 | 凭证已过期，提示前往 `/open` 重新领取（FR-028） |
| `revoked_at` 非空 | 凭证已被吊销，提示前往 `/open` 领取新的 |

### 状态流转

```text
[发放] ──→ 有效 ──┬──→ 过期（到达 expires_at，被动）
                  └──→ 已吊销（revoked_at 置值，主动）
```

无逆向流转：过期或吊销后不可复活，只能重新领取。

### 索引

- `token_hash` UNIQUE：每次调用的查询入口，必须走索引
- `expires_at`：清理过期密钥时使用
- `user_id`：统计与排查

---

## 2. 新增配置项（`SystemConfig`）

沿用 spec 002 建立的模式：**init_db 幂等补 key——缺失则插入，已存在则不覆盖**（避免老库升级时新 key 永远注入不进去，这是 spec 002 踩过的坑）。

| 配置键 | 默认值 | 含义 | 对应 FR |
|---|---|---|---|
| `mcp_token_ttl_days` | `7` | 密钥有效期（天） | FR-004 |
| `mcp_rate_per_minute` | `30` | 每密钥每分钟调用上限 | FR-026 |
| `mcp_rate_per_day` | `500` | 每密钥每日调用上限 | FR-026 |
| `mcp_issue_per_ip_per_day` | `30` | 每来源每日密钥发放上限 | FR-007 |

**宪法原则三合规：以上阈值一律不得在代码中出现字面量。**

---

## 3. 演示身份映射（常量，不入库）

| persona | 映射账号 | 数据范围（由既有 DataScope 决定，非本表配置） |
|---|---|---|
| `sales` | `sales01`（王小明） | 仅本人名下 |
| `manager` | `manager01`（陈队长） | 全团队 |

**不提供 `admin` 身份**（FR-001）。

映射关系以常量维护，并在发放时校验目标账号存在；若种子数据中账号缺失，发放接口须明确报错而非静默降级。

---

## 4. 与既有模型的交互（只读，不修改）

| 既有对象 | 本 feature 的使用方式 |
|---|---|
| `User` | 密钥外键指向；换取身份后交给既有权限体系 |
| `Role` / `Permission` / `UserDataScope` / `OrgNode` | **完全不改**。工具执行时由既有 `get_visible_user_ids` 计算可见范围 |
| `Lead` / `Customer` / `Contact` / `FollowUp` / `KeyEvent` / MEDDICC 相关 | 仅被 9 个只读工具读取，无任何写入路径 |
| `SystemConfig` | 新增 5 个键（见上） |

---

## 5. 演示数据重置的交互（重要）

`demo_reset_service` 采用**显式删除列表**（逐个 `delete(Model)`），而非"清空除白名单外的所有表"。

**因此 `mcp_token` 默认即被保留，无需任何额外配置即满足 FR-030。**

⚠️ **真正的风险是反向的**：未来有人扩充删除列表时"顺手"把 `McpToken` 加进去。对策有二，缺一不可：

1. 在 `demo_reset_service` 的删除列表相邻处写明注释：**`McpToken` 属凭证表，禁止加入本列表**
2. 增加一条集成测试：发放密钥 → 触发一次重置 → 该密钥仍可正常调用（守住 FR-030 与 SC-005）

---

## 6. 数据保留与清理

- 过期密钥**不主动清理**：演示环境体量极小，留存无成本；且保留过期记录能让"密钥已过期"与"凭证无效"两种响应可区分（见 §1 有效性判定）
- 若未来需要清理，按 `expires_at` 早于 N 天前批量删除即可，无级联影响（本表无被引用方）
