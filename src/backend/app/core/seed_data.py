"""Seed realistic test data for demo.

Three salespeople with deliberately different activity levels:
- sales01 (王小明): HIGH — recent followups within 1-3 days
- sales02 (李思远): MEDIUM — last followup 4-7 days ago
- sales03 (张磊):   LOW — last followup 9+ days ago, leads about to auto-release

Spec 004 manager pipeline 演示要求：
- 团队 4 人各自有十几条 active lead，forecast_category 分布在 4 个 active 桶
- 70% lead 直接 seed MEDDICC score + evidence（不依赖 LLM）
- 7 种 warning 各有触发样本
- 每条有 score 的 lead 有 3-5 条 history snapshot（趋势图用）
"""

import json
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.core.database import engine
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.customer import Customer
from app.models.followup import FollowUp
from app.models.key_event import KeyEvent
from app.models.lead import Lead
from app.models.lead_meddicc_evidence import DIMENSIONS, LeadMeddiccEvidence
from app.models.lead_meddicc_history import LeadMeddiccHistory
from app.models.notification import Notification
from app.models.org import User
from app.models.report import DailyReport


# ── helpers ─────────────────────────────────────────────────────────────────


def _ts(days_ago: int = 0, hour: int = 10) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    dt = dt.replace(hour=hour, minute=0, second=0, microsecond=0)
    return dt.isoformat()


def _id() -> str:
    return str(uuid.uuid4())


def _close_date(days_in_future):
    if days_in_future is None:
        return None
    return (datetime.now(timezone.utc) + timedelta(days=days_in_future)).date().isoformat()


# ── MEDDICC evidence text templates per dimension ───────────────────────────
# 用真实销售调研口吻写，避免 demo 一眼假
EVIDENCE_TEXTS = {
    "metrics": [
        "客户提到去年营收 130 万，今年目标做到 200 万",
        "团队 KPI 是季度签单 80 万，上季只完成 45 万",
        "客户表示客单价从 5 万降到 3.2 万，急需破局",
        "对方算过 ROI，节省 1 个 HR 岗一年回本",
        "客户算过：流失率每降 5% 就多 60 万营收",
    ],
    "economic_buyer": [
        "决策人是 CTO 张伟，说话有分量，预算他签字",
        "采购走集团总裁办，需董事长黄总最终拍板",
        "客户老板亲自参会，明确表态今年必须落地",
        "副总裁陈静负责数字化预算，今年额度 300 万",
        "实际签字人是 CIO 周婷，业务 VP 给推荐",
    ],
    "decision_criteria": [
        "客户要求私有化部署 + 国产数据库适配",
        "明确写在 RFP 里：必须支持 SSO + 审计日志",
        "客户最看重三点：响应速度、可定制、售后",
        "对方画了 4 象限矩阵，功能完整度权重最高",
        "硬性要求：实施周期 ≤ 60 天，否则不考虑",
    ],
    "decision_process": [
        "走集团采购流程，预计 6-8 周，需过 3 道评审",
        "客户已搭好评审小组：业务 + IT + 财务",
        "客户说 Q2 末前必须落定，否则推到下半年",
        "走单一来源采购，省了招标环节，2 个月可签",
        "等董事会 4 月 15 日开完会才拍板",
    ],
    "pain": [
        "团队流失严重，去年走 3 人，今年又走 2 人",
        "现在用 Excel 管客户，丢单率高，老板焦虑",
        "客户抱怨现有系统卡顿，每天浪费团队 2 小时",
        "业绩连续 3 季度下滑，老板亲口说必须改",
        "合规部点名要求做客户数据审计，否则吃罚单",
    ],
    "champion": [
        "采购经理李娜主动推荐找老板拍板",
        "IT 总监王磊全程站我们，承诺帮我们打内部 PR",
        "技术主管刘洋私下说会力推我们方案",
        "数据部主管吴强加了我微信，常约饭聊进展",
        "运营总监赵鹏是老朋友介绍的，帮忙带话",
    ],
    "competition": [
        "正在跟用友、金蝶 PK，客户更倾向我们",
        "同时在看 Salesforce，但担心数据出境",
        "行业里跟北森 / 销售易在角逐，价格我们略高",
        "客户上一家方案是纷享销客，今年合同到期不续",
        "对手报价低 30%，但功能砍掉了 BI 模块",
    ],
}


def _evi(dim: str, idx: int) -> str:
    pool = EVIDENCE_TEXTS[dim]
    return pool[idx % len(pool)]


# ── score profile presets ───────────────────────────────────────────────────
# (score, completion, dimension_set) — 用于批量为 lead 打 score
def _score_profile(tier: str, seed_idx: int):
    """Return (score, completion, dims_lit, confidence_per_dim).

    tier:
      'high'  : 80-95, 6-7 维
      'mid'   : 50-75, 4-5 维
      'low'   : 25-45, 2-3 维
      'shallow_pain': pain 维 confidence 故意低（触发 shallow_pain warning）
      None    : 不打 score
    """
    rng = random.Random(seed_idx)
    if tier == "high":
        score = round(rng.uniform(80.0, 95.0), 1)
        # 6 或 7 维
        n = rng.choice([6, 7])
        dims = rng.sample(DIMENSIONS, n)
        conf = {d: round(rng.uniform(0.75, 0.95), 2) for d in dims}
        return score, n, dims, conf
    if tier == "mid":
        score = round(rng.uniform(50.0, 75.0), 1)
        n = rng.choice([4, 5])
        dims = rng.sample(DIMENSIONS, n)
        conf = {d: round(rng.uniform(0.6, 0.85), 2) for d in dims}
        return score, n, dims, conf
    if tier == "low":
        score = round(rng.uniform(25.0, 45.0), 1)
        n = rng.choice([2, 3])
        dims = rng.sample(DIMENSIONS, n)
        conf = {d: round(rng.uniform(0.5, 0.75), 2) for d in dims}
        return score, n, dims, conf
    if tier == "shallow_pain":
        # 中分但 pain confidence 故意低
        score = round(rng.uniform(50.0, 65.0), 1)
        dims = ["metrics", "pain", "champion", "decision_criteria"]
        conf = {d: 0.7 for d in dims}
        conf["pain"] = 0.35  # 触发 shallow_pain
        return score, 4, dims, conf
    return None


def _seed_meddicc_for_lead(
    s: Session,
    lead: Lead,
    profile: tuple,
    *,
    followup_ids_for_lead: list[str],
    conversation_ids_for_lead: list[str],
    analyzed_days_ago: int = 2,
    seed_idx: int = 0,
):
    """Write meddicc_score / completion / evidence / history for a lead."""
    if profile is None:
        return  # 不打 score，留 None

    score, completion, dims, conf = profile

    lead.meddicc_score = score
    lead.meddicc_completion = completion
    lead.meddicc_last_analyzed_at = _ts(analyzed_days_ago)

    # ── evidence rows (每维至少 1 条) ────────────────────────────
    for d_idx, dim in enumerate(dims):
        # source_type 优先 conversation，没有则 followup
        if conversation_ids_for_lead:
            src_type = "conversation"
            src_id = conversation_ids_for_lead[d_idx % len(conversation_ids_for_lead)]
        elif followup_ids_for_lead:
            src_type = "followup"
            src_id = followup_ids_for_lead[d_idx % len(followup_ids_for_lead)]
        else:
            # 兜底（理论不该发生）
            src_type = "followup"
            src_id = "unknown"
        s.add(LeadMeddiccEvidence(
            id=_id(),
            lead_id=lead.id,
            dimension=dim,
            source_type=src_type,
            source_id=src_id,
            evidence_text=_evi(dim, seed_idx + d_idx),
            confidence=conf[dim],
        ))

    # ── history snapshots: 3-5 条递增曲线 ────────────────────────
    rng = random.Random(seed_idx + 999)
    n_hist = rng.choice([3, 4, 5])
    # 时间锚点：从 60 天前开始递增到 analyzed_days_ago
    span_start = 55
    span_end = analyzed_days_ago
    if span_start <= span_end:
        span_start = span_end + 30
    step_days = (span_start - span_end) // n_hist
    for i in range(n_hist):
        days_back = span_start - i * step_days
        # 分阶段递增：从 ~40% 起到当前 score
        progress = (i + 1) / n_hist
        snap_score = round(score * (0.4 + 0.6 * progress), 1)
        snap_completion = max(1, int(completion * (0.4 + 0.6 * progress)))
        # 维度点亮简化：snap_completion 个 lit
        lit_dims = dims[:snap_completion]
        dims_payload = {d: {"evidence_count": 1, "lit": True} for d in lit_dims}
        s.add(LeadMeddiccHistory(
            lead_id=lead.id,
            snapshot_at=_ts(days_back, hour=11),
            meddicc_score=snap_score,
            meddicc_completion=snap_completion,
            dimensions_json=json.dumps(dims_payload, ensure_ascii=False),
            forecast_category=lead.forecast_category,
            amount=lead.amount,
            trigger_reason="analyze",
        ))


# ── main seed ──────────────────────────────────────────────────────────────


def seed():
    with Session(engine) as s:
        existing = s.exec(select(Lead)).all()
        if len(existing) > 3:
            print(f"Seed data already exists ({len(existing)} leads). Skipping.")
            return

        # Get users
        sales01 = s.exec(select(User).where(User.login == "sales01")).one()
        sales02 = s.exec(select(User).where(User.login == "sales02")).one()
        sales03 = s.exec(select(User).where(User.login == "sales03")).one()
        manager = s.exec(select(User).where(User.login == "manager01")).one()
        admin = s.exec(select(User).where(User.login == "admin")).one()

        # 维护一份 lead -> followup_ids / conversation_ids 的 map（后面给 evidence 找 source_id 用）
        lead_followups: dict[str, list[str]] = {}
        lead_convs: dict[str, list[str]] = {}
        # 维护一份 lead -> profile 的 map（最后批量 seed meddicc）
        lead_profiles: dict[str, dict] = {}
        # 'profile' = (score_tier or None) ; 'analyzed_days_ago'

        # ═══════════════════════════════════════════════════════════════
        # SALES01 — 王小明 (HIGH activity: 12 active leads)
        # forecast 分布：必赢 2 / 大概率 3 / 乐观估算 3 / 进行中 4
        # ═══════════════════════════════════════════════════════════════
        s01_leads_data = [
            # (name, region, source, days_created, forecast, amount, close_in_days, days_last_fu)
            ("北京数字颗粒科技有限公司", "华北", "referral", 15, "必赢",     280000, 10,   1),
            ("天津智联云数据服务公司",   "华北", "organic",  12, "大概率",   150000, 25,   2),
            ("深圳前海微链科技有限公司", "华南", "outbound", 8,  "大概率",   120000, 18,   2),
            ("杭州湖畔云计算有限公司",   "华东", "referral", 6,  "乐观估算", 80000,  45,   3),
            ("成都天府软件园科技公司",   "西南", "organic",  4,  "进行中",   60000,  None, 1),
            ("广州番禺智慧物流有限公司", "华南", "outbound", 2,  "进行中",   None,   None, 1),
            # 新增 6 条：
            ("青岛海信智能制造公司",     "华北", "referral", 18, "必赢",     420000, 14,   2),  # 大单 必赢
            ("厦门厦钨新能源科技公司",   "华南", "organic",  10, "大概率",   180000, 30,   3),
            ("沈阳东软医疗集团",         "东北", "outbound", 14, "乐观估算", 250000, 50,   2),
            ("武汉光谷生物医药公司",     "华中", "referral", 9,  "乐观估算", 95000,  60,   3),
            ("无锡物联网创新中心",       "华东", "organic",  5,  "进行中",   55000,  None, 1),
            ("郑州航空港跨境电商公司",   "华中", "koc_sem",  3,  "进行中",   None,   None, 2),
        ]
        # MEDDICC profile 分布：
        # 0 必赢 hot → high, 6 必赢大单 → high
        # 1,2 大概率 → mid, mid
        # 3,8 乐观 → high(看似热门), mid
        # 4 进行中 → low
        # 5 进行中 → None (没分析过)
        # 7 大概率 → mid (但 amount=180k → 配 abnormal_amount? 不到 500k 不触发)
        # 9 乐观 → low
        # 10 进行中 → low
        # 11 进行中 → None
        s01_profiles = [
            "high",          # 0 北京数字颗粒  必赢
            "mid",           # 1 天津智联云    大概率
            "mid",           # 2 深圳前海微链  大概率
            "high",          # 3 杭州湖畔     乐观估算（看似热门）
            "low",           # 4 成都天府     进行中
            None,            # 5 广州番禺     进行中（没 score）
            "high",          # 6 青岛海信     必赢 大单
            "mid",           # 7 厦门厦钨     大概率
            "mid",           # 8 沈阳东软     乐观估算
            "low",           # 9 武汉光谷     乐观估算
            "low",           # 10 无锡物联网  进行中
            None,            # 11 郑州航空港  进行中（没 score）
        ]
        s01_ids: list[str] = []
        for idx, ld in enumerate(s01_leads_data):
            lid = _id()
            s01_ids.append(lid)
            name, region, source, days_c, fc, amt, close_in, days_fu = ld
            s.add(Lead(
                id=lid, company_name=name, region=region, source=source,
                owner_id=sales01.id, pool="private",
                created_at=_ts(days_c),
                last_followup_at=_ts(days_fu),
                forecast_category=fc, amount=amt,
                close_date=_close_date(close_in),
            ))
            lead_profiles[lid] = {"profile": s01_profiles[idx], "analyzed_days_ago": 2}
            lead_followups[lid] = []
            lead_convs[lid] = []
        s.flush()

        # sales01 contacts (1-2 per lead)
        s01_contacts = [
            (s01_ids[0], "张伟",   "CTO",        True,  "13800001001", "zhangwei_tech"),
            (s01_ids[0], "李娜",   "采购经理",   False, "13800001002", "lina_buy"),
            (s01_ids[1], "王磊",   "IT总监",     True,  "13800001003", "wanglei_it"),
            (s01_ids[2], "赵鹏",   "运营总监",   True,  "13800001006", "zhaopeng_ops"),
            (s01_ids[3], "孙悦",   "产品总监",   True,  "13800001007", "sunyue_pm"),
            (s01_ids[4], "周婷",   "CIO",        True,  "13800001008", "zhouting_cio"),
            (s01_ids[5], "郑楠",   "供应链总监", True,  "13800001010", "zhengnan_scm"),
            # 新增 leads：
            (s01_ids[6], "韩志强", "副总裁",     True,  "13800001011", "hanzq_vp"),
            (s01_ids[6], "陆芸",   "数字化总监", False, "13800001012", "luyun_dx"),
            (s01_ids[7], "吴强",   "新能源VP",   True,  "13800001013", "wuqiang_ne"),
            (s01_ids[8], "黄海涛", "信息中心主任", True, "13800001014", "huanght_it"),
            (s01_ids[9], "苏静",   "研发总监",   True,  "13800001015", "sujing_rd"),
            (s01_ids[10], "邓凯",  "联合创始人", True,  "13800001016", "dengkai_co"),
            (s01_ids[11], "罗敏",  "电商运营经理", False, "13800001017", "luomin_ec"),  # 故意 KP=False 触发 kp_no_contact
        ]
        for (lead_id, name, role, is_kp, phone, wechat) in s01_contacts:
            s.add(Contact(id=_id(), lead_id=lead_id, name=name, role=role,
                          is_key_decision_maker=is_kp, phone=phone, wechat_id=wechat))

        # sales01 followups
        s01_followups = [
            (s01_ids[0], "phone", "电话跟进CTO张伟，讨论私有化部署方案细节，对方提出下周安排技术对接", 1),
            (s01_ids[0], "visit", "上门拜访CTO张伟，演示了产品Demo，对方对数据分析模块很感兴趣", 5),
            (s01_ids[0], "wechat", "微信发送了公司产品白皮书和案例集，客户表示会安排团队内部评审", 10),
            (s01_ids[0], "phone", "首次电话沟通，了解客户IT架构现状，对方表示正在做数字化转型规划", 14),
            (s01_ids[1], "phone", "电话跟进IT预算进展，客户确认Q2有采购计划，预算50万", 2),
            (s01_ids[1], "wechat", "分享了行业解决方案，客户回复说会跟领导汇报", 7),
            (s01_ids[1], "phone", "初次接触，客户正在做年度IT预算规划", 11),
            (s01_ids[2], "visit", "现场调研客户仓储物流现状，与运营总监赵鹏深入讨论方案", 2),
            (s01_ids[2], "phone", "电话了解需求，客户需要供应链数字化解决方案", 7),
            (s01_ids[3], "wechat", "发送竞品对比分析报告，突出差异化优势，对方表示会认真看", 3),
            (s01_ids[3], "phone", "电话沟通，客户已使用竞品产品但合同即将到期", 5),
            (s01_ids[4], "phone", "初次联系，客户CIO对AI赋能很感兴趣，约了下周demo", 3),
            (s01_ids[5], "wechat", "微信加了供应链总监，初步介绍公司业务，对方愿意了解", 1),
            # 新增 leads：
            (s01_ids[6], "visit", "拜访韩志强副总裁，对方对智能排产很认可，承诺月底前给反馈", 2),
            (s01_ids[6], "phone", "电话敲定 POC 范围，客户希望 30 天交付", 6),
            (s01_ids[6], "wechat", "发送 POC 计划书，对方拉了 5 人评审组", 12),
            (s01_ids[7], "phone", "电话了解新能源团队现状，吴强提出能耗管理诉求", 3),
            (s01_ids[7], "wechat", "微信沟通预算口径，对方说今年额度 200 万", 9),
            (s01_ids[8], "visit", "现场考察沈阳总部，黄海涛主任全程陪同", 2),
            (s01_ids[8], "phone", "电话沟通医疗合规要求，客户有过审计经验", 8),
            (s01_ids[9], "wechat", "发送生物医药案例，客户表示场景非常贴合", 3),
            (s01_ids[9], "phone", "电话了解 R&D 数据治理痛点，苏静很有兴趣", 7),
            (s01_ids[10], "phone", "初次电话，邓凯比较忙，约下周再聊", 1),
            (s01_ids[11], "wechat", "微信加了运营经理罗敏，对方说要等老板拍板", 2),
        ]
        for (lead_id, fu_type, content, days_ago) in s01_followups:
            fid = _id()
            s.add(FollowUp(id=fid, lead_id=lead_id, owner_id=sales01.id,
                           type=fu_type, content=content,
                           followed_at=_ts(days_ago, hour=14)))
            lead_followups[lead_id].append(fid)

        # sales01 key events
        s01_events = [
            (s01_ids[0], "visited_kp", {"kp_name": "张伟", "location": "客户办公室"}, 5),
            (s01_ids[0], "book_sent", {"book_title": "决胜B端", "recipient": "张伟"}, 8),
            (s01_ids[2], "visited_kp", {"kp_name": "赵鹏", "location": "深圳仓库"}, 2),
            (s01_ids[6], "visited_kp", {"kp_name": "韩志强", "location": "青岛总部"}, 2),
            (s01_ids[8], "visited_kp", {"kp_name": "黄海涛", "location": "沈阳总部"}, 2),
        ]
        for (lead_id, ke_type, payload, days_ago) in s01_events:
            s.add(KeyEvent(id=_id(), lead_id=lead_id, created_by=sales01.id,
                           type=ke_type, payload=json.dumps(payload, ensure_ascii=False),
                           occurred_at=_ts(days_ago, hour=15)))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # SALES02 — 李思远 (MEDIUM activity: 10 active leads)
        # forecast 分布：必赢 2 / 大概率 2 / 乐观估算 3 / 进行中 3
        # ═══════════════════════════════════════════════════════════════
        s02_leads_data = [
            ("上海锐思达信息技术有限公司", "华东", "koc_sem",  20, "必赢",     350000, 12,   4),
            ("南京中软云数据科技公司",     "华东", "referral", 16, "进行中",   100000, None, 5),
            ("武汉光谷数据智能有限公司",   "华中", "koc_sem",  10, "进行中",   75000,  None, 6),
            ("长沙星城智能制造公司",       "华中", "outbound", 7,  "乐观估算", 50000,  60,   4),
            ("合肥量子信息技术有限公司",   "华东", "organic",  3,  "进行中",   None,   None, 4),
            # 新增 5 条：
            ("苏州工业园区联想数科",       "华东", "referral", 25, "必赢",     680000, 8,    5),  # 大单 + close 临近 → close_date_unprepared 候选
            ("宁波港集团数字化部",         "华东", "outbound", 18, "大概率",   200000, 22,   6),
            ("绍兴柯桥纺织云平台",         "华东", "koc_sem",  12, "大概率",   140000, 35,   4),
            ("南昌江铃汽车数据中心",       "华中", "referral", 14, "乐观估算", 90000,  55,   5),
            ("福州滨海新城智慧城市",       "华南", "organic",  9,  "乐观估算", 70000,  50,   6),
        ]
        # profile 设计：
        # 0 必赢 → high
        # 1 进行中 → mid
        # 2 进行中 → low
        # 3 乐观 → mid
        # 4 进行中 → None
        # 5 必赢 大单 (680k) → low (触发 abnormal_amount: amt>500k & completion<4)
        # 6 大概率 → high
        # 7 大概率 → shallow_pain (触发 shallow_pain warning)
        # 8 乐观 → mid
        # 9 乐观 → None
        s02_profiles = [
            "high",          # 0 必赢
            "mid",           # 1
            "low",           # 2
            "mid",           # 3
            None,            # 4
            "low",           # 5 abnormal_amount target
            "high",          # 6
            "shallow_pain",  # 7
            "mid",           # 8
            None,            # 9
        ]
        s02_ids: list[str] = []
        for idx, ld in enumerate(s02_leads_data):
            lid = _id()
            s02_ids.append(lid)
            name, region, source, days_c, fc, amt, close_in, days_fu = ld
            s.add(Lead(
                id=lid, company_name=name, region=region, source=source,
                owner_id=sales02.id, pool="private",
                created_at=_ts(days_c),
                last_followup_at=_ts(days_fu),
                forecast_category=fc, amount=amt,
                close_date=_close_date(close_in),
            ))
            lead_profiles[lid] = {"profile": s02_profiles[idx], "analyzed_days_ago": 3}
            lead_followups[lid] = []
            lead_convs[lid] = []
        s.flush()

        s02_contacts = [
            (s02_ids[0], "陈静",     "副总裁",          True,  "13800002001", "chenjing_vp"),
            (s02_ids[0], "刘洋",     "技术主管",        False, "13800002002", "liuyang_dev"),
            (s02_ids[1], "吴强",     "数据部主管",      True,  "13800002003", "wuqiang_data"),
            (s02_ids[2], "何建国",   "信息中心主任",    True,  "13800002004", "hejg_it"),
            (s02_ids[3], "曹明",     "智造事业部总监",  True,  "13800002005", "caoming_mfg"),
            (s02_ids[4], "马超",     "CTO",             True,  "13800002006", "machao_cto"),
            (s02_ids[5], "庞鸿",     "数字化负责人",    False, "13800002007", "panghong_dx"),  # KP=False
            (s02_ids[5], "高航",     "技术经理",        False, "13800002008", "gaohang_te"),   # 也 False → kp_no_contact 触发
            (s02_ids[6], "顾炎武",   "港务集团副总",    True,  "13800002009", "guyw_vp"),
            (s02_ids[7], "金怡",     "纺织云项目经理",  True,  "13800002010", "jinyi_pm"),
            (s02_ids[8], "贺晓东",   "数据中心主任",    True,  "13800002011", "hexd_dc"),
            (s02_ids[9], "于洋",     "智慧城市办主任",  True,  "13800002012", "yuyang_sc"),
        ]
        for (lead_id, name, role, is_kp, phone, wechat) in s02_contacts:
            s.add(Contact(id=_id(), lead_id=lead_id, name=name, role=role,
                          is_key_decision_maker=is_kp, phone=phone, wechat_id=wechat))

        s02_followups = [
            (s02_ids[0], "visit", "拜访副总裁陈静，介绍公司背景和核心优势，获得初步认可", 4),
            (s02_ids[0], "phone", "电话确认下周安排技术团队对接", 8),
            (s02_ids[0], "wechat", "发送技术对接方案文档", 12),
            (s02_ids[1], "phone", "电话沟通数据中台需求，对方有明确预算", 5),
            (s02_ids[1], "wechat", "发送产品介绍材料", 14),
            (s02_ids[2], "phone", "初次接触，了解信息化现状", 6),
            (s02_ids[3], "wechat", "微信沟通智能制造需求，对方在选型阶段", 4),
            (s02_ids[4], "phone", "初次电话联系，CTO比较务实，要看实际案例", 4),
            # 新增：
            (s02_ids[5], "phone", "电话联系庞鸿，对方说预算口径还没敲定", 5),
            (s02_ids[5], "wechat", "微信发送方案概述，对方收到", 11),
            (s02_ids[6], "visit", "宁波港现场考察，顾总亲自陪同", 6),
            (s02_ids[6], "phone", "电话沟通三期规划，预计 Q3 启动", 13),
            (s02_ids[7], "phone", "金怡电话沟通纺织行业 SaaS 案例", 4),
            (s02_ids[7], "wechat", "微信发送行业解决方案", 10),
            (s02_ids[8], "phone", "电话了解江铃数据中心建设节奏", 5),
            (s02_ids[8], "visit", "南昌实地拜访贺主任，参观数据中心机房", 14),
            (s02_ids[9], "phone", "电话沟通智慧城市规划，对方说还在论证", 6),
        ]
        for (lead_id, fu_type, content, days_ago) in s02_followups:
            fid = _id()
            s.add(FollowUp(id=fid, lead_id=lead_id, owner_id=sales02.id,
                           type=fu_type, content=content,
                           followed_at=_ts(days_ago, hour=14)))
            lead_followups[lead_id].append(fid)

        s02_events = [
            (s02_ids[0], "visited_kp", {"kp_name": "陈静", "location": "上海总部"}, 4),
            (s02_ids[0], "attended_small_course", {"course_name": "B端产品实战营", "attendee": "刘洋"}, 6),
            (s02_ids[6], "visited_kp", {"kp_name": "顾炎武", "location": "宁波港"}, 6),
        ]
        for (lead_id, ke_type, payload, days_ago) in s02_events:
            s.add(KeyEvent(id=_id(), lead_id=lead_id, created_by=sales02.id,
                           type=ke_type, payload=json.dumps(payload, ensure_ascii=False),
                           occurred_at=_ts(days_ago, hour=15)))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # SALES03 — 张磊 (LOW activity: 8 active leads, last followup 9+ days)
        # forecast 分布：必赢 1 / 大概率 2 / 乐观估算 2 / 进行中 3
        # 多条 stale 触发 stale + close_date_unprepared
        # ═══════════════════════════════════════════════════════════════
        s03_leads_data = [
            ("重庆两江智慧园区公司",     "西南", "outbound", 25, "进行中",   200000, 8,    9),
            ("西安高新区数据产业公司",   "西北", "organic",  18, "进行中",   None,   None, 10),
            ("郑州中原数字经济公司",     "华中", "koc_sem",  14, "进行中",   90000,  -3,   11),
            ("济南泉城云计算有限公司",   "华北", "referral", 10, "进行中",   None,   None, 9),
            # 新增 4 条：
            ("兰州新区数字丝路公司",     "西北", "outbound", 22, "大概率",   160000, 20,   12),
            ("贵阳大数据交易所",         "西南", "referral", 19, "大概率",   130000, 28,   9),
            ("银川宁东能源化工基地",     "西北", "organic",  15, "乐观估算", 110000, 50,   10),
            ("呼和浩特乳业云平台",       "华北", "outbound", 11, "乐观估算", 75000,  None, 14),  # 长期没动
        ]
        # 这里增加一条必赢演示 low_evidence warning（forecast=必赢但 completion<3）
        s03_leads_data.append(
            ("拉萨高原电力调度中心",     "西北", "referral", 8,  "必赢",     220000, 16,   9),  # idx 8
        )
        # profile：
        # 0 进行中 200k close 8d → low (close 临近+score 低 → close_date_unprepared 触发，需 completion<5)
        # 1 进行中 → None
        # 2 进行中 close overdue → mid
        # 3 进行中 → low
        # 4 大概率 → mid
        # 5 大概率 → low (触发 low_evidence: 大概率+completion<3)
        # 6 乐观 → None
        # 7 乐观 → low (无 champion，stale 14d → stale)
        # 8 必赢 → low (触发 low_evidence: 必赢+completion<3)
        s03_profiles = [
            "low",   # 0
            None,    # 1
            "mid",   # 2
            "low",   # 3
            "mid",   # 4
            "low",   # 5
            None,    # 6
            "low",   # 7
            "low",   # 8 必赢但 low → low_evidence
        ]
        s03_ids: list[str] = []
        for idx, ld in enumerate(s03_leads_data):
            lid = _id()
            s03_ids.append(lid)
            name, region, source, days_c, fc, amt, close_in, days_fu = ld
            s.add(Lead(
                id=lid, company_name=name, region=region, source=source,
                owner_id=sales03.id, pool="private",
                created_at=_ts(days_c),
                last_followup_at=_ts(days_fu),
                forecast_category=fc, amount=amt,
                close_date=_close_date(close_in),
            ))
            lead_profiles[lid] = {"profile": s03_profiles[idx], "analyzed_days_ago": 5}
            lead_followups[lid] = []
            lead_convs[lid] = []
        s.flush()

        s03_contacts = [
            (s03_ids[0], "钱学森",  "园区管理处长",     True,  "13800003001", None),
            (s03_ids[1], "宋明",    "产业园运营总监",   True,  "13800003002", "songming_ops"),
            (s03_ids[2], "谢芳",    "数字化转型办主任", True,  "13800003003", "xiefang_dx"),
            (s03_ids[3], "林晓峰",  "IT部经理",         False, "13800003004", "linxf_it"),
            (s03_ids[4], "马天",    "丝路数据中心主任", True,  "13800003005", "matian_dc"),
            (s03_ids[5], "周斌",    "交易所技术总监",   True,  "13800003006", "zhoubin_te"),
            (s03_ids[6], "袁丽",    "能源管理科科长",   True,  "13800003007", "yuanli_em"),
            (s03_ids[7], "杜宇",    "信息部经理",       False, "13800003008", "duyu_it"),  # 故意 False
            (s03_ids[8], "陶磊",    "高原电力调度科长", True,  "13800003009", "taolei_pwr"),
        ]
        for (lead_id, name, role, is_kp, phone, wechat) in s03_contacts:
            s.add(Contact(id=_id(), lead_id=lead_id, name=name, role=role,
                          is_key_decision_maker=is_kp, phone=phone, wechat_id=wechat))

        s03_followups = [
            (s03_ids[0], "phone", "电话初次沟通，了解园区数字化诉求", 9),
            (s03_ids[1], "phone", "电话联系运营总监，对方说在忙年底预算", 10),
            (s03_ids[2], "wechat", "微信发了公司介绍，对方已读未回", 12),
            (s03_ids[3], "phone", "初次接触，客户说可以先发资料看看", 9),
            # 新增：
            (s03_ids[4], "phone", "电话沟通丝路数据中心规划，对方说还在等政府文件", 12),
            (s03_ids[4], "wechat", "微信发送方案大纲，对方表示再等等", 25),
            (s03_ids[5], "phone", "贵阳交易所周总沟通技术对接，对方比较忙", 9),
            (s03_ids[6], "phone", "电话袁丽，对方表示能源化工项目预算紧张", 10),
            (s03_ids[7], "wechat", "微信加了杜经理，发送公司介绍，对方未回复", 14),  # stale 触发
            (s03_ids[8], "phone", "电话拉萨陶科长，对方说项目还在前期调研", 9),
        ]
        for (lead_id, fu_type, content, days_ago) in s03_followups:
            fid = _id()
            s.add(FollowUp(id=fid, lead_id=lead_id, owner_id=sales03.id,
                           type=fu_type, content=content,
                           followed_at=_ts(days_ago, hour=14)))
            lead_followups[lead_id].append(fid)

        # 一两个 key event
        s03_events = [
            (s03_ids[2], "visited_kp", {"kp_name": "谢芳", "location": "郑州"}, 11),
        ]
        for (lead_id, ke_type, payload, days_ago) in s03_events:
            s.add(KeyEvent(id=_id(), lead_id=lead_id, created_by=sales03.id,
                           type=ke_type, payload=json.dumps(payload, ensure_ascii=False),
                           occurred_at=_ts(days_ago, hour=15)))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # MANAGER01 — 陈队长 (4 active leads)
        # ═══════════════════════════════════════════════════════════════
        mgr_leads_data = [
            ("北京华信恒通集团",         "华北", "referral", 20, "必赢",     500000, 20,   3),
            ("天津港务数字化转型中心",   "华北", "organic",  14, "大概率",   300000, 35,   3),
            # 新增 2 条：
            ("国家电网华北分公司",       "华北", "referral", 28, "必赢",     820000, 22,   4),  # 大单 abnormal_amount 候选
            ("中石化炼化工程集团",       "华北", "outbound", 16, "乐观估算", 350000, 60,   5),
        ]
        mgr_profiles = [
            "high",   # 0 北京华信恒通
            "mid",    # 1 天津港务
            "low",    # 2 国家电网 大单 + low → abnormal_amount
            "mid",    # 3 中石化
        ]
        mgr_ids: list[str] = []
        for idx, ld in enumerate(mgr_leads_data):
            lid = _id()
            mgr_ids.append(lid)
            name, region, source, days_c, fc, amt, close_in, days_fu = ld
            s.add(Lead(
                id=lid, company_name=name, region=region, source=source,
                owner_id=manager.id, pool="private",
                created_at=_ts(days_c),
                last_followup_at=_ts(days_fu),
                forecast_category=fc, amount=amt,
                close_date=_close_date(close_in),
            ))
            lead_profiles[lid] = {"profile": mgr_profiles[idx], "analyzed_days_ago": 2}
            lead_followups[lid] = []
            lead_convs[lid] = []
        s.flush()

        mgr_contacts = [
            (mgr_ids[0], "黄志远", "董事长",       True,  "13900002001", "huangzy_ceo"),
            (mgr_ids[0], "林晓峰", "总经理助理",   False, "13900002002", "linxf_asst"),
            (mgr_ids[1], "何建国", "数字化总监",   True,  "13900002003", "hejg_digital"),
            (mgr_ids[2], "卢战胜", "信息通信部主任", True, "13900002004", "luzs_it"),
            (mgr_ids[3], "石海亮", "工艺数字化总监", True, "13900002005", "shihl_dx"),
        ]
        for (lead_id, name, role, is_kp, phone, wechat) in mgr_contacts:
            s.add(Contact(id=_id(), lead_id=lead_id, name=name, role=role,
                          is_key_decision_maker=is_kp, phone=phone, wechat_id=wechat))

        mgr_followups = [
            (mgr_ids[0], "visit", "第二次上门，带技术专家讨论实施方案", 3),
            (mgr_ids[0], "phone", "电话跟进合作框架协议细节", 8),
            (mgr_ids[0], "visit", "拜访董事长黄志远，高层对接，讨论战略合作", 18),
            (mgr_ids[1], "visit", "现场考察码头运营，了解业务痛点", 5),
            (mgr_ids[1], "phone", "电话沟通港务数字化需求", 12),
            (mgr_ids[2], "phone", "电话卢主任，对方说集团采购流程严格，要走正式招标", 4),
            (mgr_ids[2], "wechat", "微信发送资质材料和过往央企案例", 10),
            (mgr_ids[3], "visit", "拜访石总，参观炼化工厂，对工艺数据采集场景熟悉", 5),
            (mgr_ids[3], "phone", "电话沟通工艺数字化预算口径", 12),
        ]
        for (lead_id, fu_type, content, days_ago) in mgr_followups:
            fid = _id()
            s.add(FollowUp(id=fid, lead_id=lead_id, owner_id=manager.id,
                           type=fu_type, content=content,
                           followed_at=_ts(days_ago, hour=14)))
            lead_followups[lead_id].append(fid)

        mgr_events = [
            (mgr_ids[0], "visited_kp", {"kp_name": "黄志远", "location": "集团总部"}, 3),
            (mgr_ids[0], "book_sent", {"book_title": "决胜B端", "recipient": "黄志远"}, 15),
            (mgr_ids[1], "visited_kp", {"kp_name": "何建国", "location": "天津港"}, 5),
            (mgr_ids[3], "visited_kp", {"kp_name": "石海亮", "location": "炼化基地"}, 5),
        ]
        for (lead_id, ke_type, payload, days_ago) in mgr_events:
            s.add(KeyEvent(id=_id(), lead_id=lead_id, created_by=manager.id,
                           type=ke_type, payload=json.dumps(payload, ensure_ascii=False),
                           occurred_at=_ts(days_ago, hour=15)))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # PUBLIC POOL (7 leads, no owner)
        # ═══════════════════════════════════════════════════════════════
        public_leads = [
            {"name": "昆明滇池数字经济公司",     "region": "西南", "source": "outbound", "days": 18},
            {"name": "沈阳铁西装备制造信息中心", "region": "东北", "source": "referral", "days": 22},
            {"name": "福州数字中国产业基地",     "region": "华南", "source": "organic",  "days": 15},
            {"name": "哈尔滨冰城智慧科技公司",   "region": "东北", "source": "koc_sem",  "days": 20},
            {"name": "大连软件园数据港",         "region": "东北", "source": "outbound", "days": 12},
            {"name": "石家庄正定数字小镇",       "region": "华北", "source": "organic",  "days": 16},
            {"name": "南宁东盟跨境数据中心",     "region": "华南", "source": "outbound", "days": 24},
        ]
        for ld in public_leads:
            s.add(Lead(id=_id(), company_name=ld["name"], region=ld["region"],
                       source=ld["source"], owner_id=None, pool="public",
                       created_at=_ts(ld["days"])))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # CONVERTED CUSTOMERS (已赢单)
        # sales01: 3, sales02: 2, sales03: 2 → 共 7 单
        # ═══════════════════════════════════════════════════════════════
        converted_data = [
            {"name": "苏州工业园区金蝶信息",     "region": "华东", "source": "referral",
             "owner": sales01.id, "days": 45, "amount": 380000},
            {"name": "南京紫金山实验室",         "region": "华东", "source": "organic",
             "owner": sales01.id, "days": 60, "amount": 220000},
            {"name": "佛山顺德美的工业云",       "region": "华南", "source": "outbound",
             "owner": sales01.id, "days": 35, "amount": 410000},
            {"name": "青岛海尔卡奥斯平台",       "region": "华北", "source": "koc_sem",
             "owner": sales02.id, "days": 40, "amount": 450000},
            {"name": "杭州阿里云智能事业部",     "region": "华东", "source": "referral",
             "owner": sales02.id, "days": 55, "amount": 280000},
            {"name": "西安西电集团数字工厂",     "region": "西北", "source": "outbound",
             "owner": sales03.id, "days": 50, "amount": 195000},
            {"name": "重庆长安汽车数字化中心",   "region": "西南", "source": "referral",
             "owner": sales03.id, "days": 38, "amount": 320000},
        ]
        for cld in converted_data:
            lead_id = _id()
            customer_id = _id()
            s.add(Lead(id=lead_id, company_name=cld["name"], region=cld["region"],
                       source=cld["source"], owner_id=cld["owner"], pool="private",
                       stage="converted", created_at=_ts(cld["days"]),
                       converted_at=_ts(cld["days"] - 20),
                       forecast_category="已赢单",
                       amount=cld.get("amount", 200000),
                       close_date=_ts(cld["days"] - 20)[:10]))
            s.flush()
            s.add(Customer(id=customer_id, lead_id=lead_id, company_name=cld["name"],
                           region=cld["region"], owner_id=cld["owner"],
                           source=cld["source"], created_at=_ts(cld["days"] - 20)))
            s.flush()
            s.add(Contact(id=_id(), customer_id=customer_id,
                          name="客户联系人", role="项目经理", is_key_decision_maker=True,
                          phone=f"1380000{cld['days']}"))
            s.add(FollowUp(id=_id(), customer_id=customer_id, owner_id=cld["owner"],
                           type="phone", content=f"客户回访，{cld['name']}使用情况良好",
                           followed_at=_ts(5, hour=10)))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # LOST LEADS（已丢单 tab）
        # sales01:1, sales02:2, sales03:2 → 共 5 单
        # ═══════════════════════════════════════════════════════════════
        lost_data = [
            ("郑州未来工厂科技有限公司",   "华中", "koc_sem",  sales02.id, 50, 35, 30, 180000),
            ("珠海横琴跨境创新中心",       "华南", "outbound", sales01.id, 65, 45, 40, 240000),
            ("温州瑞安汽配集群",           "华东", "referral", sales02.id, 70, 50, 45, 90000),
            ("太原能源大数据中心",         "华北", "organic",  sales03.id, 55, 38, 32, 130000),
            ("洛阳机械工业云项目",         "华中", "outbound", sales03.id, 80, 60, 55, 200000),
        ]
        for (name, region, source, owner, d_created, d_last_fu, d_lost, amt) in lost_data:
            lid = _id()
            s.add(Lead(
                id=lid, company_name=name, region=region, source=source,
                owner_id=owner, pool="private", stage="lost",
                forecast_category="已丢单", amount=amt,
                created_at=_ts(d_created),
                last_followup_at=_ts(d_last_fu),
                lost_at=_ts(d_lost),
            ))
            s.flush()
            s.add(Contact(id=_id(), lead_id=lid, name="刘总", role="总经理",
                          is_key_decision_maker=True, phone="13800999001"))
        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # NOTIFICATIONS
        # ═══════════════════════════════════════════════════════════════
        notifications = [
            (sales03.id, "release", "线索即将释放提醒",
             "您的线索「重庆两江智慧园区」已超过 9 天未跟进，还有 1 天将自动释放至公共池。", 0),
            (sales03.id, "release", "线索即将释放提醒",
             "您的线索「西安高新区数据产业」已超过 9 天未跟进，还有 1 天将自动释放至公共池。", 0),
            (manager.id, "release", "团队线索释放预警",
             "张磊 有 4 条线索超过 9 天未跟进，即将自动释放。请及时提醒。", 0),
            (sales01.id, "conversion_window", "转化窗口期提醒",
             "客户「苏州工业园区金蝶信息」转化窗口期还剩 10 天，请尽快推进大课购买。", 2),
        ]
        for (user_id, ntype, title, content, days_ago) in notifications:
            s.add(Notification(id=_id(), user_id=user_id, type=ntype,
                               title=title, content=content, is_read=False,
                               created_at=_ts(days_ago, hour=9)))

        # ═══════════════════════════════════════════════════════════════
        # SPEC 003 — 给 demo lead 种入对话记录（Conversation）
        # ═══════════════════════════════════════════════════════════════
        SEED_CONVERSATIONS = {
            "深圳前海微链科技有限公司": [
                (-10, "销售：赵总您好，我是培训公司小王，老李推荐过来的。\n客户：嗯，老李去年上过你们大课，说还行。\n销售：能聊聊您公司现在的情况吗？\n客户：业绩压力大，团队也不稳定。"),
                (-7, "销售：上周聊到您团队问题，具体什么情况？\n客户：去年走了 3 个核心，今年又走了 2 个。我们行业人难招。\n销售：核心走的原因主要是什么？\n客户：薪资倒不是主要问题，主要是看不到成长。"),
                (-5, "客户：王老师课程主要讲啥？\n销售：王老师本身带过 3 家上市公司，重点讲老板成长 + 团队建设。\n客户：那挺对路。我跟我太太说了，她也觉得我该上这种课。"),
            ],
            "北京数字颗粒科技有限公司": [
                (-8, "销售：张总，最近聊一下你们业务现状？\n客户：今年挺难，月营收从 200 万掉到 130 万。我合伙人小李天天念叨。\n销售：有没有想过通过培训改善？\n客户：考虑过。我看了樊登的，行动派的，都在比。"),
                (-4, "客户：你们大课多少钱？\n销售：20 万。\n客户：20 万对我来说不小。我要跟我合伙人小李商量。他比我更看重 ROI。\n销售：理解，我可以发学员业绩对比报告给您们看。"),
            ],
            "天津智联云数据服务公司": [
                (-6, "销售：王总好，您之前对我们大课表示有兴趣？\n客户：嗯，我先看看资料。说实话我自己每天看公众号文章不少。\n销售：自学到什么程度了？\n客户：理论懂了不少，落不下来。"),
                (-3, "客户：还在犹豫。20 万压力还是有。我想再扛扛自己想想。\n销售：能理解。但您的业绩瓶颈一直在。"),
            ],
            "上海锐思达信息技术有限公司": [
                (-12, "销售：陈总，跟您聊一下数字化转型规划？\n客户：今年集团给我 300 万预算，但要看见效果。\n销售：您最关心哪几个指标？\n客户：客户留存率 + 销售人效。"),
                (-6, "客户：技术对接放在下下周，刘洋牵头。\n销售：好的，我们准备 3 个场景的 Demo。"),
            ],
            "北京华信恒通集团": [
                (-15, "销售：黄总，咱们集团的数字化主线是什么？\n客户：一定是供应链 + 客户运营。我让晓峰对接你们。\n销售：晓峰是您助理对吧？\n客户：对，他汇报给我，技术上找老何。"),
                (-8, "销售：上次提到 Q2 末必须落地？\n客户：对，集团董事会 4 月 15 号开，我得带方案过会。\n销售：金额上有方向吗？\n客户：500 万以内不用过会，超了就要走采购。"),
            ],
        }

        for company_name, convs in SEED_CONVERSATIONS.items():
            lead = s.exec(select(Lead).where(Lead.company_name == company_name)).first()
            if not lead:
                continue
            owner_id = lead.owner_id or admin.id
            for offset_days, content in convs:
                cid = _id()
                s.add(Conversation(
                    id=cid,
                    lead_id=lead.id,
                    recorded_at=_ts(abs(offset_days), hour=14),
                    content=content,
                    source="mock_seed",
                    scenario_card_id=None,
                    created_by=owner_id,
                ))
                lead_convs.setdefault(lead.id, []).append(cid)

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # MEDDICC SCORES + EVIDENCE + HISTORY (静态 seed，不走 LLM)
        # ═══════════════════════════════════════════════════════════════
        # 重新拿一次 lead 对象（保证 SQLAlchemy session 同步）
        all_seeded_lead_ids = list(lead_profiles.keys())
        leads_obj = s.exec(select(Lead).where(Lead.id.in_(all_seeded_lead_ids))).all()  # type: ignore
        lead_obj_map = {l.id: l for l in leads_obj}

        seed_idx = 0
        for lid, meta in lead_profiles.items():
            tier = meta["profile"]
            profile = _score_profile(tier, seed_idx) if tier else None
            lead_obj = lead_obj_map.get(lid)
            if lead_obj is None:
                seed_idx += 1
                continue
            _seed_meddicc_for_lead(
                s, lead_obj, profile,
                followup_ids_for_lead=lead_followups.get(lid, []),
                conversation_ids_for_lead=lead_convs.get(lid, []),
                analyzed_days_ago=meta.get("analyzed_days_ago", 2),
                seed_idx=seed_idx,
            )
            seed_idx += 1

        s.commit()

        # ═══════════════════════════════════════════════════════════════
        # Stats
        # ═══════════════════════════════════════════════════════════════
        all_leads = s.exec(select(Lead)).all()
        lead_count = len(all_leads)
        customer_count = len(s.exec(select(Customer)).all())
        contact_count = len(s.exec(select(Contact)).all())
        followup_count = len(s.exec(select(FollowUp)).all())
        conversation_count = len(s.exec(select(Conversation)).all())
        evidence_count = len(s.exec(select(LeadMeddiccEvidence)).all())
        history_count = len(s.exec(select(LeadMeddiccHistory)).all())
        scored_count = sum(1 for l in all_leads if l.meddicc_score is not None)

        # forecast bucket 分布
        bucket_counts: dict[str, int] = {}
        for l in all_leads:
            if l.stage == "converted":
                cat = "已赢单"
            elif l.stage == "lost":
                cat = "已丢单"
            elif l.stage == "active":
                cat = l.forecast_category or "进行中"
            else:
                cat = "其他"
            bucket_counts[cat] = bucket_counts.get(cat, 0) + 1

        print(f"Seed data created successfully!")
        print(f"  Leads:         {lead_count}  (scored: {scored_count})")
        print(f"  Customers:     {customer_count}")
        print(f"  Contacts:      {contact_count}")
        print(f"  Follow-ups:    {followup_count}")
        print(f"  Conversations: {conversation_count}")
        print(f"  Evidence rows: {evidence_count}")
        print(f"  History snaps: {history_count}")
        print(f"  Forecast buckets: {bucket_counts}")


if __name__ == "__main__":
    seed()
