"""Seed realistic test data for demo.

Three salespeople with deliberately different activity levels:
- sales01 (王小明): HIGH — recent followups within 1-3 days
- sales02 (李思远): MEDIUM — last followup 4 days ago
- sales03 (张磊):   LOW — last followup 9 days ago, leads about to auto-release
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.core.database import engine
from app.models.contact import Contact
from app.models.customer import Customer
from app.models.followup import FollowUp
from app.models.key_event import KeyEvent
from app.models.lead import Lead
from app.models.notification import Notification
from app.models.org import User
from app.models.report import DailyReport


def _ts(days_ago: int = 0, hour: int = 10) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    dt = dt.replace(hour=hour, minute=0, second=0, microsecond=0)
    return dt.isoformat()


def _id() -> str:
    return str(uuid.uuid4())


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

        # ═══════════════════════════════════════════════════════════════
        # SALES01 — 王小明 (HIGH activity: 6 leads, followups within 1-3 days)
        # ═══════════════════════════════════════════════════════════════
        s01_leads_data = [
            {"name": "北京数字颗粒科技有限公司", "region": "华北", "source": "referral", "days": 15},
            {"name": "天津智联云数据服务公司", "region": "华北", "source": "organic", "days": 12},
            {"name": "深圳前海微链科技有限公司", "region": "华南", "source": "outbound", "days": 8},
            {"name": "杭州湖畔云计算有限公司", "region": "华东", "source": "referral", "days": 6},
            {"name": "成都天府软件园科技公司", "region": "西南", "source": "organic", "days": 4},
            {"name": "广州番禺智慧物流有限公司", "region": "华南", "source": "outbound", "days": 2},
        ]
        s01_ids = []
        for ld in s01_leads_data:
            lid = _id()
            s01_ids.append(lid)
            s.add(Lead(id=lid, company_name=ld["name"], region=ld["region"],
                       source=ld["source"], owner_id=sales01.id, pool="private",
                       created_at=_ts(ld["days"]),
                       last_followup_at=_ts(1)))  # all followed up 1 day ago
        s.flush()

        # sales01 contacts
        s01_contacts = [
            (s01_ids[0], "张伟", "CTO", True, "13800001001", "zhangwei_tech"),
            (s01_ids[0], "李娜", "采购经理", False, "13800001002", "lina_buy"),
            (s01_ids[1], "王磊", "IT总监", True, "13800001003", "wanglei_it"),
            (s01_ids[2], "赵鹏", "运营总监", True, "13800001006", "zhaopeng_ops"),
            (s01_ids[3], "孙悦", "产品总监", True, "13800001007", "sunyue_pm"),
            (s01_ids[4], "周婷", "CIO", True, "13800001008", "zhouting_cio"),
            (s01_ids[5], "郑楠", "供应链总监", True, "13800001010", "zhengnan_scm"),
        ]
        for (lead_id, name, role, is_kp, phone, wechat) in s01_contacts:
            s.add(Contact(id=_id(), lead_id=lead_id, name=name, role=role,
                          is_key_decision_maker=is_kp, phone=phone, wechat_id=wechat))

        # sales01 followups — active within 1-3 days
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
        ]
        for (lead_id, fu_type, content, days_ago) in s01_followups:
            s.add(FollowUp(id=_id(), lead_id=lead_id, owner_id=sales01.id,
                           type=fu_type, content=content,
                           followed_at=_ts(days_ago, hour=14)))

        # sales01 key events
        s01_events = [
            (s01_ids[0], "visited_kp", {"kp_name": "张伟", "location": "客户办公室"}, 5),
            (s01_ids[0], "book_sent", {"book_title": "决胜B端", "recipient": "张伟"}, 8),
            (s01_ids[2], "visited_kp", {"kp_name": "赵鹏", "location": "深圳仓库"}, 2),
        ]
        for (lead_id, ke_type, payload, days_ago) in s01_events:
            s.add(KeyEvent(id=_id(), lead_id=lead_id, created_by=sales01.id,
                           type=ke_type, payload=json.dumps(payload, ensure_ascii=False),
                           occurred_at=_ts(days_ago, hour=15)))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # SALES02 — 李思远 (MEDIUM activity: 5 leads, last followup 4 days ago)
        # ═══════════════════════════════════════════════════════════════
        s02_leads_data = [
            {"name": "上海锐思达信息技术有限公司", "region": "华东", "source": "koc_sem", "days": 20},
            {"name": "南京中软云数据科技公司", "region": "华东", "source": "referral", "days": 16},
            {"name": "武汉光谷数据智能有限公司", "region": "华中", "source": "koc_sem", "days": 10},
            {"name": "长沙星城智能制造公司", "region": "华中", "source": "outbound", "days": 7},
            {"name": "合肥量子信息技术有限公司", "region": "华东", "source": "organic", "days": 3},
        ]
        s02_ids = []
        for ld in s02_leads_data:
            lid = _id()
            s02_ids.append(lid)
            s.add(Lead(id=lid, company_name=ld["name"], region=ld["region"],
                       source=ld["source"], owner_id=sales02.id, pool="private",
                       created_at=_ts(ld["days"]),
                       last_followup_at=_ts(4)))  # last followup 4 days ago
        s.flush()

        s02_contacts = [
            (s02_ids[0], "陈静", "副总裁", True, "13800002001", "chenjing_vp"),
            (s02_ids[0], "刘洋", "技术主管", False, "13800002002", "liuyang_dev"),
            (s02_ids[1], "吴强", "数据部主管", True, "13800002003", "wuqiang_data"),
            (s02_ids[2], "何建国", "信息中心主任", True, "13800002004", "hejg_it"),
            (s02_ids[3], "曹明", "智造事业部总监", True, "13800002005", "caoming_mfg"),
            (s02_ids[4], "马超", "CTO", True, "13800002006", "machao_cto"),
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
        ]
        for (lead_id, fu_type, content, days_ago) in s02_followups:
            s.add(FollowUp(id=_id(), lead_id=lead_id, owner_id=sales02.id,
                           type=fu_type, content=content,
                           followed_at=_ts(days_ago, hour=14)))

        s02_events = [
            (s02_ids[0], "visited_kp", {"kp_name": "陈静", "location": "上海总部"}, 4),
            (s02_ids[0], "attended_small_course", {"course_name": "B端产品实战营", "attendee": "刘洋"}, 6),
        ]
        for (lead_id, ke_type, payload, days_ago) in s02_events:
            s.add(KeyEvent(id=_id(), lead_id=lead_id, created_by=sales02.id,
                           type=ke_type, payload=json.dumps(payload, ensure_ascii=False),
                           occurred_at=_ts(days_ago, hour=15)))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # SALES03 — 张磊 (LOW activity: 4 leads, last followup 9 days ago!)
        # Multiple leads about to hit 10-day auto-release threshold
        # ═══════════════════════════════════════════════════════════════
        s03_leads_data = [
            {"name": "重庆两江智慧园区公司", "region": "西南", "source": "outbound", "days": 25},
            {"name": "西安高新区数据产业公司", "region": "西北", "source": "organic", "days": 18},
            {"name": "郑州中原数字经济公司", "region": "华中", "source": "koc_sem", "days": 14},
            {"name": "济南泉城云计算有限公司", "region": "华北", "source": "referral", "days": 10},
        ]
        s03_ids = []
        for ld in s03_leads_data:
            lid = _id()
            s03_ids.append(lid)
            s.add(Lead(id=lid, company_name=ld["name"], region=ld["region"],
                       source=ld["source"], owner_id=sales03.id, pool="private",
                       created_at=_ts(ld["days"]),
                       last_followup_at=_ts(9)))  # 9 days ago! 1 day from release!
        s.flush()

        s03_contacts = [
            (s03_ids[0], "钱学森", "园区管理处长", True, "13800003001", None),
            (s03_ids[1], "宋明", "产业园运营总监", True, "13800003002", "songming_ops"),
            (s03_ids[2], "谢芳", "数字化转型办主任", True, "13800003003", "xiefang_dx"),
            (s03_ids[3], "林晓峰", "IT部经理", False, "13800003004", "linxf_it"),
        ]
        for (lead_id, name, role, is_kp, phone, wechat) in s03_contacts:
            s.add(Contact(id=_id(), lead_id=lead_id, name=name, role=role,
                          is_key_decision_maker=is_kp, phone=phone, wechat_id=wechat))

        # Only a few old followups — clearly slacking
        s03_followups = [
            (s03_ids[0], "phone", "电话初次沟通，了解园区数字化诉求", 9),
            (s03_ids[1], "phone", "电话联系运营总监，对方说在忙年底预算", 9),
            (s03_ids[2], "wechat", "微信发了公司介绍，对方已读未回", 12),
            (s03_ids[3], "phone", "初次接触，客户说可以先发资料看看", 9),
        ]
        for (lead_id, fu_type, content, days_ago) in s03_followups:
            s.add(FollowUp(id=_id(), lead_id=lead_id, owner_id=sales03.id,
                           type=fu_type, content=content,
                           followed_at=_ts(days_ago, hour=14)))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # MANAGER01 — 陈队长 (has own leads too)
        # ═══════════════════════════════════════════════════════════════
        mgr_leads_data = [
            {"name": "北京华信恒通集团", "region": "华北", "source": "referral", "days": 20},
            {"name": "天津港务数字化转型中心", "region": "华北", "source": "organic", "days": 14},
        ]
        mgr_ids = []
        for ld in mgr_leads_data:
            lid = _id()
            mgr_ids.append(lid)
            s.add(Lead(id=lid, company_name=ld["name"], region=ld["region"],
                       source=ld["source"], owner_id=manager.id, pool="private",
                       created_at=_ts(ld["days"]),
                       last_followup_at=_ts(3)))
        s.flush()

        mgr_contacts = [
            (mgr_ids[0], "黄志远", "董事长", True, "13900002001", "huangzy_ceo"),
            (mgr_ids[0], "林晓峰", "总经理助理", False, "13900002002", "linxf_asst"),
            (mgr_ids[1], "何建国", "数字化总监", True, "13900002003", "hejg_digital"),
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
        ]
        for (lead_id, fu_type, content, days_ago) in mgr_followups:
            s.add(FollowUp(id=_id(), lead_id=lead_id, owner_id=manager.id,
                           type=fu_type, content=content,
                           followed_at=_ts(days_ago, hour=14)))

        mgr_events = [
            (mgr_ids[0], "visited_kp", {"kp_name": "黄志远", "location": "集团总部"}, 3),
            (mgr_ids[0], "book_sent", {"book_title": "决胜B端", "recipient": "黄志远"}, 15),
            (mgr_ids[1], "visited_kp", {"kp_name": "何建国", "location": "天津港"}, 5),
        ]
        for (lead_id, ke_type, payload, days_ago) in mgr_events:
            s.add(KeyEvent(id=_id(), lead_id=lead_id, created_by=manager.id,
                           type=ke_type, payload=json.dumps(payload, ensure_ascii=False),
                           occurred_at=_ts(days_ago, hour=15)))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # PUBLIC POOL (4 leads, no owner)
        # ═══════════════════════════════════════════════════════════════
        public_leads = [
            {"name": "昆明滇池数字经济公司", "region": "西南", "source": "outbound", "days": 18},
            {"name": "沈阳铁西装备制造信息中心", "region": "东北", "source": "referral", "days": 22},
            {"name": "福州数字中国产业基地", "region": "华南", "source": "organic", "days": 15},
            {"name": "哈尔滨冰城智慧科技公司", "region": "东北", "source": "koc_sem", "days": 20},
        ]
        for ld in public_leads:
            s.add(Lead(id=_id(), company_name=ld["name"], region=ld["region"],
                       source=ld["source"], owner_id=None, pool="public",
                       created_at=_ts(ld["days"])))

        s.flush()

        # ═══════════════════════════════════════════════════════════════
        # CONVERTED CUSTOMERS
        # ═══════════════════════════════════════════════════════════════
        converted_data = [
            # sales01: 2 customers
            {"name": "苏州工业园区金蝶信息", "region": "华东", "source": "referral",
             "owner": sales01.id, "days": 45},
            {"name": "南京紫金山实验室", "region": "华东", "source": "organic",
             "owner": sales01.id, "days": 60},
            # sales02: 1 customer
            {"name": "青岛海尔卡奥斯平台", "region": "华北", "source": "koc_sem",
             "owner": sales02.id, "days": 40},
        ]
        for cld in converted_data:
            lead_id = _id()
            customer_id = _id()
            s.add(Lead(id=lead_id, company_name=cld["name"], region=cld["region"],
                       source=cld["source"], owner_id=cld["owner"], pool="private",
                       stage="converted", created_at=_ts(cld["days"]),
                       converted_at=_ts(cld["days"] - 20)))
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

        s.commit()

        # Stats
        lead_count = len(s.exec(select(Lead)).all())
        customer_count = len(s.exec(select(Customer)).all())
        contact_count = len(s.exec(select(Contact)).all())
        followup_count = len(s.exec(select(FollowUp)).all())

        print(f"Seed data created successfully!")
        print(f"  Leads:     {lead_count}")
        print(f"  Customers: {customer_count}")
        print(f"  Contacts:  {contact_count}")
        print(f"  Follow-ups: {followup_count}")


if __name__ == "__main__":
    seed()
