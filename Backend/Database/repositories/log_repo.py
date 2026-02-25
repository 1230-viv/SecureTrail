"""
Log Repository — SecureTrail
Fire-and-forget structured log writes for the scan pipeline.
All functions are designed for high-frequency, non-blocking use.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from Database.models import ScanLog
from Utils.logger import get_logger

logger = get_logger("database.log_repo")


async def insert_log(
    db: AsyncSession,
    job_id: str | uuid.UUID,
    level: str,
    message: str,
    logger_name: str | None = None,
) -> None:
    """
    Append a single log line for a scan job.
    Caller is responsible for committing (or this runs inside get_session context).
    """
    entry = ScanLog(
        job_id=uuid.UUID(str(job_id)),
        level=level.upper()[:16],
        logger_name=(logger_name or "")[:255],
        message=message,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.flush()


async def insert_logs_bulk(
    db: AsyncSession,
    job_id: str | uuid.UUID,
    entries: list[dict],
) -> int:
    """
    Bulk insert pre-formatted log dicts.

    Each dict must contain: level (str), message (str)
    Optionally: logger_name (str)

    Returns count of rows inserted.
    """
    if not entries:
        return 0

    jid = uuid.UUID(str(job_id))
    now = datetime.now(timezone.utc)
    rows = [
        ScanLog(
            job_id=jid,
            level=e.get("level", "INFO").upper()[:16],
            logger_name=(e.get("logger_name") or "")[:255],
            message=e.get("message", ""),
            created_at=now,
        )
        for e in entries
    ]
    db.add_all(rows)
    await db.flush()
    return len(rows)


async def get_logs_for_job(
    db: AsyncSession,
    job_id: str | uuid.UUID,
    *,
    level: str | None = None,
    limit: int = 500,
    offset: int = 0,
) -> Sequence[ScanLog]:
    """
    Retrieve log lines for a job, oldest-first.

    Pass level (e.g. "ERROR") to filter by severity.
    """
    stmt = (
        select(ScanLog)
        .where(ScanLog.job_id == uuid.UUID(str(job_id)))
        .order_by(ScanLog.id)
        .limit(limit)
        .offset(offset)
    )
    if level:
        stmt = stmt.where(ScanLog.level == level.upper())

    result = await db.execute(stmt)
    return result.scalars().all()


def fire_and_forget_log(
    session_factory,
    job_id: str | uuid.UUID,
    level: str,
    message: str,
    logger_name: str | None = None,
) -> None:
    """
    Schedule a log write as a background asyncio task.
    Safe to call from synchronous pipeline code that has an event loop running.

    session_factory — async_sessionmaker instance from connection.get_session_factory()
    """
    async def _write() -> None:
        try:
            async with session_factory() as db:
                await insert_log(db, job_id, level, message, logger_name)
                await db.commit()
        except Exception as exc:  # never crash the caller
            logger.debug("fire_and_forget_log failed: %s", exc)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_write())
    except RuntimeError:
        # No event loop — skip silently (e.g. test context)
        pass
