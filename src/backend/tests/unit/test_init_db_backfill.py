"""Unit test for spec 002 二轮 — init_db 幂等补 missing SystemConfig key.

场景：spec 001 部署的 DB 升级到 spec 002 代码时，init_db 因为检测到已初始化
直接 short-circuit → spec 002 新增的 6 个 SystemConfig key 永远不会被注入 →
限流/熔断/重置功能用 None 回退到代码硬编默认。

期望：init_db 应该总是检查 DEFAULT_CONFIGS 中有哪些 key 在 DB 里缺失，幂等
INSERT 缺失的 key（不覆盖已存在的，避免运维手改的值被冲掉）。
"""

import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select


@pytest.fixture
def engine_with_old_db():
    """模拟 spec 001 部署后的 DB：表存在，permission 已 seed，但 spec 002 的
    SystemConfig key 全都没注入。"""
    # import init_db 触发所有 noqa F401 model 注册到 metadata
    from app.core import init_db as _init_db_module  # noqa: F401

    eng = create_engine("sqlite://", connect_args={"check_same_thread": False})

    @event.listens_for(eng, "connect")
    def set_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    SQLModel.metadata.create_all(eng)

    from app.models.auth import Permission
    from app.models.config import SystemConfig

    with Session(eng) as s:
        # 模拟"已初始化"：写一行 permission
        s.add(Permission(id="p1", code="lead.view", module="lead", name="查看线索"))
        # 写一些"老 SystemConfig"（spec 001 时期就有）
        s.add(SystemConfig(key="private_pool_limit", value="100", description="..."))
        s.add(SystemConfig(key="agent_system_prompt", value="OLD_PROMPT_DO_NOT_OVERWRITE", description="..."))
        s.commit()
    return eng


def test_init_db_backfills_missing_spec002_keys(engine_with_old_db, monkeypatch):
    """init_db 在已初始化的 DB 上跑，应该补齐 DEFAULT_CONFIGS 里所有缺失的 key。"""
    from app.core import init_db as init_db_module
    from app.models.config import SystemConfig

    # 关键：让 init_db 用我们的 mock engine
    monkeypatch.setattr(init_db_module, "engine", engine_with_old_db)
    monkeypatch.setattr(init_db_module, "create_db_and_tables", lambda: None)

    init_db_module.init_db()

    spec002_keys = [
        "llm_user_minute_limit",
        "llm_user_daily_limit",
        "llm_global_hourly_limit",
        "demo_reset_enabled",
        "demo_reset_interval_minutes",
        "prompt_guard_keywords",
    ]

    with Session(engine_with_old_db) as s:
        for key in spec002_keys:
            cfg = s.get(SystemConfig, key)
            assert cfg is not None, f"spec 002 key '{key}' 未被补齐"
            assert cfg.value, f"key '{key}' value 为空"


def test_init_db_does_not_overwrite_existing_keys(engine_with_old_db, monkeypatch):
    """init_db 补齐时，不能覆盖已被运维手改的 SystemConfig 值。"""
    from app.core import init_db as init_db_module
    from app.models.config import SystemConfig

    monkeypatch.setattr(init_db_module, "engine", engine_with_old_db)
    monkeypatch.setattr(init_db_module, "create_db_and_tables", lambda: None)

    init_db_module.init_db()

    with Session(engine_with_old_db) as s:
        # 老的 agent_system_prompt 不能被冲掉
        cfg = s.get(SystemConfig, "agent_system_prompt")
        assert cfg.value == "OLD_PROMPT_DO_NOT_OVERWRITE", \
            "init_db 不应覆盖运维手改的 SystemConfig 值"


def test_init_db_idempotent_on_repeat_call(engine_with_old_db, monkeypatch):
    """init_db 跑两次后，每个 key 只有一行（不重复 INSERT）。"""
    from app.core import init_db as init_db_module
    from app.models.config import SystemConfig

    monkeypatch.setattr(init_db_module, "engine", engine_with_old_db)
    monkeypatch.setattr(init_db_module, "create_db_and_tables", lambda: None)

    init_db_module.init_db()
    init_db_module.init_db()  # 第二次

    with Session(engine_with_old_db) as s:
        rows = s.exec(
            select(SystemConfig).where(SystemConfig.key == "demo_reset_enabled")
        ).all()
        assert len(rows) == 1, f"key 'demo_reset_enabled' 应只有 1 行，实际 {len(rows)}"
