# Phase 1 Data Model: MEDDICC 销售视角

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)
**Date**: 2026-05-05

本阶段固化 spec 003 的数据模型——2 张新表 + Lead 表扩展 3 列，沿用现有 SQLModel + SQLite (WAL) 技术栈，无 migration 工具（依赖 `SQLModel.metadata.create_all()` 启动时自动建表）。

---

## 一、实体清单

| 实体 | 状态 | 用途 |
|---|---|---|
| `Conversation` | 🆕 新建 | 销售-客户原始对话记录，AI 抽 MEDDICC 证据的核心数据燃料 |
| `LeadMeddiccEvidence` | 🆕 新建 | 单条 MEDDICC 维度证据，每条 first-class，含来源指针 + confidence |
| `Lead` | ⚠️ 扩展 | 加 3 个衍生字段（meddicc_score / completion / last_analyzed_at） |
| `ScenarioCard` | 不建表 | 演示场景卡定义存于 Python dict（`app/services/scenario_cards.py`） |

---

## 二、`Conversation`（新建）

**File**: `src/backend/app/models/conversation.py`

```python
"""Conversation model — 销售-客户对话原文记录."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Conversation(SQLModel, table=True):
    __tablename__ = "conversation"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: str = Field(foreign_key="lead.id", index=True)
    recorded_at: str  # ISO 8601, 对话发生时间
    content: str      # 对话原文，建议格式 "销售：...\n客户：..." 多轮

    source: str = Field(default="manual")
    # source 枚举：manual（演示用户粘贴录入）/ scenario_card（场景卡批量注入）/ mock_seed（init_db 种子）

    scenario_card_id: Optional[str] = Field(default=None, index=True)
    # 来自哪张场景卡（仅 source=scenario_card 时有值）
    # 用于 list_cards_for_lead 计算 "已应用 ✓" 状态
    # 用于 unapply 场景（虽然 spec 003 不实施 unapply，预留字段）

    created_by: str = Field(foreign_key="user.id")  # 录入操作的 user_id
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
```

### 字段约束

| 字段 | 约束 |
|---|---|
| `id` | UUID v4，主键 |
| `lead_id` | 外键到 `lead.id`，建索引（按 lead 查询是高频路径） |
| `recorded_at` | ISO 8601 字符串；UI 录入时校验非空且 ≤ now() |
| `content` | 业务约束：1-50000 字（Pydantic v2 在 router 层校验，不做 DB CHECK） |
| `source` | 枚举：`manual` / `scenario_card` / `mock_seed`，router 层校验 |
| `scenario_card_id` | 可空；非空时与 `source=scenario_card` 必须一致（router 层校验） |
| `created_by` | 外键到 `user.id` |
| `created_at` | 自动填充 ISO 8601 |

### 索引

- 主键 `id`（自动）
- `idx_conversation_lead_id` ON `lead_id`（高频按 lead 列出对话）
- `idx_conversation_scenario_card_id` ON `scenario_card_id`（计算 "已应用 ✓" 状态）

### 业务规则（router 层强制）

1. POST 时 `lead_id` 必须存在且对当前用户可见（DataScope 过滤）
2. POST 时 `created_by` = current_user_id（不接受客户端传值）
3. POST 成功后**同步触发** `meddicc_extractor.analyze(lead_id)`
4. DELETE 时 lead 必须对当前用户可见
5. DELETE 后**同步触发** `meddicc_extractor.analyze(lead_id)`（重算）

---

## 三、`LeadMeddiccEvidence`（新建）

**File**: `src/backend/app/models/lead_meddicc_evidence.py`

```python
"""LeadMeddiccEvidence model — 单条 MEDDICC 维度证据，每条 first-class."""

import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class LeadMeddiccEvidence(SQLModel, table=True):
    __tablename__ = "lead_meddicc_evidence"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: str = Field(foreign_key="lead.id", index=True)

    dimension: str = Field(index=True)
    # 枚举：metrics / economic_buyer / decision_criteria / decision_process / pain / champion / competition

    source_type: str
    # 枚举：conversation / followup / key_event

    source_id: str
    # 指向 conversation.id / followup.id / key_event.id（按 source_type 决定哪张表）
    # 不加 FK 约束（多目标，SQLModel 不支持 polymorphic FK）；用 service 层 post-validate 兜底

    evidence_text: str  # ≤200 字，AI 抽出的原文片段或摘要
    confidence: float = Field(default=0.0)  # 0-1

    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
```

### 字段约束

| 字段 | 约束 |
|---|---|
| `id` | UUID v4，主键 |
| `lead_id` | 外键到 `lead.id`，建索引 |
| `dimension` | 枚举（service 层校验） |
| `source_type` | 枚举（service 层校验） |
| `source_id` | 非 FK，仅 service 层 post-validate（research.md Decision 6） |
| `evidence_text` | service 层截断到 200 字 |
| `confidence` | service 层 clamp 到 [0, 1] |
| `created_at` | 自动填充 |

### 索引

- 主键 `id`（自动）
- `idx_evidence_lead_id` ON `lead_id`（高频按 lead 聚合）
- `idx_evidence_dimension` ON `dimension`（按维度分组）
- 复合索引 `idx_evidence_lead_dimension` ON `(lead_id, dimension)`（GET /meddicc 主查询路径）

### 业务规则（service 层强制）

1. **Replace 策略**：每次 `analyze()` 先 `DELETE WHERE lead_id = X`，再 INSERT 新批次（research.md Decision 2）
2. **post-validate**：INSERT 前校验 `source_type` + `source_id`（research.md Decision 6），无效跳过
3. **DELETE evidence 后同步重算 Lead 衍生字段**

### 不加 status 字段

spec 003 brainstorm 阶段已去除 HITL，所有 evidence 都是 AI 自动抽 + 直接生效；用户要剔除直接 DELETE row。**故无 `status: proposed/accepted/rejected` 状态机字段**。

---

## 四、`Lead` 表扩展（+3 字段）

**File**: `src/backend/app/models/lead.py`（修改既有）

```python
class Lead(SQLModel, table=True):
    __tablename__ = "lead"

    # ... 既有字段不变 ...

    # ─────── spec 003 新增 ───────
    meddicc_score: Optional[float] = Field(default=None)
    meddicc_completion: int = Field(default=0)
    meddicc_last_analyzed_at: Optional[str] = Field(default=None)
```

### 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `meddicc_score` | `Optional[float]` | `None` | 0-100；`None` 表示从未分析过 |
| `meddicc_completion` | `int` | `0` | 0-7，已亮维度数 |
| `meddicc_last_analyzed_at` | `Optional[str]` | `None` | ISO 8601；`None` 表示从未分析过 |

### 派生关系（语义）

这 3 个字段**概念上是从 `lead_meddicc_evidence` 派生**，缓存仅为查询性能优化（GET /leads 列表页可用 score 排序而不必每行 group-by 算）。

**重算时机**（service 层强制）：
- 每次 `analyze()` 完成（INSERT 新 evidence 后）
- 每次 DELETE evidence 后
- 每次 DELETE conversation 后（间接通过触发 analyze）

**重算函数**（`score_calculator.recompute(lead_id, db)`）：

```python
def recompute(lead_id: str, db: Session) -> None:
    evidences = db.exec(
        select(LeadMeddiccEvidence).where(LeadMeddiccEvidence.lead_id == lead_id)
    ).all()
    last_activity = _latest_activity_at(lead_id, db)
    score, completion = calculate_meddicc_score(evidences, last_activity)
    lead = db.get(Lead, lead_id)
    lead.meddicc_score = score
    lead.meddicc_completion = completion
    lead.meddicc_last_analyzed_at = now_utc_iso()
    db.add(lead)
    db.commit()
```

---

## 五、关系图

```
┌───────────┐      ┌───────────────────┐      ┌──────────────────────────┐
│   Lead    │──┬──>│  Conversation     │      │  LeadMeddiccEvidence     │
│           │  │   │  (lead_id FK)     │      │  (lead_id FK,            │
│ +meddicc_ │  │   │                   │      │   source_type +          │
│  score    │  │   │  +source          │      │   source_id 指向多目标)  │
│ +meddicc_ │  │   │  +scenario_card_id│      │                          │
│  comple-  │  │   └───────────────────┘      │  +dimension              │
│  tion     │  │                              │  +evidence_text          │
│ +meddicc_ │  │   ┌───────────────────┐      │  +confidence             │
│  last_a   │  ├──>│  FollowUp（既有）│      └──────────────────────────┘
│           │  │   └───────────────────┘                ↑
└───────────┘  │                                        │
       │       │   ┌───────────────────┐                │
       │       └──>│  KeyEvent（既有）│                │
       │           └───────────────────┘                │
       │                                                │
       └────────────── 派生关系（service 层重算）─────┘
                       Lead.meddicc_score = derive(evidence)
                       Lead.meddicc_completion = derive(evidence)
                       Lead.meddicc_last_analyzed_at = now() on analyze
```

---

## 六、Schema Migration 策略

**沿用现有约定**（spec 001 / 002 一致）：

- **不用 Alembic** —— SQLModel `metadata.create_all()` 启动时自动建表 + 加列
- **新增字段加 `default=...`** 让既有 lead 行向后兼容（不破坏数据）
- **新增表自动创建**（启动时 `create_all()` 检查 `IF NOT EXISTS`）

**实施步骤**：

1. 在 `models/__init__.py` 导出 `Conversation` 与 `LeadMeddiccEvidence`，确保 `metadata.create_all()` 能扫描到
2. `models/lead.py` 加 3 列（带 default）
3. 启动 `uvicorn` 后 SQLite WAL 模式自动建表 + 加列
4. **既有 lead 行的 3 个新字段**：score=NULL / completion=0 / last_analyzed_at=NULL，UI 显示"未分析"

**SQLite 加列限制**：SQLModel 通过 ALTER TABLE 加列只支持 nullable 字段或带 default 的字段——本 spec 全部满足。

---

## 七、种子数据（init_db 集成）

`seed_demo_business_data()` 末尾追加：

```python
# 1. 给 2-3 条 demo lead 插入种子对话
SEED_CONVERSATIONS = {
  "深圳前海微链": [
    {"recorded_at_offset_days": -10, "content": "..."},
    {"recorded_at_offset_days": -7, "content": "..."},
    {"recorded_at_offset_days": -3, "content": "..."},
    {"recorded_at_offset_days": -1, "content": "..."},
    {"recorded_at_offset_days": 0,  "content": "..."},
  ],
  "北京数字颗粒科技": [
    {"recorded_at_offset_days": -5, "content": "..."},
    {"recorded_at_offset_days": -2, "content": "..."},
    {"recorded_at_offset_days": 0,  "content": "..."},
  ],
  "天津智联云": [
    {"recorded_at_offset_days": -8, "content": "..."},
    {"recorded_at_offset_days": -4, "content": "..."},
    {"recorded_at_offset_days": -1, "content": "..."},
    {"recorded_at_offset_days": 0,  "content": "..."},
  ],
}

for company, convs in SEED_CONVERSATIONS.items():
    lead = db.exec(select(Lead).where(Lead.company_name == company)).first()
    if not lead:
        continue
    for c in convs:
        recorded_at = (datetime.now() + timedelta(days=c["recorded_at_offset_days"])).isoformat()
        db.add(Conversation(
            lead_id=lead.id,
            recorded_at=recorded_at,
            content=c["content"],
            source="mock_seed",
            created_by=lead.owner_id,
        ))
db.commit()

# 2. 对每个 demo lead 调一次 analyze（同步）
from app.services.meddicc_extractor import analyze
for company in SEED_CONVERSATIONS.keys():
    lead = db.exec(select(Lead).where(Lead.company_name == company)).first()
    if lead:
        analyze(lead.id, db, current_user_id=lead.owner_id)
```

**幂等性**：`init_db` 已经判断"种子是否已植入"，重复跑不会重插（沿用 spec 002 init_db 既有逻辑）。

---

## 八、半小时重置集成（spec 002 衔接）

`reset_business_data()` 的清空表列表追加：

```python
TABLES_TO_TRUNCATE = [
    # ...（spec 002 既有 8 张表）
    "conversation",                # 🆕 spec 003 加
    "lead_meddicc_evidence",       # 🆕 spec 003 加
]
```

**重置后立即重跑** `seed_demo_business_data()`（spec 002 既有行为）→ 种子对话 + analyze 自动恢复 → 演示状态归零的同时仍亮灯。

---

## 九、TypeScript 类型镜像（前端）

**File**: `src/frontend/src/lib/meddicc-types.ts`

```typescript
export type Dimension =
  | 'metrics'
  | 'economic_buyer'
  | 'decision_criteria'
  | 'decision_process'
  | 'pain'
  | 'champion'
  | 'competition';

export interface Evidence {
  id: string;
  lead_id: string;
  dimension: Dimension;
  source_type: 'conversation' | 'followup' | 'key_event';
  source_id: string;
  evidence_text: string;
  confidence: number;
  created_at: string;
}

export interface DimensionStatus {
  dimension: Dimension;
  evidences: Evidence[];  // 该维度的所有 evidence
  count: number;          // = evidences.length
  is_lit: boolean;        // = count > 0
}

export interface DashboardData {
  lead_id: string;
  meddicc_score: number;          // 0-100
  meddicc_completion: number;     // 0-7
  last_analyzed_at: string | null;
  dimensions: DimensionStatus[];  // 长度 7（即使为空也包含 lit=false 的占位）
}

export interface ConversationItem {
  id: string;
  lead_id: string;
  recorded_at: string;
  content: string;
  source: 'manual' | 'scenario_card' | 'mock_seed';
  scenario_card_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ScenarioCardItem {
  id: string;
  title: string;
  description: string;
  applies_to_lead_company: string;
  applied: boolean;  // 后端动态计算
}
```

---

## 十、data-model.md 完成状态

✅ 2 张新表定义完整（字段 + 索引 + 业务规则）
✅ Lead 扩展 3 字段方案明确
✅ 派生关系语义清晰（Score 算法在 research.md Decision 3）
✅ Schema migration 策略沿用现有约定
✅ 种子数据 + 重置集成 plan
✅ TypeScript 类型镜像 ready

**下一步**：进入 `contracts/api-contracts.md` 写 8 个 API 端点契约 + chat tool 契约。
