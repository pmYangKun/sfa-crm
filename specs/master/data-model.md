# 数据模型设计

**项目**: SFA CRM | **日期**: 2026-03-31
**依据**: `spec/ontology.md` + `specs/master/research.md`

---

## 数据库：SQLite（WAL 模式）

连接配置：
- `journal_mode = WAL`
- `foreign_keys = ON`
- `busy_timeout = 5000`
- `synchronous = NORMAL`

所有主键使用 UUID（TEXT 存储）。时间字段使用 ISO 8601 字符串存储。

---

## 表结构

### org_node — 组织节点

```sql
CREATE TABLE org_node (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('root', 'region', 'team', 'custom')),
    parent_id   TEXT REFERENCES org_node(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

查询策略：全表加载到内存，Python 侧递归遍历获取子树节点 ID。

---

### user — 用户

```sql
CREATE TABLE user (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    login        TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    org_node_id  TEXT NOT NULL REFERENCES org_node(id),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

### role — 角色

```sql
CREATE TABLE role (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

内置角色（is_system=TRUE）：销售、战队队长、大区总、销售VP、督导、系统管理员

---

### permission — 权限点

```sql
CREATE TABLE permission (
    id      TEXT PRIMARY KEY,
    code    TEXT NOT NULL UNIQUE,  -- e.g. 'lead.create'
    module  TEXT NOT NULL,          -- e.g. 'lead'
    name    TEXT NOT NULL
);
```

---

### role_permission — 角色权限关联

```sql
CREATE TABLE role_permission (
    role_id       TEXT NOT NULL REFERENCES role(id),
    permission_id TEXT NOT NULL REFERENCES permission(id),
    PRIMARY KEY (role_id, permission_id)
);
```

---

### user_role — 用户角色关联（支持一人多角色）

```sql
CREATE TABLE user_role (
    user_id TEXT NOT NULL REFERENCES user(id),
    role_id TEXT NOT NULL REFERENCES role(id),
    PRIMARY KEY (user_id, role_id)
);
```

---

### user_data_scope — 用户数据权限

```sql
CREATE TABLE user_data_scope (
    user_id  TEXT PRIMARY KEY REFERENCES user(id),
    scope    TEXT NOT NULL CHECK (scope IN (
                 'self_only', 'current_node', 'current_and_below',
                 'selected_nodes', 'all'
             )),
    node_ids TEXT  -- JSON 数组，仅 selected_nodes 时使用：'["id1","id2"]'
);
```

---

### lead — 线索

```sql
CREATE TABLE lead (
    id               TEXT PRIMARY KEY,
    company_name     TEXT NOT NULL,
    unified_code     TEXT,              -- 组织机构代码，唯一但非必填
    region           TEXT NOT NULL,     -- 大区，与 org_node 的 region 节点对应
    stage            TEXT NOT NULL DEFAULT 'active'
                         CHECK (stage IN ('active', 'converted', 'lost')),
    pool             TEXT NOT NULL DEFAULT 'public'
                         CHECK (pool IN ('private', 'public')),
    owner_id         TEXT REFERENCES user(id),  -- NULL 时在公共池
    source           TEXT NOT NULL
                         CHECK (source IN ('referral', 'organic', 'koc_sem', 'outbound')),
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    last_followup_at TEXT,
    converted_at     TEXT,
    lost_at          TEXT,
    UNIQUE (unified_code) -- 有组织机构代码时精确唯一
);
```

---

### customer — 客户

```sql
CREATE TABLE customer (
    id            TEXT PRIMARY KEY,
    lead_id       TEXT NOT NULL UNIQUE REFERENCES lead(id),
    company_name  TEXT NOT NULL,
    unified_code  TEXT,
    region        TEXT NOT NULL,
    owner_id      TEXT NOT NULL REFERENCES user(id),
    source        TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    -- 无 status 字段：购买情况从课时订单系统实时推导
);
```

---

### contact — 联系人

```sql
CREATE TABLE contact (
    id                    TEXT PRIMARY KEY,
    lead_id               TEXT REFERENCES lead(id),
    customer_id           TEXT REFERENCES customer(id),
    name                  TEXT NOT NULL,
    role                  TEXT,
    is_key_decision_maker BOOLEAN NOT NULL DEFAULT FALSE,
    wechat_id             TEXT,
    phone                 TEXT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (
        (lead_id IS NOT NULL AND customer_id IS NULL) OR
        (lead_id IS NULL AND customer_id IS NOT NULL)
    )
);
```

---

### contact_relation — 联系人关系

```sql
CREATE TABLE contact_relation (
    id            TEXT PRIMARY KEY,
    contact_a_id  TEXT NOT NULL REFERENCES contact(id),
    contact_b_id  TEXT NOT NULL REFERENCES contact(id),
    relation_type TEXT NOT NULL CHECK (relation_type IN ('spouse', 'relative', 'partner', 'friend')),
    note          TEXT,
    created_by    TEXT NOT NULL REFERENCES user(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (contact_a_id < contact_b_id)  -- 防止重复 (A,B) 和 (B,A)
);
```

---

### followup — 跟进记录

```sql
CREATE TABLE followup (
    id           TEXT PRIMARY KEY,
    lead_id      TEXT REFERENCES lead(id),
    customer_id  TEXT REFERENCES customer(id),
    contact_id   TEXT REFERENCES contact(id),
    owner_id     TEXT NOT NULL REFERENCES user(id),
    type         TEXT NOT NULL CHECK (type IN ('phone', 'wechat', 'visit', 'other')),
    source       TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
    content      TEXT NOT NULL,
    followed_at  TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (
        (lead_id IS NOT NULL AND customer_id IS NULL) OR
        (lead_id IS NULL AND customer_id IS NOT NULL)
    )
);
```

---

### key_event — 关键事件

```sql
CREATE TABLE key_event (
    id          TEXT PRIMARY KEY,
    lead_id     TEXT REFERENCES lead(id),
    customer_id TEXT REFERENCES customer(id),
    type        TEXT NOT NULL CHECK (type IN (
                    'visited_kp', 'book_sent', 'attended_small_course',
                    'purchased_big_course', 'contact_relation_discovered'
                )),
    payload     TEXT NOT NULL DEFAULT '{}',  -- JSON
    created_by  TEXT NOT NULL REFERENCES user(id),
    occurred_at TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (
        (lead_id IS NOT NULL AND customer_id IS NULL) OR
        (lead_id IS NULL AND customer_id IS NOT NULL)
    )
);
```

**payload 示例**：
- `book_sent`：`{"sent_at": "...", "responded_at": null, "confirmed_reading": false}`
- `purchased_big_course`：`{"contract_amount": 200000, "purchase_date": "..."}`

---

### daily_report — 日报

```sql
CREATE TABLE daily_report (
    id           TEXT PRIMARY KEY,
    owner_id     TEXT NOT NULL REFERENCES user(id),
    report_date  TEXT NOT NULL,  -- 'YYYY-MM-DD'
    content      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    submitted_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (owner_id, report_date)
);
```

---

### system_config — 系统配置

```sql
CREATE TABLE system_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    description TEXT,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**初始配置项**：

| key | 默认值 | 说明 |
|-----|--------|------|
| `private_pool_limit` | `100` | 私有池线索上限 |
| `followup_release_days` | `10` | 未跟进释放天数 |
| `conversion_release_days` | `30` | 未成单释放天数 |
| `claim_rate_limit` | `10` | 每分钟最大抢占次数 |
| `daily_report_generate_at` | `18:00` | 日报生成时间 |
| `name_similarity_threshold` | `85` | 公司名模糊匹配阈值（0-100） |
| `region_claim_rules` | `{}` | 各大区抢占规则 JSON |

---

### skill — AI 技能

```sql
CREATE TABLE skill (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    trigger    TEXT NOT NULL,   -- 触发场景描述
    content    TEXT NOT NULL,   -- 提示词文本
    category   TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

### llm_config — LLM 配置

```sql
CREATE TABLE llm_config (
    id         TEXT PRIMARY KEY,
    provider   TEXT NOT NULL,   -- 'anthropic' / 'openai' / 'deepseek' / etc.
    model      TEXT NOT NULL,
    api_key    TEXT NOT NULL,   -- 加密存储
    is_active  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

约束：任意时刻只有一条 `is_active = TRUE`，应用层保证。

---

### conversation_message — 对话历史

```sql
CREATE TABLE conversation_message (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id    TEXT NOT NULL REFERENCES user(id),
    role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_conversation_session ON conversation_message(session_id, created_at);
```

---

### audit_log — 操作日志

```sql
CREATE TABLE audit_log (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES user(id),
    action      TEXT NOT NULL,   -- 动作名称，如 'assign_lead'
    entity_type TEXT,            -- 操作对象类型，如 'lead'
    entity_id   TEXT,            -- 操作对象 ID
    payload     TEXT,            -- JSON，操作参数
    ip          TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 状态机

### Lead.stage

```
active ──assign/claim──► active (pool: public→private)
active ──mark_lost──────► lost
active ──convert_lead───► converted
```

`converted` 和 `lost` 为终态，不可逆转。

### Lead.pool

```
public ──assign_lead / claim_lead──► private
private ──release_lead (auto/manual)──► public
```

### DailyReport.status

```
draft ──submit_daily_report──► submitted
```

`submitted` 为终态，不可修改，只可追加补充说明。

---

## 关键索引

```sql
-- 线索查询
CREATE INDEX idx_lead_owner ON lead(owner_id, stage);
CREATE INDEX idx_lead_pool ON lead(pool, region);
CREATE INDEX idx_lead_unified_code ON lead(unified_code) WHERE unified_code IS NOT NULL;

-- 客户查询
CREATE INDEX idx_customer_owner ON customer(owner_id);

-- 跟进记录
CREATE INDEX idx_followup_lead ON followup(lead_id, followed_at);
CREATE INDEX idx_followup_customer ON followup(customer_id, followed_at);

-- 关键事件
CREATE INDEX idx_key_event_lead ON key_event(lead_id, type);
CREATE INDEX idx_key_event_customer ON key_event(customer_id, type);

-- 联系人重复检测
CREATE INDEX idx_contact_wechat ON contact(wechat_id) WHERE wechat_id IS NOT NULL;
CREATE INDEX idx_contact_phone ON contact(phone) WHERE phone IS NOT NULL;

-- 操作日志
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at);
```
