"""Scenario cards — 演示场景卡数据 + apply 函数（spec 003 T016 / T017）.

5-7 张卡的对话剧本 hardcode 在 SCENARIO_CARDS dict 中，
applying 时按 lead 公司名匹配并 INSERT 多条 conversation + 触发 analyze。

不建第 3 张表 —— 卡的"是否已应用"动态查 conversation.scenario_card_id 计算。
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, func, select

from app.models.conversation import Conversation
from app.models.lead import Lead


# ── 场景卡定义（演示剧本，stakeholder 审核过） ──────────────────────────────

SCENARIO_CARDS: dict = {
    "scenario_001_kp_first_visit": {
        "id": "scenario_001_kp_first_visit",
        "title": "拜访赵总（首次深聊）",
        "description": "演示 Economic Buyer / Pain / Decision Process 三个维度的证据抽取",
        "applies_to_lead_company": "深圳前海微链科技有限公司",
        "conversations": [
            {
                "recorded_at_offset_days": -3,
                "content": (
                    "销售：赵总您好，我是培训公司的小王，今天专程过来拜访您。\n"
                    "客户：嗯，进来坐。听小李说你们做企业家培训挺有名的。\n"
                    "销售：我们专做老板成长课程，去年帮了 200 多家中小企业。您现在的业务情况怎么样？\n"
                    "客户：唉，今年特别难。我们本来年营收 8000 万的，今年 Q1 Q2 看下来到年底也就 5000 万。"
                    "团队这半年走了 3 个核心，剩下的人也不太给力。\n"
                    "销售：我能感觉您的压力。这种事您一般是您自己拍板还是要跟团队商量？\n"
                    "客户：这种花钱的事，我跟我老婆商量一下就定了。公司财务也是她管。\n"
                    "销售：明白。其实我们大课正好是针对您这种瓶颈期的老板设计的。\n"
                    "客户：你先把资料发我，我跟我太太商量了再说。"
                )
            }
        ],
    },
    "scenario_002_champion_emerges": {
        "id": "scenario_002_champion_emerges",
        "title": "Champion 涌现（赵太太）",
        "description": "演示 Champion / Decision Process 维度抽取",
        "applies_to_lead_company": "深圳前海微链科技有限公司",
        "conversations": [
            {
                "recorded_at_offset_days": -1,
                "content": (
                    "销售：赵总，上次给您发的资料您看了吗？\n"
                    "客户：嗯，我太太看了，她说挺好的。她还说她以前听过你们王老师的视频，"
                    "觉得讲得有干货。她让我尽快定下来。\n"
                    "销售：太好了！太太支持的话事情就好办了。她平常会一起来上课吗？\n"
                    "客户：会，她比我还积极。我们这种事都是她推动的。她说不上这种课我自己永远走不出来。\n"
                    "销售：理解。那您看下周排个时间签合同？\n"
                    "客户：好，下周三我和太太都有空。"
                )
            }
        ],
    },
    "scenario_003_competition_revealed": {
        "id": "scenario_003_competition_revealed",
        "title": "竞品被揭（樊登 + 行动派）",
        "description": "演示 Competition / Decision Criteria 维度抽取",
        "applies_to_lead_company": "深圳前海微链科技有限公司",
        "conversations": [
            {
                "recorded_at_offset_days": -2,
                "content": (
                    "销售：赵总，您之前提到正在比较几家培训机构，方便分享一下吗？\n"
                    "客户：是的，我看了樊登读书会的老板成长营，还有行动派那边的课程。"
                    "我比较看重讲师的实战背景，樊登那个讲师好像是高校教授，理论多。\n"
                    "销售：您们更看重实操是吧？\n"
                    "客户：对。我自己已经看了两年视频书籍了，理论懂得不少，关键是落不下来。"
                    "我太太也说不能再这么自己摸索下去了，得找个高人带带。\n"
                    "销售：我们王老师本身就带过 3 家上市公司，案例都是实战的。\n"
                    "客户：行，你把王老师的过往案例集发给我，我和我太太再对比一下。"
                )
            }
        ],
    },
    "scenario_004_metrics_quantified": {
        "id": "scenario_004_metrics_quantified",
        "title": "痛点量化（具体数字）",
        "description": "演示 Metrics / Pain 维度抽取",
        "applies_to_lead_company": "北京数字颗粒科技有限公司",
        "conversations": [
            {
                "recorded_at_offset_days": -5,
                "content": (
                    "销售：张总您好，能跟我聊一下您现在面临的具体问题吗？\n"
                    "客户：我们做技术服务的，去年月营收 200 万，今年只有 130 万了，掉了快三分之一。\n"
                    "销售：客户这边变化大吗？\n"
                    "客户：客户没怎么变，主要是新单子进不来。我们销售团队 12 个人，今年一季度只签了 4 个新客户。\n"
                    "销售：希望通过培训改善到什么程度？\n"
                    "客户：如果能把月营收提回到 250 万左右，我就满意了。还有团队流失率，我们去年走了 30%，"
                    "今年再这样我自己都快撑不住了。\n"
                    "销售：理解。我们大课正好有专门讲销售团队建设和客户拓展的模块。\n"
                    "客户：好，先发资料给我。"
                )
            }
        ],
    },
    "scenario_005_partner_decision": {
        "id": "scenario_005_partner_decision",
        "title": "合伙人介入决策",
        "description": "演示 Decision Process / Champion / Economic Buyer 维度抽取",
        "applies_to_lead_company": "北京数字颗粒科技有限公司",
        "conversations": [
            {
                "recorded_at_offset_days": -2,
                "content": (
                    "销售：张总，上次聊的内容您和团队讨论了吗？\n"
                    "客户：嗯，我跟我合伙人小李说了一下。他比较看重 ROI，问我这课程上完真的能见效吗。\n"
                    "销售：您合伙人也参与决策？\n"
                    "客户：对，我们公司大事都是我和他一起拍板。20 万的课程不算小钱。"
                    "他比我还务实，没看到具体数据他不愿意点头。\n"
                    "销售：理解。我可以拉一份过往学员的业绩对比报告。\n"
                    "客户：那太好了。小李特别看重这种数据。如果他点头我们这周就能定下来。"
                )
            }
        ],
    },
    "scenario_006_book_referral_drive": {
        "id": "scenario_006_book_referral_drive",
        "title": "推荐人来源（老李引荐）",
        "description": "演示 Decision Criteria / Champion 维度抽取",
        "applies_to_lead_company": "北京数字颗粒科技有限公司",
        "conversations": [
            {
                "recorded_at_offset_days": -7,
                "content": (
                    "销售：张总，您是怎么知道我们公司的？\n"
                    "客户：老李推荐的。他是我们的老朋友了，他去年上了你们的大课，回来就跟我说挺有用的。\n"
                    "销售：老李现在对您来说算什么角色？\n"
                    "客户：他算是我的导师吧，我一直信他的判断。他说好的事我基本都会试试。\n"
                    "销售：太好了，老李学完之后业绩涨了多少您知道吗？\n"
                    "客户：他说大概 40% 多。所以我才动了上课的念头。"
                )
            }
        ],
    },
    "scenario_007_self_help_competition": {
        "id": "scenario_007_self_help_competition",
        "title": "自学派的隐性对手",
        "description": "演示 Competition（自己摸索型隐性对手）",
        "applies_to_lead_company": "天津智联云数据服务公司",
        "conversations": [
            {
                "recorded_at_offset_days": -4,
                "content": (
                    "销售：王总您好，我们大课现在还在早鸟优惠期，您考虑得怎么样？\n"
                    "客户：我跟你说实话，我现在还是觉得自己再扛扛。我每天看公众号文章看视频书籍，"
                    "自己也总结了不少东西。\n"
                    "销售：但您现在还没走出业绩瓶颈对吧？\n"
                    "客户：是没走出来，但我觉得多看几本书就能想明白。20 万对我现在压力还是有点大。\n"
                    "销售：我理解，自学的成本看起来低，但时间成本您算过吗？\n"
                    "客户：嗯，这个我没仔细算过。要不你把以前学员的自学 vs 上课时间对比发我看看？"
                )
            }
        ],
    },
}


# ── 服务函数 ──────────────────────────────────────────────────────────────


def list_cards_for_lead(lead: Lead, db: Session) -> list[dict]:
    """返回该 lead 适用的场景卡列表 + 已应用状态。"""
    result = []
    for cid, card in SCENARIO_CARDS.items():
        if card["applies_to_lead_company"] != lead.company_name:
            continue
        applied_count = db.exec(
            select(func.count())
            .select_from(Conversation)
            .where(
                Conversation.lead_id == lead.id,
                Conversation.scenario_card_id == cid,
            )
        ).one()
        result.append({
            "id": cid,
            "title": card["title"],
            "description": card["description"],
            "applies_to_lead_company": card["applies_to_lead_company"],
            "applied": applied_count > 0,
            "conversation_count": len(card["conversations"]),
        })
    return result


def apply_card(card_id: str, lead: Lead, user_id: str, db: Session) -> list[str]:
    """应用场景卡 = 批量插对话。返回新插入 conversation 的 id 列表。

    前置校验在 router 层：
    - card_id 存在
    - applies_to_lead_company == lead.company_name
    - 未应用过
    """
    card = SCENARIO_CARDS[card_id]
    inserted_ids = []
    now = datetime.now(timezone.utc)

    for c in card["conversations"]:
        offset = c["recorded_at_offset_days"]
        recorded_at = (now + timedelta(days=offset)).isoformat()
        conv = Conversation(
            lead_id=lead.id,
            recorded_at=recorded_at,
            content=c["content"],
            source="scenario_card",
            scenario_card_id=card_id,
            created_by=user_id,
        )
        db.add(conv)
        db.flush()
        inserted_ids.append(conv.id)

    return inserted_ids


def get_card(card_id: str) -> Optional[dict]:
    return SCENARIO_CARDS.get(card_id)
