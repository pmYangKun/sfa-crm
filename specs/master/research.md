# Phase 0 研究报告

**项目**: SFA CRM | **日期**: 2026-03-31

---

## 研究问题 1：SQLModel 自引用递归模型（OrgNode 树）

### 决策
使用邻接表（adjacency list）+ `parent_id` 自引用 FK，与 ontology.md 设计一致。子树查询采用**内存遍历**方案。

### 关键实现要点

**模型定义**：SQLModel 自引用模型需要在 `relationship()` 中指定 `remote_side=[id]`，否则 SQLAlchemy 无法区分哪端是"父"。类型注解用 `Optional["OrgNode"]`（字符串前向引用）。

**子树查询策略**：OrgNode 表极小（200人团队约 20 个节点），在请求时一次性加载全表到内存，Python 侧构建 `{id: [children]}` 字典，递归遍历获取所有后代节点 ID，再拼成 `WHERE org_node_id IN (...)` 查询。无需 recursive CTE，简单可靠。

**SQLite 特殊注意**：
- FK 约束默认关闭，必须在每个连接上执行 `PRAGMA foreign_keys = ON`，否则 `parent_id` 引用违规会被静默忽略
- 循环引用（A→B→A）数据库层不检测，需在应用层校验

### 排除方案
- **Recursive CTE**：SQLite 3.8.3+ 支持，但对此项目规模过度复杂
- **嵌套集 / 闭包表**：写入复杂度高，不值得在演示项目引入

---

## 研究问题 2：SQLite WAL 模式 + FastAPI 并发写入

### 决策
启用 WAL 模式，对 ~10 用户的演示场景完全可接受。

### 推荐 PRAGMA 组合（在每个连接上执行）
```sql
PRAGMA journal_mode = WAL;      -- 读写不互相阻塞
PRAGMA foreign_keys = ON;       -- 强制 FK 约束
PRAGMA busy_timeout = 5000;     -- 写冲突时重试 5 秒，而非立即报错
PRAGMA synchronous = NORMAL;    -- WAL 模式下安全，性能优于 FULL
```

### 实现方式
通过 SQLAlchemy 的 `event.listens_for(engine, "connect")` 钩子，在每个新连接上自动执行以上 PRAGMA。同时在 `create_engine()` 中设置 `connect_args={"check_same_thread": False}`（FastAPI 多线程需要）。

### 局限性说明
WAL 解决了读写并发问题，但 SQLite 仍是单写锁——并发写请求会串行化。`busy_timeout=5000` 让 SQLite 在报错前重试 5 秒，足以覆盖演示场景的偶发并发写。10 用户场景下实际写冲突概率极低。

**切换 PostgreSQL 的时机**：50+ 并发活跃用户，或需要多实例部署。

---

## 研究问题 3：Vercel AI SDK + FastAPI 的 Tool Use 架构

### 决策
**Next.js API Route 负责 LLM 交互，FastAPI 负责工具执行**。两者通过 HTTP 通信。

### 架构流程
```
用户 → Next.js /api/chat
  → 从 FastAPI 读取当前 LLM 配置（provider/model/api_key）
  → 用 Vercel AI SDK 调用 LLM（streaming）
  → LLM 发出 tool_call
  → Next.js 调用 FastAPI 对应端点执行工具
  → 结果返回给 LLM
  → LLM 生成最终回复流式返回用户
```

### 关键设计点

**LLM 配置动态加载**：每次 chat 请求前从 FastAPI 读取 `LLMConfig`（当前激活的 provider/model/api_key），Vercel AI SDK 动态实例化对应 Provider。切换 LLM 只需 Admin 改配置，无需重启。

**对话历史存储**：消息历史存在 FastAPI 的 SQLite 里（`ConversationMessage` 表），按 `session_id` 分组。每次 `/api/chat` 请求时先从 FastAPI 读取历史，拼入 `messages` 数组后再调用 LLM。

**Tool 定义维护**：Tool Use 的 schema 定义（工具名称、描述、参数）维护在 Next.js 侧（因为要传给 Vercel AI SDK），工具的实际执行逻辑在 FastAPI 侧。两者通过固定的 HTTP 接口约定对应关系。

### 排除方案
- **全部走 FastAPI**：Python 端的 LLM 流式输出处理比 Next.js 复杂，且 Vercel AI SDK 的 streaming 集成是其核心优势，放弃可惜
- **全部走 Next.js**：业务逻辑和数据库访问应统一在 FastAPI，不应在前端直连数据库

---

## 研究问题 4：FastAPI 速率限制（内存方案）

### 决策
使用 **SlowAPI** 库（基于 `limits` 库），配合内存存储（`MemoryStorage`）。

### 实现要点
SlowAPI 是 FastAPI 的官方推荐速率限制库，装饰器语法简洁：

```python
@router.post("/leads/{id}/claim")
@limiter.limit("10/minute", key_func=get_current_user_id)
async def claim_lead(...)
```

`key_func` 按用户 ID 计数，而非 IP。超限返回 429，触发通知队长逻辑。

**注意**：`MemoryStorage` 是单进程内存存储，多进程部署时计数不共享。单 Docker 容器的演示部署完全没问题。

### 排除方案
- **Redis + 滑动窗口**：生产级方案，演示项目引入 Redis 增加部署复杂度，不值得
- **手动实现**：用 `dict` + `asyncio.Lock` 也可以，但 SlowAPI 已经做好了，无需重复造轮子

---

## 研究问题 5：中文公司名称模糊匹配

### 决策
使用 **rapidfuzz**（`fuzz.ratio` + `fuzz.partial_ratio`）+ 预处理去除法律后缀。

### 实现要点

**预处理**：比较前先去除常见法律后缀，避免"华为技术有限公司"与"华为股份有限公司"因后缀不同而相似度偏低：
```python
SUFFIXES = ["有限公司", "股份有限公司", "有限责任公司", "集团", "控股"]
```

**相似度计算**：
- `fuzz.ratio`：整体相似度，适合名称长度接近的情况
- `fuzz.partial_ratio`：子串匹配，适合全称与简称的对比（"华为技术有限公司" vs "华为"）
- 取两者最大值，超过阈值（推荐 **85**，可配置）则触发预警

**精确匹配优先**：有 `unified_code`（组织机构代码）时直接精确匹配，跳过模糊匹配。模糊匹配只在没有 `unified_code` 时作为兜底。

### 排除方案
- **jieba 分词 + 词向量**：中文语义匹配精度更高，但引入模型依赖，对演示项目过重
- **thefuzz**：rapidfuzz 的前身，rapidfuzz 用 C 扩展实现，速度快 10-100 倍，直接用新版即可

---

## 总结：所有 NEEDS CLARIFICATION 已解决

| 问题 | 决策 |
|------|------|
| OrgNode 树查询 | 内存遍历，全表加载（表极小） |
| SQLite 并发写 | WAL + busy_timeout=5000，10用户完全够用 |
| FK 约束 | 每个连接执行 `PRAGMA foreign_keys = ON` |
| LLM Tool Use 架构 | Next.js 调 LLM，FastAPI 执行工具，HTTP 通信 |
| LLM 动态切换 | 每次请求从 FastAPI 读取 LLMConfig |
| 对话历史存储 | FastAPI SQLite，ConversationMessage 表 |
| 速率限制 | SlowAPI + MemoryStorage，按用户 ID 计数 |
| 公司名模糊匹配 | rapidfuzz + 去后缀预处理，阈值 85（可配置） |
