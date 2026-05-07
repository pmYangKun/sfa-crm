"""Agent service — LLM orchestration and tool dispatch."""

import json
from urllib.parse import quote

import httpx
from sqlmodel import Session, select

from app.models.llm_config import ConversationMessage, LLMConfig, Skill


def get_active_llm_config(session: Session) -> LLMConfig | None:
    return session.exec(
        select(LLMConfig).where(LLMConfig.is_active == True)  # noqa: E712
    ).first()


def get_active_skills(session: Session) -> list[Skill]:
    return list(session.exec(
        select(Skill).where(Skill.is_active == True)  # noqa: E712
    ).all())


def get_conversation_history(session: Session, session_id: str, limit: int = 20) -> list[dict]:
    messages = session.exec(
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.created_at.desc())  # type: ignore
        .limit(limit)
    ).all()
    messages.reverse()
    return [{"role": m.role, "content": m.content} for m in messages]


def save_message(session: Session, session_id: str, user_id: str, role: str, content: str):
    msg = ConversationMessage(
        session_id=session_id,
        user_id=user_id,
        role=role,
        content=content,
    )
    session.add(msg)


# ── Tool definitions ─────────────────────────────────────────────────────────
# "mode": "read" → 直接执行返回数据
# "mode": "navigate" → 返回导航指令，引导用户到 GUI 操作

TOOL_DEFINITIONS = [
    # ── 读操作 ──
    {
        "name": "search_leads",
        "mode": "read",
        "description": "搜索线索，可按公司名、大区筛选",
        "parameters": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "公司名关键词"},
                "region": {"type": "string", "description": "大区"},
            },
        },
    },
    {
        "name": "get_lead_detail",
        "mode": "read",
        "description": "查看指定线索的详细信息（含联系人）",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "get_followup_history",
        "mode": "read",
        "description": "查看指定线索的跟进记录历史",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "get_lead_meddicc",
        "mode": "read",
        "description": "读指定线索已持久化的 MEDDICC 仪表盘评估（score + 7 维度状态 + 每维度证据条目）。回答 MEDDICC / 销售进展 / 评分类问题时必须用这个工具，**不要**自己根据跟进记录现推 —— 仪表盘是后端 LLM 已经抽过的权威结果，自己重推会跟仪表盘对不上。",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "list_customers",
        "mode": "read",
        "description": "查看客户列表",
        "parameters": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "公司名关键词"},
            },
        },
    },
    # ── 写操作（返回导航） ──
    {
        "name": "navigate_create_lead",
        "mode": "navigate",
        "description": "引导用户去创建新线索",
        "parameters": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string", "description": "公司名称（预填）"},
                "region": {"type": "string", "description": "大区（预填）"},
                "source": {"type": "string", "description": "来源（预填）"},
            },
        },
    },
    {
        "name": "navigate_log_followup",
        "mode": "navigate",
        "description": "引导用户去录入跟进记录，可预填跟进类型和内容",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
                "followup_type": {"type": "string", "description": "跟进类型：phone/wechat/visit/other"},
                "content": {"type": "string", "description": "跟进内容摘要（从用户对话中提取）"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "navigate_create_key_event",
        "mode": "navigate",
        "description": "引导用户去记录关键事件（拜访KP、赠书、小课、大课等）",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
                "event_type": {"type": "string", "description": "事件类型：visited_kp/book_sent/attended_small_course/purchased_big_course/contact_relation_discovered"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "navigate_convert_lead",
        "mode": "navigate",
        "description": "引导用户去将线索转化为客户",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "navigate_release_lead",
        "mode": "navigate",
        "description": "引导用户去释放线索回公共池",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "navigate_mark_lost",
        "mode": "navigate",
        "description": "引导用户去标记线索为流失",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
            },
            "required": ["lead_id"],
        },
    },
    # ── spec 004：经理视角团队级 4 个新 tool ──
    {
        "name": "scan_team_warnings",
        "mode": "read",
        "description": "扫描当前 user 数据范围内（DataScope）所有 active lead，返回触发了 warning 的 lead 列表 + 每条命中的 warning code 列表。回答\"团队哪几单存在风险\"\"我有哪些 lead 出问题\"等问题时调用。",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "team_meddicc_summary",
        "mode": "read",
        "description": "返回团队 MEDDICC 概览：avg score / 7 维亮灯密度 / Top 3 + Bottom 3 sales。回答\"团队 MEDDICC 完成度\"\"团队整体销售健康度\"类问题。",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "top_attention_deals",
        "mode": "read",
        "description": "返回当前最值得关注的 N 条 lead（按 warning 数 + score 反向 + amount 加权排序）。回答\"今天我该重点看哪几单\"\"哪些 lead 最危险\"等问题。",
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "返回多少条，默认 5"},
            },
        },
    },
    {
        "name": "forecast_category_distribution",
        "mode": "read",
        "description": "返回 6 个 forecast bucket 各自的 lead 数 + warnings 数 + 总金额。回答\"团队 pipeline 分布情况\"\"必赢有几单\"等问题。注意：默认仅播报 count + warnings_count，金额仅在用户明确问时才说。",
        "parameters": {"type": "object", "properties": {}},
    },
]


def execute_tool(
    session: Session,
    tool_name: str,
    args: dict,
    user_id: str,
) -> dict:
    """Execute a tool and return the result."""
    from app.models.contact import Contact
    from app.models.customer import Customer
    from app.models.followup import FollowUp
    from app.models.lead import Lead
    from app.models.org import User
    from app.services.permission_service import get_visible_user_ids

    try:
        # Get current user for DataScope filtering
        current_user = session.get(User, user_id)

        # ── Read tools ────────────────────────────────────────────────
        if tool_name == "search_leads":
            stmt = select(Lead).where(Lead.stage == "active")

            # DataScope filtering
            if current_user:
                visible_ids = get_visible_user_ids(session, current_user)
                if visible_ids is not None:
                    stmt = stmt.where(
                        Lead.owner_id.in_(visible_ids) | (Lead.pool == "public")  # type: ignore
                    )

            if args.get("search"):
                stmt = stmt.where(Lead.company_name.contains(args["search"]))  # type: ignore
            if args.get("region"):
                stmt = stmt.where(Lead.region == args["region"])
            leads = session.exec(stmt.limit(50)).all()
            results = []
            for l in leads:
                owner_name = None
                if l.owner_id:
                    owner = session.get(User, l.owner_id)
                    owner_name = owner.name if owner else None
                results.append({
                    "id": l.id,
                    "company_name": l.company_name,
                    "region": l.region,
                    "pool": l.pool,
                    "owner": owner_name or "公共池",
                    "source": l.source,
                    "last_followup_at": l.last_followup_at,
                    "detail_url": f"/leads/{l.id}",
                })
            return {"success": True, "count": len(results), "leads": results}

        elif tool_name == "get_lead_detail":
            lead = session.get(Lead, args["lead_id"])
            if not lead:
                return {"success": False, "message": "线索不存在"}
            owner_name = None
            if lead.owner_id:
                owner = session.get(User, lead.owner_id)
                owner_name = owner.name if owner else None
            contacts = session.exec(
                select(Contact).where(Contact.lead_id == lead.id)
            ).all()
            return {
                "success": True,
                "lead": {
                    "id": lead.id,
                    "company_name": lead.company_name,
                    "region": lead.region,
                    "stage": lead.stage,
                    "pool": lead.pool,
                    "owner": owner_name or "公共池",
                    "source": lead.source,
                    "created_at": lead.created_at,
                    "last_followup_at": lead.last_followup_at,
                    "detail_url": f"/leads/{lead.id}",
                },
                "contacts": [
                    {"name": c.name, "role": c.role, "phone": c.phone, "is_kp": c.is_key_decision_maker}
                    for c in contacts
                ],
            }

        elif tool_name == "get_followup_history":
            followups = session.exec(
                select(FollowUp)
                .where(FollowUp.lead_id == args["lead_id"])
                .order_by(FollowUp.followed_at.desc())  # type: ignore
                .limit(20)
            ).all()
            type_labels = {"phone": "电话", "wechat": "微信", "visit": "拜访", "other": "其他"}
            return {
                "success": True,
                "count": len(followups),
                "followups": [
                    {
                        "type": type_labels.get(f.type, f.type),
                        "content": f.content,
                        "followed_at": f.followed_at,
                    }
                    for f in followups
                ],
            }

        elif tool_name == "get_lead_meddicc":
            # 读已持久化的仪表盘数据（lead_meddicc_evidence 表 + lead.meddicc_score）
            from app.models.lead_meddicc_evidence import LeadMeddiccEvidence, DIMENSIONS
            lead = session.get(Lead, args["lead_id"])
            if not lead:
                return {"success": False, "message": "线索不存在"}
            evidences = session.exec(
                select(LeadMeddiccEvidence).where(LeadMeddiccEvidence.lead_id == lead.id)
            ).all()
            DIM_LABELS = {
                "metrics": "M Metrics（量化指标）",
                "economic_buyer": "E Economic Buyer（经济决策人）",
                "decision_criteria": "D Decision Criteria（决策标准）",
                "decision_process": "D Decision Process（决策流程）",
                "pain": "I Identify Pain（痛点识别）",
                "champion": "C Champion（内部支持者）",
                "competition": "C Competition（竞争态势）",
            }
            by_dim: dict = {dim: [] for dim in DIMENSIONS}
            for ev in evidences:
                by_dim[ev.dimension].append({
                    "evidence_text": ev.evidence_text,
                    "confidence": round(ev.confidence, 2) if ev.confidence else None,
                    "source_type": ev.source_type,
                })
            dimensions_view = []
            for dim in DIMENSIONS:
                items = by_dim[dim]
                dimensions_view.append({
                    "dimension": dim,
                    "label": DIM_LABELS[dim],
                    "is_lit": len(items) > 0,
                    "evidence_count": len(items),
                    "evidences": items,
                })
            return {
                "success": True,
                "lead_id": lead.id,
                "company_name": lead.company_name,
                "score": lead.meddicc_score,
                "completion": f"{lead.meddicc_completion or 0}/7",
                "last_analyzed_at": lead.meddicc_last_analyzed_at,
                "dimensions": dimensions_view,
                "detail_url": f"/leads/{lead.id}",
                "_hint": "回答时请直接引用上面 dimensions 里每个维度的 is_lit / evidence_count / evidences。不要自己根据跟进记录现推 MEDDICC，否则会跟仪表盘对不上。如果 last_analyzed_at 较旧，可建议用户去详情页点重新分析。",
            }

        elif tool_name == "list_customers":
            stmt = select(Customer)
            if current_user:
                visible_ids = get_visible_user_ids(session, current_user)
                if visible_ids is not None:
                    stmt = stmt.where(Customer.owner_id.in_(visible_ids))  # type: ignore
            if args.get("search"):
                stmt = stmt.where(Customer.company_name.contains(args["search"]))  # type: ignore
            customers = session.exec(stmt.limit(10)).all()
            results = []
            for c in customers:
                owner = session.get(User, c.owner_id)
                results.append({
                    "id": c.id,
                    "company_name": c.company_name,
                    "region": c.region,
                    "owner": owner.name if owner else "未知",
                    "source": c.source,
                })
            return {"success": True, "count": len(results), "customers": results}

        # ── Navigate tools (write operations → return navigation) ─────
        elif tool_name == "navigate_create_lead":
            params = []
            if args.get("company_name"):
                params.append(f"company_name={quote(args['company_name'])}")
            if args.get("region"):
                params.append(f"region={quote(args['region'])}")
            if args.get("source"):
                params.append(f"source={quote(args['source'])}")
            url = "/leads/new" + ("?" + "&".join(params) if params else "")
            return {
                "action": "navigate",
                "label": f"创建线索{': ' + args['company_name'] if args.get('company_name') else ''}",
                "url": url,
            }

        elif tool_name == "navigate_log_followup":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            params = []
            if args.get("followup_type"):
                params.append(f"fu_type={quote(args['followup_type'])}")
            if args.get("content"):
                params.append(f"fu_content={quote(args['content'])}")
            qs = ("?" + "&".join(params)) if params else ""
            return {
                "action": "navigate",
                "label": f"录入跟进{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}{qs}#followup",
            }

        elif tool_name == "navigate_create_key_event":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            params = []
            if args.get("event_type"):
                params.append(f"ke_type={quote(args['event_type'])}")
            qs = ("?" + "&".join(params)) if params else ""
            return {
                "action": "navigate",
                "label": f"记录关键事件{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}{qs}#keyevent",
            }

        elif tool_name == "navigate_convert_lead":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            return {
                "action": "navigate",
                "label": f"转化客户{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}#actions",
            }

        elif tool_name == "navigate_release_lead":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            return {
                "action": "navigate",
                "label": f"释放线索{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}#actions",
            }

        elif tool_name == "navigate_mark_lost":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            return {
                "action": "navigate",
                "label": f"标记流失{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}#actions",
            }

        # ── spec 004 团队级 chat tool ──────────────────────────────────────
        elif tool_name == "scan_team_warnings":
            from app.services import manager_pipeline_service as mps
            if current_user is None:
                return {"success": False, "message": "未登录"}
            result = mps.scan_team_warnings(current_user, session)
            result["success"] = True
            result["pipeline_url"] = "/manager-pipeline"
            return result

        elif tool_name == "team_meddicc_summary":
            from app.services import manager_pipeline_service as mps
            if current_user is None:
                return {"success": False, "message": "未登录"}
            result = mps.team_meddicc_summary(current_user, session)
            result["success"] = True
            result["pipeline_url"] = "/manager-pipeline"
            return result

        elif tool_name == "top_attention_deals":
            from app.services import manager_pipeline_service as mps
            if current_user is None:
                return {"success": False, "message": "未登录"}
            limit = int(args.get("limit") or 5)
            result = mps.top_attention_deals(current_user, session, limit=limit)
            result["success"] = True
            result["pipeline_url"] = "/manager-pipeline"
            return result

        elif tool_name == "forecast_category_distribution":
            from app.services import manager_pipeline_service as mps
            if current_user is None:
                return {"success": False, "message": "未登录"}
            result = mps.forecast_category_distribution(current_user, session)
            result["success"] = True
            result["pipeline_url"] = "/manager-pipeline"
            return result

        else:
            return {"success": False, "message": f"Unknown tool: {tool_name}"}

    except Exception as e:
        return {"success": False, "message": str(e)}
