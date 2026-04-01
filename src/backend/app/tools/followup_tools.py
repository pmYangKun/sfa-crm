"""
Tool definitions for followup and key event Ontology Actions (T099).
"""

FOLLOWUP_TOOLS = [
    {
        "name": "log_followup",
        "description": "记录一次跟进活动（适用于线索或客户）",
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_type": {
                    "type": "string",
                    "description": "实体类型: lead | customer",
                },
                "entity_id": {
                    "type": "string",
                    "description": "线索或客户的 ID",
                },
                "type": {
                    "type": "string",
                    "description": "跟进方式: call | wechat | visit | email | other",
                },
                "content": {
                    "type": "string",
                    "description": "跟进内容摘要",
                },
            },
            "required": ["entity_type", "entity_id", "type", "content"],
        },
    },
    {
        "name": "list_followups",
        "description": "查看某个线索或客户的跟进历史",
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_type": {
                    "type": "string",
                    "description": "实体类型: lead | customer",
                },
                "entity_id": {
                    "type": "string",
                    "description": "线索或客户的 ID",
                },
            },
            "required": ["entity_type", "entity_id"],
        },
    },
    {
        "name": "record_key_event",
        "description": "记录关键销售事件（书单发送、小课确认、大课报名等）",
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_type": {
                    "type": "string",
                    "description": "实体类型: lead | customer",
                },
                "entity_id": {
                    "type": "string",
                    "description": "线索或客户的 ID",
                },
                "type": {
                    "type": "string",
                    "description": "事件类型: book_sent | small_course_confirmed | big_course_registered | payment_received | other",
                },
                "payload": {
                    "type": "object",
                    "description": "事件附加信息（可选）",
                },
            },
            "required": ["entity_type", "entity_id", "type"],
        },
    },
]
