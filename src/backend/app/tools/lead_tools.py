"""
Tool definitions for lead-related Ontology Actions (T099).
These map directly to existing service layer functions callable via tool use.
"""

LEAD_TOOLS = [
    {
        "name": "list_leads",
        "description": "列出线索列表，支持按状态、关键词筛选",
        "input_schema": {
            "type": "object",
            "properties": {
                "stage": {
                    "type": "string",
                    "description": "线索阶段: new | contacted | negotiating | converted | lost",
                },
                "pool": {
                    "type": "string",
                    "description": "线索池: private | public",
                },
                "keyword": {
                    "type": "string",
                    "description": "按公司名或联系人姓名关键词搜索",
                },
                "limit": {
                    "type": "integer",
                    "description": "返回条数，默认20",
                },
            },
        },
    },
    {
        "name": "get_lead",
        "description": "获取单条线索详情",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索 ID"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "assign_lead",
        "description": "将线索分配给指定销售人员（主管操作）",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索 ID"},
                "assignee_id": {"type": "string", "description": "被分配销售的用户 ID"},
            },
            "required": ["lead_id", "assignee_id"],
        },
    },
    {
        "name": "release_lead",
        "description": "将线索释放回公共池",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索 ID"},
                "reason": {"type": "string", "description": "释放原因"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "mark_lead_lost",
        "description": "将线索标记为丢失",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索 ID"},
                "reason": {"type": "string", "description": "丢失原因"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "convert_lead",
        "description": "将线索转化为客户",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索 ID"},
            },
            "required": ["lead_id"],
        },
    },
]
