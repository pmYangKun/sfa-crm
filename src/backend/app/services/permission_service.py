"""DataScope filtering — OrgNode in-memory tree + visible user IDs."""

import json
from collections import defaultdict

from sqlmodel import Session, select

from app.models.auth import UserDataScope
from app.models.org import OrgNode, User


def _build_children_map(session: Session) -> dict[str | None, list[str]]:
    """Load all OrgNodes and build {parent_id: [child_ids]} map."""
    nodes = session.exec(select(OrgNode)).all()
    children: dict[str | None, list[str]] = defaultdict(list)
    for node in nodes:
        children[node.parent_id].append(node.id)
    return children


def get_subtree_node_ids(session: Session, node_id: str) -> list[str]:
    """Return node_id and all descendant node IDs."""
    children_map = _build_children_map(session)
    result = []
    stack = [node_id]
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(children_map.get(current, []))
    return result


def get_visible_user_ids(session: Session, current_user: User) -> list[str] | None:
    """Return list of user IDs visible to current_user based on DataScope.
    Returns None if scope is 'all' (no filtering needed)."""
    scope_record = session.exec(
        select(UserDataScope).where(UserDataScope.user_id == current_user.id)
    ).first()

    if scope_record is None:
        # No scope configured — default to self_only
        return [current_user.id]

    scope = scope_record.scope

    if scope == "all":
        return None  # No filtering

    if scope == "self_only":
        return [current_user.id]

    if scope == "current_node":
        # All users in the same org node
        users = session.exec(
            select(User.id).where(
                User.org_node_id == current_user.org_node_id,
                User.is_active == True,  # noqa: E712
            )
        ).all()
        return list(users)

    if scope == "current_and_below":
        node_ids = get_subtree_node_ids(session, current_user.org_node_id)
        users = session.exec(
            select(User.id).where(
                User.org_node_id.in_(node_ids),
                User.is_active == True,  # noqa: E712
            )
        ).all()
        return list(users)

    if scope == "selected_nodes":
        node_ids = json.loads(scope_record.node_ids or "[]")
        users = session.exec(
            select(User.id).where(
                User.org_node_id.in_(node_ids),
                User.is_active == True,  # noqa: E712
            )
        ).all()
        return list(users)

    return [current_user.id]
