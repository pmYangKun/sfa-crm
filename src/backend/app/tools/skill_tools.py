"""
Tool definitions for Skill execution Ontology Actions (T099).
Skills are user-defined callable scripts / prompts stored in DB.
"""

SKILL_TOOLS = [
    {
        "name": "list_skills",
        "description": "列出所有可用的 Skill（技能）",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_my_stats",
        "description": "查询当前用户今天、本周、本月的跟进数和转化数统计",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "description": "统计周期: today | week | month",
                },
            },
        },
    },
    {
        "name": "search_knowledge",
        "description": "搜索产品知识库或销售话术，返回相关内容",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词",
                },
            },
            "required": ["query"],
        },
    },
]
