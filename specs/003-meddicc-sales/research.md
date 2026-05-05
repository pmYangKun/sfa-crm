# Phase 0 Research: MEDDICC 销售视角

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Date**: 2026-05-05

本阶段集中决策 7 个技术问题，作为 Phase 1 设计的输入。所有 [NEEDS CLARIFICATION] 在此解决。

---

## Decision 1: MEDDICC 抽证据 LLM Prompt 设计

**Decision**: System prompt 含「角色 + 7 字段培训行业本地化定义 + JSON Schema 约束 + 1 个 few-shot 示例」共约 1200 字；User prompt 是序列化的 lead 上下文（每条记录显式带 `id` + `source_type` + 时间戳 + 内容）。LLM 输出严格 JSON，前端不解析 markdown。

**Rationale**:
- **DeepSeek-chat 在 JSON 输出稳定性偏弱**（spec 002 chat 链路实测有偶发"加上 ```json ``` 包裹"或"末尾添加自然语言说明"）→ system prompt 末尾必须重申"不要输出任何 JSON 之外的字符，包括 markdown fence"
- **few-shot 示例必须真实**：用一个 ~300 字模拟对话 + 对应 4-5 条 evidence 示例（覆盖 4-5 个维度）让 LLM 学会"从对话片段抽取 + 摘要 + 标 confidence"的全套动作
- **source_id 校验放在 LLM 输出后**（post-validate），不在 prompt 端约束——LLM 不擅长"严格记忆并复用上下文 id"，但通过后端校验跳过幻觉条目能 100% 防 FK 错误（沿用 spec 002 哲学）
- **维度枚举强约束**：prompt 里给出 7 个完整 dimension 字符串，输出端做 enum 校验跳过非法值

**Alternatives Considered**:
- **JSON Mode（DeepSeek 支持 `response_format={"type":"json_object"}`）**：会被采纳，但本 spec 不依赖此特性单独工作——以"prompt 强约束 + post-validate"为主，json mode 是叠加的安全网
- **Function Calling（让 LLM 调用 `add_evidence(...)` 函数批量加证据）**：增加复杂度，不如一次返回 JSON 数组直接 INSERT 简单
- **多次 LLM 调用（每个维度一次）**：成本 7 倍；且割裂了"同一句话可能贡献多维度证据"的能力

**关键 Prompt 草稿**（实施时落到 `init_db.py` 的 `analyze_meddicc_system_prompt` SystemConfig key）：

```
你是 MEDDICC 销售分析助手，为企业家培训公司服务。

【任务】
分析下面这条线索的全部上下文（对话 / 跟进 / 关键事件），按 MEDDICC 7 维度抽取证据。

【7 维度培训行业含义】
- metrics（量化指标）：客户希望培训改变的数字 — 业绩 / 团队留存 / 老板时间 / 人效
- economic_buyer（决策人）：能拍板付钱的人 — 绝大多数是老板 / 创始人，少数 VP/HR
- decision_criteria（决策标准）：客户怎么选培训公司 — 讲师品牌 / 朋友推荐 / 试听 / 同行案例 / 价格 / 课程体系
- decision_process（决策流程）：内部决策方式 — 老板独决 / 老板+配偶 / 老板+合伙人
- pain（痛点）：业绩下滑 / 团队留不住 / 自己累 / 转型焦虑 / 卡瓶颈
- champion（内部支持者）：常是配偶 / 合伙人 / HR；KP 不是 EB 时 KP 通常是
- competition（竞争）：其他培训公司（樊登 / 行动派 / 同行）+ 自己摸索 + "暂时不上"

【输出格式】
严格 JSON，无 markdown 包裹，无前后说明文字：
{
  "evidences": [
    {
      "dimension": "metrics|economic_buyer|decision_criteria|decision_process|pain|champion|competition",
      "source_type": "conversation|followup|key_event",
      "source_id": "<上下文里给的真实 id 字符串>",
      "evidence_text": "原文片段或摘要，≤200 字",
      "confidence": 0.0-1.0
    }
  ]
}

【强约束】
1. source_id 必须严格使用上下文给的真实 id，不要编造
2. 同一段对话可贡献多个维度的证据
3. 若某维度在所有上下文里完全无信号，不要强行抽
4. confidence 反映证据强弱：明确陈述 ≥0.85 / 暗示推断 0.6-0.8 / 弱关联 0.4-0.5 / <0.4 不输出
5. evidence_text 优先用原文片段，太长则浓缩摘要
6. 不要输出任何 JSON 之外的文字，包括 markdown fence

【few-shot 示例】
... (1 个完整 input → output 对，~400 字)
```

**输出后处理**：

```python
# 1. JSON 解析（失败 retry 1 次）
# 2. 遍历 evidences[]：
#    - dimension 不在枚举 → skip
#    - source_id 在 DB 不存在 → skip + 日志
#    - evidence_text > 200 字 → 截断
#    - confidence 越界 → clamp [0,1]
# 3. Replace 写入：DELETE WHERE lead_id, INSERT 全部
# 4. 重算 Lead.meddicc_score / completion / last_analyzed_at
```

---

## Decision 2: Replace 策略 vs Merge 策略

**Decision**: **Replace 策略**——每次 analyze 先 `DELETE FROM lead_meddicc_evidence WHERE lead_id = X`，再 INSERT 新一批。

**Rationale**:
- **简单**：单事务两步 SQL，无 dedup / version / 状态机考虑
- **语义清晰**：用户点"重新分析"的预期就是"重跑一次，结果替换旧的"
- **HITL 已去除**（spec 003 brainstorm 阶段定）→ 不需要"保留人工确认过的证据 + 替换 AI 自动证据"这种 merge 逻辑
- **Demo 数据 30 分钟重置**（spec 002）→ 历史时序在演示场景下意义有限
- **trade-off**：evidence.created_at 时间序列会"重置"，spec 004 趋势图无法直接从 evidence 表查"X 维度何时第一次亮"

**Alternatives Considered**:
- **Merge by source_id + dimension**：以 (lead_id, dimension, source_id) 为 dedup key，新 INSERT 不复，老的留——但 LLM 可能给同一 source 不同抽法（重新分析时 evidence_text 不一样），dedup 反而引发"哪个版本对"的矛盾
- **Versioned evidence**（一行一个 version_n）：增加 version 字段 + 每次 INSERT 新 version + 查询时取最大 version——架构复杂度上去了，但本 spec 用不到
- **不删旧的，只 append**：第二次 analyze 后 evidence 翻倍，第三次三倍——明显不可用

**spec 004 衔接方案**：spec 004 启动时引入 `lead_meddicc_history` 快照表（每次 analyze 写一行 snapshot：`lead_id / completion / score / dimensions_json / snapshot_at`），趋势图读这张表。spec 003 不实施 history，但 spec 004 实施时 backfill 一遍即可（对每个 lead 调一次 analyze，写一行 snapshot）。

---

## Decision 3: Score 算法选型

**Decision**: 三段式公式 — `完整度分(0-60) + 深度分(0-25) + 活跃度分(0-15) = 总分(0-100)`。

```python
def calculate_meddicc_score(evidences: list, last_activity_at: str | None) -> tuple[int, int]:
    """返回 (score, completion)"""
    completion = len({e.dimension for e in evidences})  # 0-7

    completeness_pts = (completion / 7) * 60            # 0-60
    depth_pts = min(len(evidences), 14) / 14 * 25       # 0-25, 14 条封顶
    activity_pts = _activity_pts(last_activity_at)      # 0-15

    score = round(completeness_pts + depth_pts + activity_pts)
    return score, completion


def _activity_pts(last_activity_at: str | None) -> float:
    if not last_activity_at:
        return 0
    delta_days = (now_utc() - parse_iso(last_activity_at)).days
    if delta_days <= 7:
        return 15
    elif delta_days <= 30:
        return 8
    else:
        return 0
```

**Rationale**:
- **完整度分权重最大（60%）**：MEDDICC 的核心价值是"7 个维度都覆盖"，部分覆盖（哪怕证据很多）也无法形成完整 deal 画像
- **深度分次之（25%）**：在完整度基础上奖励"每个维度证据更扎实"——从 7 条（每维度 1 条）到 14 条（每维度 2 条）有正向激励
- **活跃度分占小头（15%）**：deal 没活动 30+ 天意味着可能 stalled，但即便没新活动也不应让 score 归零（信息已沉淀）
- **公式简单可解释**：演示用户问"为啥这个 lead Score 78？"销售可以一句话说清——"6/7 维度亮 + 9 条证据 + 5 天前刚分析过"
- **14 条 / 7 天 / 30 天阈值**：来自 Gong 类产品的常见经验值，演示场景够用，spec 004 经理调参时再迁 SystemConfig

**Alternatives Considered**:
- **平均 confidence 加权**：把所有 evidence 的 confidence 平均也算入分数——但低 confidence 太多反而拖低 score 不直观；舍弃
- **维度权重不等**（如 EB 比 Metrics 更重要）：业务上确实存在权重差异，但增加配置复杂度且演示场景看不出区别；本 spec 等权
- **AI 自评分**（让 LLM 直接给一个 deal score）：黑盒、不可解释、不稳定——舍弃

---

## Decision 4: 场景卡数据结构与 5-7 张草稿大纲

**Decision**: 场景卡用 Python dict 字典存于 `app/services/scenario_cards.py`；每张卡含 `id / title / description / applies_to_lead_company / conversations[]`，每条 conversation 含 `recorded_at_offset_days / content`（content 是销售-客户多轮对话纯文本）。**不建第 3 张表**——卡的"是否已应用"动态查 conversation.scenario_card_id 计算。

```python
SCENARIO_CARDS = {
  "scenario_001_kp_first_visit": {
    "title": "拜访赵总（首次深聊）",
    "description": "演示 EB / Pain / D-Process 三个维度的证据抽取",
    "applies_to_lead_company": "深圳前海微链",
    "conversations": [
      {
        "recorded_at_offset_days": -3,
        "content": "（销售-客户对话剧本，约 800 字）"
      }
    ]
  },
  ...
}

def list_cards_for_lead(lead: Lead, db: Session) -> list[dict]:
    cards = []
    for cid, c in SCENARIO_CARDS.items():
        if c["applies_to_lead_company"] != lead.company_name:
            continue
        applied = db.query(...).filter(scenario_card_id==cid).count() > 0
        cards.append({**c, "id": cid, "applied": applied})
    return cards

def apply_card(card_id: str, lead: Lead, user_id: str, db: Session) -> dict:
    """批量插对话 + 触发 analyze + 返回新仪表盘"""
    ...
```

**Rationale**:
- **Python dict 比 JSON / YAML 更便利**：支持注释 + 引用 datetime / lead constants + 类型提示
- **不建表**：卡内容是"演示数据脚本"性质，跟代码绑定生命周期，不需要运行时管理；半小时重置只清 conversation 即可
- **applies_to_lead_company 字段（按公司名匹配，不是 lead_id）**：lead_id 在数据重置后会变化（UUID 重新生成），按公司名匹配能跨重置稳定

**5-7 张卡草稿大纲**（实施时写完整对话）：

| ID | 标题 | 绑定 demo lead | 主要覆盖维度 | 大致剧情 |
|---|---|---|---|---|
| `scenario_001_kp_first_visit` | 拜访赵总（首次深聊） | 深圳前海微链 | E / I / D-Process | 销售去客户公司，赵总（创始人）讲业绩压力 + 自己拍板 + 想跟老婆商量再定 |
| `scenario_002_champion_emerges` | Champion 涌现 | 深圳前海微链 | C-Champion / D-Process | 销售跟赵总太太聊天，太太主动表态支持 + 帮忙说服丈夫 |
| `scenario_003_competition_revealed` | 竞品被揭 | 深圳前海微链 | C-Competition / D-Criteria | 销售追问，发现客户也在看樊登 + 行动派 + 觉得自己的讲师品牌不够大 |
| `scenario_004_metrics_quantified` | 痛点量化 | 北京数字颗粒科技 | M / I | 客户讲具体数字 — 月业绩 200 万，团队 30% 流失 + 转型焦虑 |
| `scenario_005_partner_decision` | 合伙人介入 | 北京数字颗粒科技 | D-Process / C-Champion / E | 客户讲："我合伙人也要参与决定，他更看重 ROI" → 销售识别合伙人是新 stakeholder |
| `scenario_006_book_referral_drive` | 推荐人来源 | 北京数字颗粒科技 | D-Criteria / C-Champion | 客户提"老李推荐你们" → 销售识别老李是 Champion，要继续维护 |
| `scenario_007_self_help_competition` | 自学派对手 | （任意空 lead 也可启用） | C-Competition / I | 客户："我先自己看视频学一下" → 销售识别"自己摸索"是隐性 competition |

**Alternatives Considered**:
- **场景卡建独立表**（`scenario_card` 表 + `scenario_card_conversation` 关联表）：管理生命周期复杂、与代码绑定不强、半小时重置要小心
- **场景卡内容存 SystemConfig**：系统配置应该是用户 / 运维改的，剧本是开发改的——不该走配置
- **场景卡走 init_db 种子**（每次重置自动创建）：与"卡可被随时应用"语义冲突——需要单独表跟踪"已应用"状态

---

## Decision 5: 仪表盘动画的纯前端实现

**Decision**: 圆点延迟出现用 `setTimeout(setIsLit, i * 100)` 在 React state 里逐个翻 `lit[i]`；Score 数字补间用纯 JS 实现 `requestAnimationFrame` + 线性 ease 函数。**不引入第三方动画库**。

**Rationale**:
- **演示效果灵魂只需基本动画**——圆点错时亮 + 数字递增到目标值，库级动画引擎（framer-motion / react-spring）杀鸡用牛刀
- **纯 React + setTimeout 足够**：组件 mount 时启动定时器；卸载时 clearTimeout 防泄漏
- **后端不参与时序**：API 一次返回全部 7 维度状态 + 新 score，前端动画只是把"视觉刷新"分散在 1-2 秒内播放
- **Tween 用线性 ease**：从老 score 到新 score，每帧 `current = old + (new - old) * progress`，progress 0→1 走 800ms——简单且观感够

**关键代码骨架**（实施时落到 `MeddiccDashboardTab.tsx`）：

```typescript
// 圆点延迟亮起
useEffect(() => {
  if (!shouldAnimate) return;
  const timers = dimensions.map((_, i) =>
    setTimeout(() => setLit(prev => ({...prev, [i]: true})), i * 100)
  );
  return () => timers.forEach(clearTimeout);
}, [shouldAnimate]);

// Score 数字补间
useEffect(() => {
  if (oldScore === newScore) return;
  let raf: number;
  const startedAt = performance.now();
  const duration = 800;
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    setDisplayedScore(Math.round(oldScore + (newScore - oldScore) * progress));
    if (progress < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [newScore]);
```

**Alternatives Considered**:
- **framer-motion / react-spring**：体验更流畅但引入 30-50 KB 依赖，本 spec 用不到这个量级的动画 → deferred
- **CSS `@keyframes` + transition delay**：可行但 React 状态联动写起来更绕，且数字补间还是要 JS
- **后端推送动画时序**（WebSocket / SSE）：完全过度设计，演示动画用不到

---

## Decision 6: FK 校验 LLM 幻觉的实现路径

**Decision**: **post-validate**——LLM 输出后，遍历 evidences 数组，每条用 `db.get(SourceTableModel, source_id)` 检查是否存在；不存在的 skip + 写日志，不抛异常。

**Rationale**:
- **post-validate 比 pre-validate 简单**：pre-validate 要在 prompt 里告诉 LLM "你只能用以下 N 个 id"，长 prompt 风险（幻觉率不降反升）+ context 长度浪费
- **沿用 spec 002 哲学**：spec 002 的 `followups` POST 端点已在做"AI 给的 lead_id DB 不存在 → 404 不再让 SQLite FK 爆 500"
- **跳过而非报错**：LLM 偶尔幻觉 1-2 个 id 是常态，全请求失败代价过高；跳过 + 日志让运维能事后审视抽证据质量
- **日志统计辅助 SC-003**：30 天累计跳过率应 < 5%（spec.md SC-003）

**实现伪代码**：

```python
SOURCE_TABLE_MAP = {
    "conversation": Conversation,
    "followup": FollowUp,
    "key_event": KeyEvent,
}

def validate_evidence(ev: dict, db: Session) -> bool:
    Model = SOURCE_TABLE_MAP.get(ev["source_type"])
    if not Model:
        log.warning(f"unknown source_type: {ev['source_type']}, skip")
        return False
    if not db.get(Model, ev["source_id"]):
        log.warning(f"hallucinated source_id: {ev['source_type']}/{ev['source_id']}, skip")
        return False
    if ev["dimension"] not in DIMENSIONS:
        log.warning(f"unknown dimension: {ev['dimension']}, skip")
        return False
    return True
```

**Alternatives Considered**:
- **pre-validate（在 prompt 里 enumerate 所有 id）**：长 prompt 风险高，且 LLM 拼接 id 时幻觉率反而升高
- **失败抛异常 → 整批丢弃**：用户体验差（点了"分析"提示"AI 不靠谱失败"），但单个 id 幻觉是常态不是异常
- **数据库 FK 约束 + on conflict ignore**：SQLite FK 默认开（spec 002 已开），但靠 FK 报错处理逻辑会阻断 INSERT 流，且 SQLite FK 错误堆栈难看，不优雅

---

## Decision 7: 限流接入方式

**Decision**: 在新增的 `/leads/{id}/meddicc/analyze` 与 `/leads/{id}/scenario-cards/{card_id}/apply` 两个端点上**直接套 spec 002 既有的 SlowAPI 装饰器** + **复用 spec 002 的 LLM 全局熔断 service**（`llm_circuit_breaker.check_and_increment()`）。

**Rationale**:
- **零新基础设施**：spec 002 已建好限流 + 熔断 + chat_audit 全套
- **限流参数沿用 spec 002 的 SystemConfig key**（`llm_user_minute_limit / llm_user_daily_limit / llm_global_hourly_limit`）——不改阈值
- **chat_audit 沿用**：analyze 端点纳入 `prompt` 字段记录"系统调用 LLM 抽证据 lead_id=X"（不是用户原话），便于事后审计
- **scenario_cards/{id}/apply 视为 LLM 调用**（因为 apply 触发了 analyze）：纳入限流 + 熔断；客户端连点也无法绕过

**实现示意**（在 `api/meddicc.py`）：

```python
from app.services.rate_limiter import limiter
from app.services.llm_circuit_breaker import check_and_increment as check_llm
from app.services.chat_audit_writer import write_chat_audit

@router.post("/leads/{lead_id}/meddicc/analyze")
@limiter.limit("10/minute;100/day")  # 与 spec 002 chat 端点同 key
def analyze_endpoint(lead_id: str, request: Request, ...):
    if not check_llm(db):
        raise HTTPException(503, "演示站当前调用量较高，请稍后再试")
    # 调 meddicc_extractor.analyze() ...
    write_chat_audit(...)  # 用户/IP/输入摘要/是否成功
    return new_dashboard_data
```

**Alternatives Considered**:
- **不接入限流**：违反 spec.md FR-020；单访客可无限刷场景卡 + 重新分析 = 账单爆
- **单独定义新阈值**（如 5/min for analyze）：增加配置复杂度；spec 002 的 10/min 已是合理上限
- **所有 8 个端点都套限流**：GET / DELETE 不调 LLM，套限流误伤；只对 POST analyze + apply 套即可

---

## 跨决策的整体技术路径

7 个决策的合并影响：

1. **Phase 1 data-model.md 写**：2 张新表（conversation / lead_meddicc_evidence）+ Lead 加 3 列 + 不需要 history 表
2. **Phase 1 contracts/api-contracts.md 写**：8 个 REST 端点 + 1 个 chat tool（analyze_meddicc）
3. **Phase 1 quickstart.md 写**：人工验收 5-6 步路径（登录 → 进 lead → 看仪表盘亮 → 点场景卡 → 看动画 → chat 验证）
4. **Phase 2 tasks.md 拆分预告**：约 30-40 个 task，按"setup → foundational → US1 → US2 → US3 → US4 → polish"分组（沿用 spec 002 风格）

**待 Phase 2 解决的问题**（不在 research 范围）：
- 具体 task 数量与依赖图
- pytest fixture 复用策略
- Playwright 测试用例编排
- 场景卡剧本的具体话术（实施时由 Claude 写草稿 + stakeholder 审）

---

## research.md 完成状态

✅ 7 个关键技术决策全部 Resolved
✅ 0 个 [NEEDS CLARIFICATION]
✅ 与 plan.md Constitution Check 一致
✅ 与 spec.md 37 FR 全部对位

**下一步**：进入 Phase 1 设计，生成 `data-model.md` + `contracts/api-contracts.md` + `quickstart.md`。
