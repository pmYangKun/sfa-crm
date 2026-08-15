"""SQLite database connection with WAL mode and PRAGMA configuration."""

import os
from contextlib import contextmanager

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/sfa_crm.db")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def set_sqlite_pragmas(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA busy_timeout = 5000")
    cursor.execute("PRAGMA synchronous = NORMAL")
    cursor.close()


def get_session():
    with Session(engine) as session:
        yield session


@contextmanager
def get_session_context():
    """非依赖注入场景下的 session（如 ASGI 中间件、MCP 工具执行）。

    spec 005：MCP 工具函数由 SDK 直接调用，不在 FastAPI 依赖链上，
    拿不到 Depends(get_session)，因此需要这个显式的上下文管理器。
    """
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
