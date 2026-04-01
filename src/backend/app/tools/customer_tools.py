"""
Tool definitions for customer-related Ontology Actions (T099).
"""

CUSTOMER_TOOLS = [
    {
        "name": "list_customers",
        "description": "列出客户列表，支持关键词搜索",
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {
                    "type": "string",
                    "description": "按公司名关键词搜索",
                },
                "limit": {
                    "type": "integer",
                    "description": "返回条数，默认20",
                },
            },
        },
    },
    {
        "name": "get_customer",
        "description": "获取单个客户详情，含转化窗口状态",
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_id": {"type": "string", "description": "客户 ID"},
            },
            "required": ["customer_id"],
        },
    },
    {
        "name": "reassign_customer",
        "description": "将客户转移给另一个销售人员",
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_id": {"type": "string", "description": "客户 ID"},
                "new_owner_id": {"type": "string", "description": "新负责销售的用户 ID"},
            },
            "required": ["customer_id", "new_owner_id"],
        },
    },
]
