# Spec 004 Data Model

---

## 1. Schema Changes

### 1.1 `lead` table 增量

```sql
-- 新增 3 列，全部可空（FR-001）
ALTER TABLE lead ADD COLUMN amount REAL;
ALTER TABLE lead ADD COLUMN close_date TEXT;
ALTER TABLE lead ADD COLUMN forecast_category TEXT NOT NULL DEFAULT '进行中'
    CHECK (forecast_category IN ('进行中', '必赢', '大概率', '乐观估算', '已赢单', '已丢单'));

-- 新索引（FR-040）
CREATE INDEX IF NOT EXISTS idx_lead_owner_score_close
    ON lead(owner_id, meddicc_score, close_date);
CREATE INDEX IF NOT EXISTS idx_lead_forecast_category
    ON lead(forecast_category, stage);
```

### 1.2 `lead_meddicc_history` 新表

```sql
CREATE TABLE lead_meddicc_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    snapshot_at TEXT NOT NULL,
    meddicc_score REAL,
    meddicc_completion INTEGER,  -- 0-7
    dimensions_json TEXT,         -- {"M": {"evidence_count": 3, "lit": true}, ...}
    forecast_category TEXT,
    amount REAL,
    trigger_reason TEXT NOT NULL  -- 'analyze' | 'forecast_change' | 'backfill'
        CHECK (trigger_reason IN ('analyze', 'forecast_change', 'backfill')),
    FOREIGN KEY (lead_id) REFERENCES lead(id) ON DELETE CASCADE
);

CREATE INDEX idx_history_lead_time ON lead_meddicc_history(lead_id, snapshot_at);
CREATE INDEX idx_history_trigger ON lead_meddicc_history(trigger_reason);
```

### 1.3 `system_config` 新增配置

| key | value (default) | 来源 |
|---|---|---|
| `warning_silent_days` | `14` | spec 004 新加 |
| `warning_brag_lit_threshold` | `5` | spec 004 新加 |
| `warning_close_imminent_days` | `14` | spec 004 新加 |
| `warning_close_imminent_score` | `60` | spec 004 新加 |
| `warning_no_champion_followup_count` | `3` | spec 004 新加 |
| `warning_single_contact_days` | `30` | spec 004 新加 |
| `warning_big_deal_amount_multiplier` | `3` | spec 004 新加 |
| `meddicc_score_completeness_weight` | `60` | spec 003 迁移 |
| `meddicc_score_depth_weight` | `25` | spec 003 迁移 |
| `meddicc_score_activity_weight` | `15` | spec 003 迁移 |
| `meddicc_activity_recent_days` | `7` | spec 003 迁移 |
| `meddicc_activity_acceptable_days` | `30` | spec 003 迁移 |

`init_db.py` 加幂等 INSERT：仅当 key 不存在时插入（沿用 spec 002 模式）。

---

## 2. ER Diagram (incremental)

```
   ┌─────────────────────┐
   │ lead                │
   ├─────────────────────┤
   │ id (PK)             │
   │ company_name        │
   │ stage               │  active | converted | lost
   │ pool                │
   │ owner_id (FK→user)  │
   │ ...                 │
   │ meddicc_score       │  ← spec 003
   │ meddicc_completion  │  ← spec 003
   │ amount         (NEW)│  ← spec 004
   │ close_date     (NEW)│  ← spec 004
   │ forecast_category   │  ← spec 004
   └────────┬────────────┘
            │
            │ 1
            │
            ▼ N
   ┌──────────────────────────┐
   │ lead_meddicc_history     │  ← spec 004 新表
   ├──────────────────────────┤
   │ id (PK)                  │
   │ lead_id (FK→lead)        │
   │ snapshot_at              │
   │ meddicc_score            │
   │ meddicc_completion       │
   │ dimensions_json          │
   │ forecast_category        │
   │ amount                   │
   │ trigger_reason           │
   └──────────────────────────┘
```

---

## 3. Migration Strategy

**Pure Additive：** 无 column 删除 / rename / type change。所有改动向前兼容。

**alembic upgrade head 步骤：**
1. ALTER TABLE lead 加 3 字段
2. CREATE TABLE lead_meddicc_history
3. CREATE INDEX 4 个
4. （`init_db.py` 触发）幂等 INSERT system_config 12 条
5. （`init_db.py` 触发）后台异步 backfill 任务跑一次 baseline

**Demo data seeding（reset-demo.bat 触发）：**
- 重置 lead 表时，给所有 demo lead 设置 forecast_category（分布让 6 tab 都有数据）
- 设置 amount + close_date（演示 close_date 临近 warning）
- 增加 5-7 条新 demo lead 横跨 6 个 forecast bucket
- 重置后立即触发一次 backfill snapshot（保证趋势图开局就有 baseline）

---

## 4. Backfill Logic

```python
# app/core/backfill_task.py 伪代码
async def backfill_meddicc_history():
    leads = db.query(Lead).filter(Lead.stage == 'active').all()
    for lead in leads:
        # 跳过已有 baseline 的（idempotent）
        existing = db.query(LeadMeddiccHistory).filter_by(lead_id=lead.id).count()
        if existing > 0:
            continue
        # 跑 analyze → 写 snapshot
        await analyze_meddicc(lead.id)
        write_history_snapshot(lead.id, trigger_reason='backfill')
    log("backfill done", lead_count=len(leads))
```

启动时由 `init_db.py` 调度（仅在 history 表为空时跑，避免重复 backfill）。

---

## 5. Snapshot Trigger Points

| Trigger | Where in code | Reason value |
|---|---|---|
| Manual analyze | `analyze_meddicc()` 末尾 | `analyze` |
| forecast_category 变更 | `update_lead()` API 检测 forecast_category diff | `forecast_change` |
| 启动 backfill | `backfill_task.run()` | `backfill` |

每次写入 snapshot 都包含当时点的：score / completion / dimensions / forecast_category / amount。这样未来如果想做"forecast 变化历史" / "amount 变化历史"图，数据已现成。
