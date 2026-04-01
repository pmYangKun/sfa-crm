"""Seed realistic test data for all accounts."""

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
    """Generate ISO timestamp N days ago."""
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    dt = dt.replace(hour=hour, minute=0, second=0, microsecond=0)
    return dt.isoformat()


def _id() -> str:
    return str(uuid.uuid4())


def seed():
    with Session(engine) as s:
        # Check if seed data already exists
        existing = s.exec(select(Lead)).all()
        if len(existing) > 3:
            print(f"Seed data already exists ({len(existing)} leads). Skipping.")
            return

        # Get user IDs
        admin = s.exec(select(User).where(User.login == "admin")).one()
        sales = s.exec(select(User).where(User.login == "sales01")).one()
        manager = s.exec(select(User).where(User.login == "manager01")).one()

        # ─── Sales01 的线索 (8条) ────────────────────────────────────
        sales_leads = [
            {"name": "北京数字颗粒科技有限公司", "region": "华北", "source": "referral", "days": 15},
            {"name": "天津智联云数据服务公司", "region": "华北", "source": "organic", "days": 12},
            {"name": "上海锐思达信息技术有限公司", "region": "华东", "source": "koc_sem", "days": 10},
            {"name": "深圳前海微链科技有限公司", "region": "华南", "source": "outbound", "days": 8},
            {"name": "杭州湖畔云计算有限公司", "region": "华东", "source": "referral", "days": 6},
            {"name": "成都天府软件园科技公司", "region": "西南", "source": "organic", "days": 4},
            {"name": "武汉光谷数据智能有限公司", "region": "华中", "source": "koc_sem", "days": 2},
            {"name": "广州番禺智慧物流有限公司", "region": "华南", "source": "outbound", "days": 1},
        ]

        sales_lead_ids = []
        for ld in sales_leads:
            lead_id = _id()
            sales_lead_ids.append(lead_id)
            s.add(Lead(
                id=lead_id, company_name=ld["name"], region=ld["region"],
                source=ld["source"], owner_id=sales.id, pool="private",
                created_at=_ts(ld["days"]),
                last_followup_at=_ts(ld["days"] - 1) if ld["days"] > 2 else None,
            ))

        # ─── Manager01 的线索 (5条) ──────────────────────────────────
        mgr_leads = [
            {"name": "北京华信恒通集团", "region": "华北", "source": "referral", "days": 20},
            {"name": "天津港务数字化转型中心", "region": "华北", "source": "organic", "days": 14},
            {"name": "河北雄安新区智慧城市公司", "region": "华北", "source": "koc_sem", "days": 9},
            {"name": "山东齐鲁制药信息部", "region": "华北", "source": "outbound", "days": 5},
            {"name": "大连船舶重工数字化部", "region": "东北", "source": "referral", "days": 3},
        ]

        mgr_lead_ids = []
        for ld in mgr_leads:
            lead_id = _id()
            mgr_lead_ids.append(lead_id)
            s.add(Lead(
                id=lead_id, company_name=ld["name"], region=ld["region"],
                source=ld["source"], owner_id=manager.id, pool="private",
                created_at=_ts(ld["days"]),
                last_followup_at=_ts(ld["days"] - 2) if ld["days"] > 3 else None,
            ))

        # ─── 公共池线索 (4条，无 owner) ──────────────────────────────
        public_leads = [
            {"name": "西安高新区数据产业园", "region": "西北", "source": "organic", "days": 30},
            {"name": "长沙岳麓山软件基地", "region": "华中", "source": "koc_sem", "days": 25},
            {"name": "昆明滇池数字经济公司", "region": "西南", "source": "outbound", "days": 18},
            {"name": "沈阳铁西装备制造信息中心", "region": "东北", "source": "referral", "days": 22},
        ]

        public_lead_ids = []
        for ld in public_leads:
            lead_id = _id()
            public_lead_ids.append(lead_id)
            s.add(Lead(
                id=lead_id, company_name=ld["name"], region=ld["region"],
                source=ld["source"], owner_id=None, pool="public",
                created_at=_ts(ld["days"]),
            ))

        s.flush()

        # ─── 联系人 ──────────────────────────────────────────────────
        contacts_data = [
            # sales01 leads
            (sales_lead_ids[0], "张伟", "CTO", True, "13800001001", "zhangwei_tech"),
            (sales_lead_ids[0], "李娜", "采购经理", False, "13800001002", "lina_buy"),
            (sales_lead_ids[1], "王磊", "IT总监", True, "13800001003", "wanglei_it"),
            (sales_lead_ids[2], "陈静", "副总裁", True, "13800001004", "chenjing_vp"),
            (sales_lead_ids[2], "刘洋", "技术主管", False, "13800001005", "liuyang_dev"),
            (sales_lead_ids[3], "赵鹏", "运营总监", True, "13800001006", "zhaopeng_ops"),
            (sales_lead_ids[4], "孙悦", "产品总监", True, "13800001007", "sunyue_pm"),
            (sales_lead_ids[5], "周婷", "CIO", True, "13800001008", "zhouting_cio"),
            (sales_lead_ids[6], "吴强", "数据部主管", False, "13800001009", "wuqiang_data"),
            (sales_lead_ids[7], "郑楠", "供应链总监", True, "13800001010", "zhengnan_scm"),
            # manager01 leads
            (mgr_lead_ids[0], "黄志远", "董事长", True, "13900002001", "huangzy_ceo"),
            (mgr_lead_ids[0], "林晓峰", "总经理助理", False, "13900002002", "linxf_asst"),
            (mgr_lead_ids[1], "何建国", "数字化总监", True, "13900002003", "hejg_digital"),
            (mgr_lead_ids[2], "曹明", "智慧城市事业部总", True, "13900002004", "caoming_smart"),
            (mgr_lead_ids[3], "谢芳", "信息中心主任", True, "13900002005", "xiefang_it"),
            (mgr_lead_ids[4], "马超", "数字化转型办主任", True, "13900002006", "machao_dx"),
            # public pool leads
            (public_lead_ids[0], "钱学森", "园区管理处长", False, "13700003001", None),
            (public_lead_ids[1], "宋明", "基地运营部长", False, "13700003002", None),
        ]

        contact_ids = []
        for (lead_id, name, role, is_kp, phone, wechat) in contacts_data:
            cid = _id()
            contact_ids.append(cid)
            s.add(Contact(
                id=cid, lead_id=lead_id, name=name, role=role,
                is_key_decision_maker=is_kp, phone=phone, wechat_id=wechat,
            ))

        s.flush()

        # ─── 跟进记录 ────────────────────────────────────────────────
        followups_data = [
            # sales01 跟进
            (sales_lead_ids[0], sales.id, "phone", "首次电话沟通，了解客户IT架构现状，对方表示正在做数字化转型规划", 14),
            (sales_lead_ids[0], sales.id, "wechat", "微信发送了公司产品白皮书和案例集，客户表示会安排团队内部评审", 12),
            (sales_lead_ids[0], sales.id, "visit", "上门拜访CTO张伟，演示了产品Demo，对方对数据分析模块很感兴趣", 8),
            (sales_lead_ids[0], sales.id, "phone", "电话跟进Demo反馈，客户提出需要支持私有化部署，已反馈给产品团队", 5),
            (sales_lead_ids[1], sales.id, "phone", "初次接触，客户正在做年度IT预算规划，预计Q2会有采购需求", 11),
            (sales_lead_ids[1], sales.id, "wechat", "分享了行业解决方案，客户回复说会跟领导汇报", 7),
            (sales_lead_ids[2], sales.id, "visit", "拜访副总裁陈静，介绍公司背景和核心优势，获得初步认可", 9),
            (sales_lead_ids[2], sales.id, "phone", "电话确认下周安排技术团队对接，讨论集成方案", 6),
            (sales_lead_ids[2], sales.id, "wechat", "发送技术对接方案文档，等待客户技术团队审阅", 3),
            (sales_lead_ids[3], sales.id, "phone", "电话了解需求，客户需要供应链数字化解决方案", 7),
            (sales_lead_ids[3], sales.id, "visit", "现场调研客户仓储物流现状，拍照记录了现有流程", 4),
            (sales_lead_ids[4], sales.id, "phone", "电话沟通，客户已使用竞品产品，但合同即将到期", 5),
            (sales_lead_ids[4], sales.id, "wechat", "发送竞品对比分析报告，突出我们的差异化优势", 3),
            (sales_lead_ids[5], sales.id, "phone", "初次联系，客户CIO对AI赋能很感兴趣", 3),
            (sales_lead_ids[6], sales.id, "phone", "电话沟通需求，客户数据量大，需要大数据平台", 1),
            (sales_lead_ids[7], sales.id, "wechat", "微信加了供应链总监，初步介绍公司业务", 0),
            # manager01 跟进
            (mgr_lead_ids[0], manager.id, "visit", "拜访董事长黄志远，高层对接，讨论战略合作可能性", 18),
            (mgr_lead_ids[0], manager.id, "phone", "电话跟进合作框架协议细节", 14),
            (mgr_lead_ids[0], manager.id, "visit", "第二次上门，带技术专家一起讨论实施方案", 10),
            (mgr_lead_ids[0], manager.id, "wechat", "发送修改后的合作方案，等待董事会审批", 6),
            (mgr_lead_ids[1], manager.id, "phone", "电话沟通港务数字化需求，涉及码头智能调度", 12),
            (mgr_lead_ids[1], manager.id, "visit", "现场考察码头运营，了解业务痛点", 8),
            (mgr_lead_ids[2], manager.id, "phone", "与智慧城市事业部沟通政府项目对接流程", 7),
            (mgr_lead_ids[3], manager.id, "wechat", "发送医药行业数字化方案，客户转发给了内部评审组", 4),
            (mgr_lead_ids[4], manager.id, "phone", "初次联系，了解船舶制造业数字化转型诉求", 2),
        ]

        for (lead_id, owner_id, fu_type, content, days_ago) in followups_data:
            s.add(FollowUp(
                id=_id(), lead_id=lead_id, owner_id=owner_id,
                type=fu_type, content=content,
                followed_at=_ts(days_ago, hour=14),
            ))

        s.flush()

        # ─── 关键事件 ────────────────────────────────────────────────
        key_events_data = [
            (sales_lead_ids[0], sales.id, "visited_kp", {"kp_name": "张伟", "location": "客户办公室"}, 8),
            (sales_lead_ids[0], sales.id, "book_sent", {"book_title": "决胜B端", "recipient": "张伟"}, 7),
            (sales_lead_ids[2], sales.id, "visited_kp", {"kp_name": "陈静", "location": "上海总部"}, 9),
            (sales_lead_ids[2], sales.id, "attended_small_course", {"course_name": "B端产品实战营", "attendee": "刘洋"}, 4),
            (sales_lead_ids[4], sales.id, "book_sent", {"book_title": "决胜B端", "recipient": "孙悦"}, 3),
            (mgr_lead_ids[0], manager.id, "visited_kp", {"kp_name": "黄志远", "location": "集团总部"}, 18),
            (mgr_lead_ids[0], manager.id, "visited_kp", {"kp_name": "黄志远", "location": "集团总部"}, 10),
            (mgr_lead_ids[0], manager.id, "book_sent", {"book_title": "决胜B端", "recipient": "黄志远"}, 15),
            (mgr_lead_ids[1], manager.id, "visited_kp", {"kp_name": "何建国", "location": "天津港"}, 8),
        ]

        for (lead_id, user_id, ke_type, payload, days_ago) in key_events_data:
            s.add(KeyEvent(
                id=_id(), lead_id=lead_id, created_by=user_id,
                type=ke_type, payload=json.dumps(payload, ensure_ascii=False),
                occurred_at=_ts(days_ago, hour=15),
            ))

        s.flush()

        # ─── 已转化客户 (3条：2条 sales01, 1条 manager01) ────────────
        # 创建专门用于转化的线索
        converted_leads_data = [
            {"name": "苏州工业园区金蝶信息", "region": "华东", "source": "referral",
             "owner": sales.id, "days": 45},
            {"name": "南京紫金山实验室", "region": "华东", "source": "organic",
             "owner": sales.id, "days": 60},
            {"name": "青岛海尔卡奥斯平台", "region": "华北", "source": "koc_sem",
             "owner": manager.id, "days": 40},
        ]

        # Step 1: 先插入转化线索
        converted_pairs = []
        for cld in converted_leads_data:
            lead_id = _id()
            customer_id = _id()
            converted_pairs.append((lead_id, customer_id, cld))
            s.add(Lead(
                id=lead_id, company_name=cld["name"], region=cld["region"],
                source=cld["source"], owner_id=cld["owner"], pool="private",
                stage="converted", created_at=_ts(cld["days"]),
                converted_at=_ts(cld["days"] - 20),
            ))
        s.flush()

        # Step 2: 插入客户（依赖 Lead）
        for (lead_id, customer_id, cld) in converted_pairs:
            s.add(Customer(
                id=customer_id, lead_id=lead_id, company_name=cld["name"],
                region=cld["region"], owner_id=cld["owner"], source=cld["source"],
                created_at=_ts(cld["days"] - 20),
            ))
        s.flush()

        # Step 3: 客户联系人、跟进、关键事件（依赖 Customer）
        for (lead_id, customer_id, cld) in converted_pairs:
            s.add(Contact(
                id=_id(), customer_id=customer_id,
                name="客户联系人", role="项目经理", is_key_decision_maker=True,
                phone=f"1380000{cld['days']}",
            ))
            s.add(FollowUp(
                id=_id(), customer_id=customer_id, owner_id=cld["owner"],
                type="phone", content=f"客户回访，了解{cld['name']}使用情况，整体满意",
                followed_at=_ts(5, hour=10),
            ))
            s.add(KeyEvent(
                id=_id(), customer_id=customer_id, created_by=cld["owner"],
                type="purchased_big_course",
                payload=json.dumps({"course_name": "企业数字化转型大课", "amount": "29800"}, ensure_ascii=False),
                occurred_at=_ts(cld["days"] - 18, hour=16),
            ))

        s.flush()

        # ─── 流失线索 (2条) ──────────────────────────────────────────
        lost_leads_data = [
            {"name": "重庆两江新区数字产业公司", "region": "西南", "source": "outbound",
             "owner": sales.id, "days": 50},
            {"name": "哈尔滨工大智能装备", "region": "东北", "source": "organic",
             "owner": manager.id, "days": 35},
        ]

        for lld in lost_leads_data:
            lead_id = _id()
            s.add(Lead(
                id=lead_id, company_name=lld["name"], region=lld["region"],
                source=lld["source"], owner_id=lld["owner"], pool="private",
                stage="lost", created_at=_ts(lld["days"]),
                lost_at=_ts(lld["days"] - 15),
            ))

        s.flush()

        # ─── 日报 ────────────────────────────────────────────────────
        today = datetime.now(timezone.utc)
        for days_ago in range(7):
            report_date = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")

            # sales01 日报
            s.add(DailyReport(
                id=_id(), owner_id=sales.id, report_date=report_date,
                content=f"今日跟进线索 3 条，其中电话 2 通、微信 1 次。重点跟进北京数字颗粒和上海锐思达。"
                        f"数字颗粒反馈产品Demo效果不错，锐思达等待技术方案确认。"
                        f"明日计划：继续跟进深圳微链，准备拜访资料。",
                status="submitted" if days_ago > 0 else "draft",
                submitted_at=_ts(days_ago, hour=18) if days_ago > 0 else None,
            ))

            # manager01 日报（仅工作日）
            weekday = (today - timedelta(days=days_ago)).weekday()
            if weekday < 5:
                s.add(DailyReport(
                    id=_id(), owner_id=manager.id, report_date=report_date,
                    content=f"团队整体进展：本周新增线索 2 条，跟进线索 5 条。"
                            f"重点项目：华信恒通合作方案已提交董事会，天津港项目现场考察完成。"
                            f"关注事项：雄安项目需跟进政府审批进度。",
                    status="submitted" if days_ago > 0 else "draft",
                    submitted_at=_ts(days_ago, hour=19) if days_ago > 0 else None,
                ))

        s.flush()

        # ─── 通知 ────────────────────────────────────────────────────
        notifications_data = [
            (sales.id, "release", "线索即将释放提醒",
             "您的线索「天津智联云数据服务公司」已超过 8 天未跟进，还有 2 天将自动释放至公共池。", 1),
            (sales.id, "duplicate_warning", "疑似重复线索提醒",
             "您新建的线索「广州番禺智慧物流」与已有线索「广州番禺智能物流中心」相似度 87%，请确认。", 0),
            (sales.id, "conversion_window", "转化窗口期提醒",
             "客户「苏州工业园区金蝶信息」转化窗口期还剩 10 天，请尽快推进大课购买。", 2),
            (manager.id, "release", "团队线索释放预警",
             "团队成员 销售01 的线索「天津智联云」即将因未跟进而释放。", 1),
            (manager.id, "duplicate_warning", "疑似重复线索",
             "销售01 新建线索「广州番禺智慧物流」与现有线索相似，请队长确认。", 0),
            (admin.id, "release", "系统线索释放统计",
             "本周共有 3 条线索因超时未跟进被释放至公共池。", 2),
            (admin.id, "duplicate_warning", "重复线索审核",
             "检测到 2 组疑似重复线索，请管理员审核确认。", 1),
        ]

        for (user_id, ntype, title, content, days_ago) in notifications_data:
            s.add(Notification(
                id=_id(), user_id=user_id, type=ntype,
                title=title, content=content,
                is_read=days_ago > 1,
                created_at=_ts(days_ago, hour=9),
            ))

        s.commit()

        # Stats
        lead_count = len(s.exec(select(Lead)).all())
        customer_count = len(s.exec(select(Customer)).all())
        contact_count = len(s.exec(select(Contact)).all())
        followup_count = len(s.exec(select(FollowUp)).all())
        ke_count = len(s.exec(select(KeyEvent)).all())
        report_count = len(s.exec(select(DailyReport)).all())
        notif_count = len(s.exec(select(Notification)).all())

        print(f"Seed data created successfully!")
        print(f"  Leads:         {lead_count} (active: {len(sales_leads) + len(mgr_leads)}, public: {len(public_leads)}, converted: {len(converted_leads_data)}, lost: {len(lost_leads_data)})")
        print(f"  Customers:     {customer_count}")
        print(f"  Contacts:      {contact_count}")
        print(f"  Follow-ups:    {followup_count}")
        print(f"  Key Events:    {ke_count}")
        print(f"  Daily Reports: {report_count}")
        print(f"  Notifications: {notif_count}")


if __name__ == "__main__":
    seed()
