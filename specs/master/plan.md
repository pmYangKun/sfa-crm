# Implementation Plan: SFA CRM

**Branch**: `master` | **Date**: 2026-03-31 | **Spec**: `specs/master/spec.md`

## Summary

Build an AI-Native SFA CRM for a 200-person sales team at an executive training company. The system manages lead lifecycle (public/private pool, auto-release, conversion), customer tracking, and sales activities. Key differentiators: Ontology-based data model with explicit Actions, GUI API-first design (human and AI Agent share same endpoints), and embedded AI Copilot with switchable LLM.

Tech approach: Next.js frontend + FastAPI backend + SQLite, deployed via Docker Compose on Tencent Cloud. AI Agent via Vercel AI SDK with Tool Use mapped directly from Ontology Actions.

---

## Technical Context

**Language/Version**: Python 3.11 (backend) / TypeScript / Node.js 20 (frontend)
**Primary Dependencies**: FastAPI, SQLModel (ORM), Next.js 14, Vercel AI SDK, Anthropic SDK
**Storage**: SQLite (demo/teaching scope; schema designed for easy migration to PostgreSQL)
**Testing**: pytest (backend) / Vitest (frontend)
**Target Platform**: Linux server (Docker), web browser
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Demo/teaching project — correctness over throughput; target <500ms p95 for API responses
**Constraints**: Single-server deployment (Docker Compose); SQLite concurrent write limitations acceptable at demo scale
**Scale/Scope**: Demo — ~10 users, hundreds of leads; architecture patterns chosen for production scalability

---

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| 1. Ontology-first data model | ✅ PASS | All objects, relations, actions explicitly defined in spec |
| 2. API-first, unified operation layer | ✅ PASS | All Actions exposed as FastAPI endpoints; same endpoints for GUI and Agent |
| 3. Business rules configurable, not hardcoded | ✅ PASS | SystemConfig table covers pool limits, thresholds, region rules, LLM config |
| 4. Data integrity non-negotiable | ✅ PASS | Uniqueness check, rate limiting, concurrent claim protection all in spec |
| 5. Minimize sales input burden | ✅ PASS | Daily report auto-generated; followup drives report |
| 6. Explicit over implicit | ✅ PASS | All state transitions via Actions; DataScope and permissions explicit |

**Gate result: PASS — proceed to Phase 0.**

---

## Project Structure

### Documentation

```text
specs/master/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output (API contracts)
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```text
backend/
├── app/
│   ├── main.py              # FastAPI app entry
│   ├── models/              # SQLModel ORM models
│   │   ├── lead.py
│   │   ├── customer.py
│   │   ├── contact.py
│   │   ├── followup.py
│   │   ├── key_event.py
│   │   ├── org.py           # OrgNode, User
│   │   ├── auth.py          # Role, Permission, UserRole, RolePermission, UserDataScope
│   │   ├── report.py        # DailyReport
│   │   ├── config.py        # SystemConfig
│   │   ├── skill.py         # Skill
│   │   └── llm_config.py    # LLMConfig, ConversationMessage
│   ├── api/
│   │   ├── leads.py         # Lead CRUD + Actions
│   │   ├── customers.py     # Customer CRUD + Actions
│   │   ├── contacts.py
│   │   ├── followups.py
│   │   ├── key_events.py
│   │   ├── reports.py
│   │   ├── org.py
│   │   ├── users.py
│   │   ├── roles.py
│   │   ├── config.py
│   │   ├── skills.py
│   │   └── agent.py         # Chat + Tool Use endpoints
│   ├── services/
│   │   ├── lead_service.py       # Business logic for lead actions
│   │   ├── customer_service.py
│   │   ├── permission_service.py # Auth + DataScope enforcement
│   │   ├── release_service.py    # Auto-release scheduler
│   │   ├── report_service.py     # Daily report generation
│   │   ├── uniqueness_service.py # Lead dedup logic
│   │   ├── rate_limiter.py       # Claim rate limiting
│   │   └── agent_service.py      # LLM orchestration, tool dispatch
│   ├── tools/               # Tool Use definitions (maps to Ontology Actions)
│   │   ├── lead_tools.py
│   │   ├── customer_tools.py
│   │   ├── followup_tools.py
│   │   └── skill_tools.py
│   └── core/
│       ├── database.py      # SQLite connection, session
│       ├── auth.py          # JWT, session middleware
│       └── config.py        # App settings loader
├── tests/
│   ├── unit/
│   └── integration/
├── pyproject.toml
└── Dockerfile

frontend/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── leads/           # Lead list, detail pages
│   │   ├── customers/
│   │   ├── public-pool/
│   │   ├── reports/
│   │   ├── admin/           # Org, users, permissions, config
│   │   └── layout.tsx       # Chat sidebar always visible
│   ├── components/
│   │   ├── leads/
│   │   ├── customers/
│   │   ├── chat/            # AI Agent chat sidebar
│   │   └── ui/              # Shared UI components
│   ├── lib/
│   │   ├── api.ts           # API client (typed)
│   │   └── ai.ts            # Vercel AI SDK setup
│   └── types/               # Shared TypeScript types
├── tests/
├── package.json
└── Dockerfile

docker-compose.yml
```

**Structure Decision**: Option 2 (Web application). Separate `backend/` and `frontend/` directories. Backend is FastAPI with clear separation of models / API routes / services / tool definitions. Frontend is Next.js App Router with chat sidebar in root layout (always mounted).

---

## Complexity Tracking

No constitution violations. No complexity justification required.

---

## Phase 0: Research

*See `research.md` for full findings.*

Key decisions already made (no NEEDS CLARIFICATION):
- Tech stack fully decided
- LLM provider: Claude (Anthropic) via Vercel AI SDK
- Database: SQLite with SQLModel ORM
- Auth: JWT (stateless, simple for demo scope)
- Deployment: Docker Compose

Research tasks for Phase 0:
1. SQLModel best practices for recursive self-referential models (OrgNode tree)
2. FastAPI + SQLite concurrent write handling (WAL mode)
3. Vercel AI SDK tool use pattern with FastAPI backend
4. Rate limiting implementation in FastAPI (in-memory for demo)
5. Fuzzy company name matching library options (Python)
