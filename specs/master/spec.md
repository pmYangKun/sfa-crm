# SFA CRM — Feature Specification

**Branch**: `master` | **Source**: `spec/ontology.md` + `spec/specifications.md` + `spec/business-context.md`

---

## Project Overview

SFA CRM for an executive training company. Core products:
- **Small Course**: 3-day offline course, ¥20,000, primary lead conversion funnel
- **Big Course**: 6-month MBA program, ¥200,000, primary revenue

200-person sales team nationwide. Core goal: accurate lead resource management and intelligent allocation—get the right leads to the right salespeople, maximize overall conversion rate.

**Tech Stack** (decided):
- Frontend: Next.js
- Backend: FastAPI (Python)
- Database: SQLite (demo/teaching project)
- Deployment: Docker Compose + Tencent Cloud Lighthouse
- AI Agent: Vercel AI SDK (multi-LLM, switchable by Admin)
- LLM: Claude by default, configurable to GPT/DeepSeek/etc.

---

## Ontology: Core Objects

### Lead
Sales target not yet converted (not purchased small course).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| company_name | String | Required |
| unified_code | String? | Org code (recommended, not required) |
| region | Enum | Region assignment |
| stage | Enum | `active` / `converted` / `lost` |
| owner_id | FK → User? | Null when in public pool |
| pool | Enum | `private` / `public` |
| source | Enum | `referral` / `organic` / `koc_sem` / `outbound` |
| created_at | DateTime | |
| last_followup_at | DateTime? | Updated on each FollowUp |
| converted_at | DateTime? | Set when converted |
| lost_at | DateTime? | Set when marked lost |

**Uniqueness**: exact match on unified_code; fuzzy match on company name + contact wechat/phone triggers warning to manager.

**Private pool limit**: configurable (default 100), counts only `stage = active` leads.

**Auto-release conditions** (either triggers release to public pool):
- 10 days without followup
- 30 days without conversion

### Customer
Created when a lead purchases a small course. **No status field** — purchase history derived from external order system.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| lead_id | FK → Lead | Source lead (archived) |
| company_name | String | Inherited from lead |
| unified_code | String? | Inherited from lead |
| region | Enum | Inherited from lead |
| owner_id | FK → User | Inherited from lead, manually reassignable |
| source | Enum | Inherited from lead |
| created_at | DateTime | Conversion timestamp = window start |

**Derived logic** (not stored):
- Big course purchased → query order system
- In 14-day conversion window → `now - customer.created_at < 14d AND no big course order`

### Contact
Natural person attached to a lead or customer (many per entity).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| lead_id | FK → Lead? | One of these required |
| customer_id | FK → Customer? | One of these required |
| name | String | |
| role | String? | Job title |
| is_key_decision_maker | Boolean | |
| wechat_id | String? | |
| phone | String? | |
| created_at | DateTime | |

Migrated from lead to customer on conversion. Duplicate wechat_id/phone auto-creates ContactRelation and notifies manager.

### ContactRelation
Cross-company interpersonal network.

| Field | Type | Notes |
|-------|------|-------|
| contact_a_id | FK → Contact | |
| contact_b_id | FK → Contact | |
| relation_type | Enum | spouse / relative / partner / friend |
| note | String? | |
| created_by | FK → User | |

### FollowUp
Sales interaction record.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| lead_id | FK → Lead? | One of these required |
| customer_id | FK → Customer? | One of these required |
| contact_id | FK → Contact? | Optional |
| owner_id | FK → User | |
| type | Enum | phone / wechat / visit / other |
| source | Enum | `manual` / `ai` (reserved) |
| content | Text | |
| followed_at | DateTime | Actual occurrence time |
| created_at | DateTime | Entry time |

### KeyEvent
Structured business milestones (distinct from routine followups).

| Event Type | Applies To | Special Fields |
|------------|-----------|----------------|
| `visited_kp` | Lead / Customer | contact_id |
| `book_sent` | Lead | sent_at, responded_at?, confirmed_reading? |
| `attended_small_course` | Lead | course_date, payment_confirmed (triggers conversion) |
| `purchased_big_course` | Customer | contract_amount, purchase_date |
| `contact_relation_discovered` | Lead / Customer | relation_id |

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| lead_id | FK → Lead? | |
| customer_id | FK → Customer? | |
| type | Enum | |
| payload | JSON | Event-specific fields |
| created_by | FK → User | |
| occurred_at | DateTime | |

### OrgNode
Recursive tree for org hierarchy (unlimited depth).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | String | |
| type | Enum | `root` / `region` / `team` / `custom` |
| parent_id | FK → OrgNode? | Null for root |

### User

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | String | |
| org_node_id | FK → OrgNode | |

### Role
System roles. Built-in: 销售, 战队队长, 大区总, 销售VP, 督导, 系统管理员. Custom roles supported.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | String | |
| description | String? | |
| is_system | Boolean | System roles cannot be deleted |

### Permission
Granular permission points by module.

Key permissions: `lead.view`, `lead.create`, `lead.assign`, `lead.claim`, `lead.release`, `lead.mark_lost`, `customer.view`, `customer.reassign`, `followup.create`, `keyevent.create`, `report.submit`, `report.view_team`, `org.manage`, `user.manage`, `config.manage`, `log.view`

**Many-to-many tables**: `RolePermission` (Role ↔ Permission), `UserRole` (User ↔ Role, supports multiple roles per user)

### UserDataScope
Data visibility scope, independent of functional permissions.

| Field | Type | Notes |
|-------|------|-------|
| user_id | FK → User | |
| scope | Enum | See below |
| node_ids | FK[] → OrgNode | Only for `selected_nodes` |

**Scope enum**: `self_only` / `current_node` / `current_and_below` / `selected_nodes` / `all`

### SystemConfig
Key-value configuration table for all tunable parameters.

| Config Key | Default | Notes |
|------------|---------|-------|
| private_pool_limit | 100 | Max leads per sales private pool |
| followup_release_days | 10 | Days without followup before auto-release |
| conversion_release_days | 30 | Days without conversion before auto-release |
| claim_rate_limit | 10 | Max claims per minute per account |
| daily_report_generate_at | 18:00 | Daily report draft generation time |
| region_claim_rules | {} | Per-region claim rule configuration |

### Skill
Business best-practice knowledge for AI agent.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | String | |
| trigger | String | Scenario description |
| content | Text | Prompt text — what AI should do |
| category | String | Grouping |
| is_active | Boolean | |

### LLMConfig
LLM provider configuration, switchable by Admin.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| provider | Enum | `anthropic` / `openai` / `deepseek` / etc. |
| model | String | Model name |
| api_key | String | Encrypted |
| is_active | Boolean | Only one active at a time |

### ConversationMessage
AI Agent chat history.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| session_id | String | Groups messages per conversation |
| user_id | FK → User | |
| role | Enum | `user` / `assistant` / `tool` |
| content | Text | |
| created_at | DateTime | |

---

## Ontology: Actions

### Lead Actions

**assign_lead** — Manager assigns lead to sales
- Subject: `manager`, `admin`
- Precondition: `lead.pool == public` AND `sales.private_pool_count < pool_limit`
- Effect: `lead.owner = sales`, `lead.pool = private`

**release_lead** — Release lead back to public pool
- Subject: system (auto), `manager`
- Precondition: `lead.pool == private` AND (followup threshold exceeded OR conversion threshold exceeded)
- Effect: `lead.owner = null`, `lead.pool = public`

**claim_lead** — Sales claims from public pool
- Subject: `sales`
- Precondition: `lead.pool == public` AND region rule allows AND rate limit not exceeded
- Effect: `lead.owner = current_sales`, `lead.pool = private`

**mark_lead_lost** — Mark lead as lost
- Subject: `sales` (own leads), `manager`
- Precondition: `lead.stage == active`
- Effect: `lead.stage = lost`, `lead.lost_at = now`

**convert_lead** — Convert lead to customer
- Subject: system (order system event), `sales` (manual fallback)
- Precondition: `lead.stage == active`
- Effect: `lead.stage = converted`, create Customer, migrate contacts/followups/events

### Customer Actions

**reassign_customer** — Manually reassign customer ownership
- Subject: `manager`, `admin`
- Precondition: none (not subject to pool limits)
- Effect: `customer.owner = target_sales`, original sales loses visibility immediately

### Contact Actions

**add_contact** — Add contact to lead/customer
- Subject: `sales` (own leads/customers only)
- Effect: create Contact, detect wechat/phone duplicate, trigger warning if duplicate

**link_contacts** — Create relationship between contacts
- Subject: `sales`, `manager`
- Effect: create ContactRelation, trigger cross-company conflict detection

### FollowUp Actions

**log_followup** — Record followup interaction
- Subject: `sales` (own leads/customers only)
- Effect: create FollowUp, update `lead.last_followup_at`

### KeyEvent Actions

**record_book_sent** — Record book delivery
- Subject: `sales`
- Precondition: target is Lead
- Effect: create `book_sent` KeyEvent

**confirm_small_course** — Confirm small course purchase (triggers conversion)
- Subject: system (auto), `sales` (manual fallback)
- Effect: trigger `convert_lead` action

**record_big_course** — Record big course purchase
- Subject: system (auto), `sales` (manual fallback)
- Precondition: target is Customer
- Effect: create `purchased_big_course` KeyEvent

### Report Actions

**generate_daily_report** — Generate daily report draft
- Subject: system (scheduled daily)
- Effect: aggregate day's FollowUps into draft

**submit_daily_report** — Submit daily report
- Subject: `sales`
- Effect: submit to team_lead (required) + region_head (optional)

---

## Feature Specifications

### SPEC-001: Lead Entry & Uniqueness Check
- Exact match on unified_code → block entry, show current owner
- Fuzzy match on company name → warning to manager, manager decides
- Duplicate wechat/phone → auto ContactRelation + notify manager
- New leads enter public pool by default

### SPEC-002: Lead Assignment (Private Pool)
- Manager assigns public leads to sales
- Block if target sales private pool at limit
- Private pool count: only `stage = active` leads
- All assignments logged

### SPEC-003: Public Pool Claiming
- Sales can view public pool (own region only)
- Claim validates: pool status, private pool limit, region rules, rate limit
- Rate limit violation → account locked, notify manager, manual unlock by manager
- Concurrent claim → first wins, second gets "already claimed"
- Per-region rules configurable: team-only / cross-team / manual dispatch by assistant

### SPEC-004: Auto Release
- Daily job checks active private leads
- Release if: 10+ days no followup OR 30+ days since creation
- Notify original sales on release
- Thresholds configurable by admin

### SPEC-005: Lead Conversion
- Trigger: order system event (primary) or manual (fallback)
- Creates Customer, migrates all contacts/followups/events
- Lead archived, disappears from active list

### SPEC-006: Followup Logging
- Sales logs followup on own leads/customers
- Updates `lead.last_followup_at`
- Immutable (no delete), can append notes
- `followed_at` cannot be future

### SPEC-007: Key Event Recording
- book_sent: lead only, can update response/reading fields
- attended_small_course: triggers conversion
- purchased_big_course: customer only, records contract amount
- No duplicate event types per object (update instead)

### SPEC-008: 14-Day Conversion Window
- Derived: `now - customer.created_at < 14d AND no big course order`
- Reminders at day 7 and day 12
- Day 14: "window closed" notification, no field changes on customer
- Fixed at 14 days (not configurable in v1)

### SPEC-009: Contact Management
- Multiple contacts per lead/customer
- Duplicate wechat/phone → auto ContactRelation + notify managers
- Manual relationship creation: spouse/relative/partner/friend
- Contacts migrate with lead on conversion

### SPEC-010: Daily Report Auto-Generation
- Generate draft at 18:00 from day's followups
- Sales reviews, edits, submits to team lead (required) + region head (optional)
- No followups → no draft, reminder at 20:00
- Draft updates if followups added before submission
- Submitted reports immutable

### SPEC-011: Data Visibility & Permissions
- Functional permissions: Role + Permission (what you can do)
- Data permissions: UserDataScope (what data you can see), independent of role
- All API endpoints enforce both checks
- Visibility loss is immediate on lead/customer transfer

### SPEC-012: Org Structure Management
- CRUD on OrgNode tree
- Block deactivation if active leads/customers/users on node
- User reassignment updates data visibility immediately

### SPEC-013: User Management
- Create users, assign roles (multi-role supported)
- Deactivate: prompt to transfer leads/customers first
- At least one admin must remain active

### SPEC-014: Role & Permission Management
- Custom roles with configurable permission points
- Built-in roles not deletable, but permissions adjustable
- Changes effective immediately (next request for logged-in users)
- Multi-role: permissions are union of all roles

---

## AI Agent Specification

### Chat Sidebar
- Persistent chat UI embedded in CRM
- Streaming responses
- Conversation history stored per user session

### Tool Definitions (from Ontology Actions)
All Ontology Actions above are exposed as Tool Use definitions to the LLM:
- `assign_lead`, `claim_lead`, `release_lead`, `mark_lead_lost`, `convert_lead`
- `reassign_customer`
- `log_followup`, `add_contact`, `link_contacts`
- `record_book_sent`, `confirm_small_course`, `record_big_course`
- `submit_daily_report`
- `get_skill(scenario)` — retrieve relevant Skill by scenario

### Skill Retrieval
- Agent calls `get_skill` tool with scenario description
- System matches against Skill.trigger, returns Skill.content as context
- LLM uses skill content to inform response

### Human-in-the-loop
- Low-risk operations (queries, stats): Agent executes directly
- High-risk operations (assignment, conversion): Agent navigates user to pre-filled form, human confirms

### Event-triggered Agent (future)
- Backend events (new followup, small course payment, 14-day reminder) can trigger Agent
- Agent runs Skill, generates suggestion, pushes to frontend

### LLM Switchability
- Admin configures active LLM in system settings
- Vercel AI SDK handles provider switching transparently
- Skill content unaffected by LLM change

---

## Menu Structure

**Sales**: 我的线索 / 公共线索库 / 我的客户 / 我的日报

**Manager** (data scope auto-adjusted by OrgNode): 数据概览 / 团队线索 / 公共线索库 / 团队客户 / 团队日报

**Admin**: 全部线索 / 全部客户 / 组织管理 / 用户管理 / 权限管理 / 系统配置 (includes LLM config + Skill management) / 操作日志

---

## Key Decisions

| Decision | Resolution |
|----------|-----------|
| Lead vs Customer | Two separate objects; Lead has stage, Customer has no status |
| Customer status | None — purchase history derived from external order system |
| 14-day window | Derived logic, not stored, fixed at 14 days |
| Data vs functional permissions | Fully decoupled: Role+Permission vs UserDataScope |
| Public pool rules | Configurable per region, not hardcoded |
| List view | Preset defaults + user can show/hide columns, save filters; no custom fields |
| AI framework | Vercel AI SDK (no Dify/n8n); self-managed conversation history |
| Skill | Plain text stored in DB, not Claude-specific, LLM-agnostic |
