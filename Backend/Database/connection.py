"""
Database Connection — SecureTrail
Async SQLAlchemy 2.0 engine with connection pooling tuned for EC2 same-instance use.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from Utils.logger import get_logger

logger = get_logger("database.connection")

# ── DSN ───────────────────────────────────────────────────────────────────────
# asyncpg driver (fully async — never blocks the event loop)
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://securetrail:securetrail_db_pass@localhost:5432/securetrail",
)

# ── Engine configuration ──────────────────────────────────────────────────────
# pool_size + max_overflow: sized for a single EC2 instance with ~20 concurrent req.
# pool_pre_ping: validates connections before use (survives PostgreSQL restarts).
# command_timeout: prevents runaway queries from hanging the API.
_ENGINE_KWARGS = {
    "echo":               os.getenv("DB_ECHO", "false").lower() == "true",
    "pool_size":          int(os.getenv("DB_POOL_SIZE", "10")),
    "max_overflow":       int(os.getenv("DB_MAX_OVERFLOW", "20")),
    "pool_timeout":       int(os.getenv("DB_POOL_TIMEOUT", "30")),
    "pool_recycle":       int(os.getenv("DB_POOL_RECYCLE", "1800")),  # 30 min
    "pool_pre_ping":      True,
    "connect_args":       {
        "command_timeout":    int(os.getenv("DB_COMMAND_TIMEOUT", "30")),
        "server_settings":    {
            "application_name": "securetrail_api",
            "jit":              "off",   # off for OLTP workloads
        },
    },
}

# Lazy singletons — created on first use via init_db()
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("Database not initialised. Call init_db() first.")
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        raise RuntimeError("Database not initialised. Call init_db() first.")
    return _session_factory


async def init_db() -> None:
    """
    Create the engine and session factory, then run any pending Alembic migrations.
    Call once at application startup (FastAPI lifespan / on_event).

    On a brand-new system this will create all tables automatically via
    `alembic upgrade head` — no manual setup required.
    """
    global _engine, _session_factory

    if _engine is not None:
        return  # already initialised

    logger.info("Initialising database connection pool…")
    _engine = create_async_engine(DATABASE_URL, **_ENGINE_KWARGS)
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )

    # Verify connectivity
    from sqlalchemy import text
    async with _engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("Database connection pool ready")

    # Auto-run migrations so a fresh deployment needs zero manual setup.
    # Uses a thread pool executor because Alembic's engine is synchronous.
    await _run_migrations()


async def _run_migrations() -> None:
    """Run `alembic upgrade head` in a thread so it doesn't block the event loop."""
    import asyncio
    from pathlib import Path

    alembic_cfg_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    if not alembic_cfg_path.exists():
        logger.warning("alembic.ini not found — skipping auto-migration")
        return

    def _upgrade() -> None:
        from alembic import command
        from alembic.config import Config

        cfg = Config(str(alembic_cfg_path))
        # Ensure the sync psycopg2 URL is used for Alembic (not asyncpg)
        sync_url = DATABASE_URL.replace(
            "postgresql+asyncpg://", "postgresql+psycopg2://"
        )
        cfg.set_main_option("sqlalchemy.url", sync_url)
        command.upgrade(cfg, "head")

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _upgrade)
        logger.info("Database schema is up to date")
    except Exception as exc:
        # Log but don't crash the server — DB may already be current
        logger.error("Alembic migration failed: %s", exc)


async def check_db_connection() -> bool:
    """
    Ping the database.
    Returns True if reachable, False on any error.
    Used by the /health endpoint.
    """
    try:
        from sqlalchemy import text
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("Database health check failed: %s", exc)
        return False


async def close_db() -> None:
    """Dispose the connection pool. Call at application shutdown."""
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("Database connection pool closed")


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager that yields a session and handles commit/rollback.

    Usage:
        async with get_session() as session:
            await session.execute(...)

    Automatically commits on success and rolls back on exception.
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency — inject a session into route handlers.

    Usage:
        async def my_route(db: AsyncSession = Depends(get_db_session)):
    """
    async with get_session() as session:
        yield session


# Alias for convenience
get_db = get_db_session
