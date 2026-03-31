import json
from collections import defaultdict

from sqlmodel import Session, select

from app.models.auth import UserDataScope
from app.models.org import OrgNode, User


def get_user_data_scope(session: Session, user_id: str) -> UserDataScope | None:
    return session.exec(
        select(UserDataScope).where(UserDataScope.user_id == user_id)
    ).first()


def get_visible_user_ids(session: Session, user: User) -> list[str]:
    """Return list of user IDs whose data the given user can see."""
    scope_record = get_user_data_scope(session, user.id)
    if not scope_record:
        return [user.id]  # fallback: self only

    scope = scope_record.scope

    if scope == "all":
        return session.exec(select(User.id).where(User.is_active == True)).all()  # noqa: E712

    if scope == "self_only":
        return [user.id]

    if scope == "current_node":
        return session.exec(
            select(User.id).where(User.org_node_id == user.org_node_id, User.is_active == True)  # noqa: E712
        ).all()

    if scope in ("current_and_below", "selected_nodes"):
        all_nodes = session.exec(select(OrgNode)).all()
        node_map = defaultdict(list)
        for node in all_nodes:
            if node.parent_id:
                node_map[node.parent_id].append(node.id)

        if scope == "current_and_below":
            root_ids = [user.org_node_id]
        else:
            raw = scope_record.node_ids or "[]"
            root_ids = json.loads(raw)

        visible_node_ids = _collect_subtree(root_ids, node_map)
        return session.exec(
            select(User.id).where(User.org_node_id.in_(visible_node_ids), User.is_active == True)  # noqa: E712
        ).all()

    return [user.id]


def _collect_subtree(root_ids: list[str], node_map: dict[str, list[str]]) -> set[str]:
    """BFS to collect all descendant node IDs including roots."""
    visited = set(root_ids)
    queue = list(root_ids)
    while queue:
        current = queue.pop()
        for child_id in node_map.get(current, []):
            if child_id not in visited:
                visited.add(child_id)
                queue.append(child_id)
    return visited
