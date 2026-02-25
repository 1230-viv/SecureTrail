"""
Scan Repository — SecureTrail
CRUD operations for ScanJob and VulnerabilityRecord tables.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Sequence

from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from Database.models import ScanJob, VulnerabilityRecord
from Utils.logger import get_logger

logger = get_logger("database.scan_repo")


# ── ScanJob ───────────────────────────────────────────────────────────────────

async def create_scan_job(
    db: AsyncSession,
    *,
    job_id: str | uuid.UUID,
    repository_name: str,
    source_type: str,
    repo_full_name: str | None = None,
    branch: str | None = None,
    user_id: uuid.UUID | None = None,
) -> ScanJob:
    """Persist a new scan job with status=queued."""
    job = ScanJob(
        id=uuid.UUID(str(job_id)),
        user_id=user_id,
        repository_name=repository_name,
        source_type=source_type,
        repo_full_name=repo_full_name,
        branch=branch,
        status="queued",
        progress=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(job)
    await db.flush()   # assign PK without committing outer transaction
    logger.debug("Created ScanJob id=%s repo=%r", job.id, repository_name)
    return job


async def update_scan_job(
    db: AsyncSession,
    job_id: str | uuid.UUID,
    **fields: Any,
) -> None:
    """
    Partial update of a ScanJob row.

    Accepted fields (subset):
        status, progress, stage, error_message,
        total_vulnerabilities, critical_count, high_count, medium_count,
        low_count, info_count, result_json, completed_at
    """
    _ALLOWED = {
        "status", "progress", "stage", "error_message",
        "total_vulnerabilities", "critical_count", "high_count",
        "medium_count", "low_count", "info_count",
        "result_json", "completed_at",
    }
    safe = {k: v for k, v in fields.items() if k in _ALLOWED}
    if not safe:
        return

    safe["updated_at"] = datetime.now(timezone.utc)

    await db.execute(
        update(ScanJob)
        .where(ScanJob.id == uuid.UUID(str(job_id)))
        .values(**safe)
    )


async def get_scan_job(db: AsyncSession, job_id: str | uuid.UUID) -> ScanJob | None:
    """Fetch a single ScanJob by id, or None if not found."""
    result = await db.execute(
        select(ScanJob).where(ScanJob.id == uuid.UUID(str(job_id)))
    )
    return result.scalar_one_or_none()


async def list_scan_jobs(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> Sequence[ScanJob]:
    """
    List recent scan jobs, newest first.
    If user_id is provided, filters to that user only.
    """
    stmt = select(ScanJob).order_by(desc(ScanJob.created_at)).limit(limit).offset(offset)
    if user_id is not None:
        stmt = stmt.where(ScanJob.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalars().all()


async def mark_job_completed(
    db: AsyncSession,
    job_id: str | uuid.UUID,
    result_json: dict,
    counts: dict[str, int],
) -> None:
    """Convenience wrapper: stamp the job as completed with final counts."""
    now = datetime.now(timezone.utc)
    await update_scan_job(
        db,
        job_id,
        status="completed",
        progress=100,
        result_json=result_json,
        completed_at=now,
        total_vulnerabilities=counts.get("total", 0),
        critical_count=counts.get("critical", 0),
        high_count=counts.get("high", 0),
        medium_count=counts.get("medium", 0),
        low_count=counts.get("low", 0),
        info_count=counts.get("info", 0),
    )


async def mark_job_failed(
    db: AsyncSession,
    job_id: str | uuid.UUID,
    error_message: str,
) -> None:
    """Convenience wrapper: stamp the job as failed."""
    await update_scan_job(
        db,
        job_id,
        status="failed",
        error_message=error_message[:2048],
        completed_at=datetime.now(timezone.utc),
    )


# ── VulnerabilityRecord ───────────────────────────────────────────────────────

async def save_vulnerabilities(
    db: AsyncSession,
    job_id: str | uuid.UUID,
    vulnerabilities: list[dict[str, Any]],
) -> int:
    """
    Bulk-insert vulnerability records derived from pipeline output dicts.

    Returns the count of rows inserted.
    """
    if not vulnerabilities:
        return 0

    jid = uuid.UUID(str(job_id))
    records = []
    for v in vulnerabilities:
        records.append(
            VulnerabilityRecord(
                id=uuid.uuid4(),
                job_id=jid,
                vuln_id=v.get("id") or v.get("rule_id") or v.get("cve_id"),
                severity=str(v.get("severity", "UNKNOWN")).upper(),
                source=v.get("source", "unknown"),
                vuln_type=v.get("type"),
                title=v.get("title") or v.get("message"),
                file_path=v.get("file_path") or v.get("file"),
                line_number=v.get("line_number") or v.get("line"),
                exploitability_score=v.get("exploitability_score"),
                cvss_score=v.get("cvss_score"),
                has_ai_explanation=bool(v.get("ai_explanation")),
                raw_data=v,
                created_at=datetime.now(timezone.utc),
            )
        )

    db.add_all(records)
    await db.flush()
    logger.debug("Inserted %d vulnerability records for job %s", len(records), jid)
    return len(records)


async def get_vulnerabilities_for_job(
    db: AsyncSession,
    job_id: str | uuid.UUID,
) -> Sequence[VulnerabilityRecord]:
    """Return all vulnerability records for a job ordered by severity."""
    _SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO", "UNKNOWN"]
    result = await db.execute(
        select(VulnerabilityRecord)
        .where(VulnerabilityRecord.job_id == uuid.UUID(str(job_id)))
        .order_by(VulnerabilityRecord.severity)
    )
    return result.scalars().all()
