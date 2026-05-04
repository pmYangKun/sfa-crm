# Contract: 角色快速切换（最终采纳：纯前端方案，本契约保留为备选）

**Feature**: `001-login-mobile-onboarding`
**Status**: 备选（不实施）
**Decision**: 见 `research.md` Decision 4 — 采用**纯前端方案**（依次调既有 `logout` + `login`），**不新增**后端端点。

---

## 为什么仍保留本契约文档

1. 留作备查：如果未来有"切换不要走前端硬编码密码"的需求，这是已经设计好的后端形态
2. 让 spec-kit 评审者知道"该路径已被评估并显式否决"
3. 公网上线发版（下一发版）若要去掉前端硬编码密码，可立即采用本契约

---

## 备选契约（不实施）

### `POST /api/auth/quick-switch`

**Request**:

```json
{
  "target_login_name": "manager01"
}
```

**Headers**:
- `Authorization: Bearer <current_user_token>`

**Response 200**:

```json
{
  "access_token": "<new_token>",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "login_name": "manager01",
    "display_name": "陈队长",
    "role": "manager"
  }
}
```

**Response 403**: 当前 token 不是已登录的 demo 账号 / target_login_name 不在 demo 白名单中

**业务规则**：
- 仅允许 demo 账号集合内互切（`{sales01, manager01}` 等）
- 不需要密码（前提：当前已是有效 demo 会话）
- 旧 token 立即失效
- 一次往返替代前端 "logout + login" 两次往返，性能更好

---

## 实施侧仍走纯前端方案

详细实现见 `contracts/ui-contracts.md` § 12 `<AuthContext>` 的 `quickSwitchRole` 方法。
