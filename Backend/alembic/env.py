from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Load .env so DATABASE_URL is always available ─────────────────────────────
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Make sure `Backend/` is importable when Alembic runs from that directory
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Import ORM Base so Alembic can diff the schema
from Database.models import Base  # noqa: E402

config = context.config

# ── Force Alembic to use the DATABASE_URL from .env ──────────────────────────
# Alembic requires a *synchronous* driver (psycopg2), but .env stores the
# async URL (asyncpg).  Convert on the fly so one source of truth is enough.
DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL:
    # asyncpg → psycopg2 for Alembic's synchronous engine
    sync_url = DATABASE_URL.replace("+asyncpg", "+psycopg2")
    # Escape '%' for configparser interpolation (% → %%)
    config.set_main_option("sqlalchemy.url", sync_url.replace("%", "%%"))

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting to the DB."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
