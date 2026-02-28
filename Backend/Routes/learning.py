"""
Learning Routes — SecureTrail Learning System
=============================================
Endpoints:
  GET /api/learning/summary/{job_id}   — single-scan learning summary
  GET /api/learning/progress/{repo}    — cross-scan progress + trend
  GET /api/learning/insights/{job_id}  — AI mentor panel (cached)
  GET /api/learning/maturity           — current maturity level + badges
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from Database.connection import get_db_session
from Database.models import ScanJob
from Database.repositories import scan_repo

from Learning.learning_engine import (
    compute_learning_summary,
    compute_progress_metrics,
    build_priority_roadmap,
    compute_health_score,
    extract_severity_counts,
    extract_categories_from_result,
)
from Learning.ai_mentor import get_ai_insights
from Learning.maturity_model import get_maturity_report, get_transparent_maturity_explanation
from Learning.category_knowledge import get_all_categories
from Learning.recurring_weakness import get_recurring_weakness_report
from Learning.behavioral_insights import generate_behavioral_insights, get_behavioral_signal_for_ai

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _job_to_dict(job: ScanJob) -> dict[str, Any]:
    """Serialise a ScanJob ORM object to the dict structure expected by Learning."""
    return {
        "id":               str(job.id),
        "repository_name":  job.repository_name,
        "source_type":      job.source_type,
        "status":           job.status,
        "result_json":      job.result_json or {},
        "total_vulnerabilities": job.total_vulnerabilities,
        "critical_count":   job.critical_count,
        "high_count":       job.high_count,
        "medium_count":     job.medium_count,
        "low_count":        job.low_count,
        "info_count":       job.info_count,
        "created_at":       job.created_at.isoformat() if job.created_at  else None,
        "updated_at":       job.updated_at.isoformat() if job.updated_at  else None,
        "completed_at":     job.completed_at.isoformat() if job.completed_at else None,
    }


async def _get_completed_job(db: AsyncSession, job_id: str) -> ScanJob:
    """Fetch a completed ScanJob or raise 404/409 appropriately."""
    try:
        uid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    job = await scan_repo.get_scan_job(db, uid)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    if job.status not in ("completed", "partial"):
        raise HTTPException(
            status_code=409,
            detail=f"Job is not yet complete (status: {job.status})",
        )
    return job


async def _jobs_for_repo(
    db: AsyncSession,
    repo_name: str,
    limit: int = 50,
) -> list[ScanJob]:
    """Return completed jobs for a repo, ordered oldest → newest."""
    stmt = (
        select(ScanJob)
        .where(
            ScanJob.repository_name == repo_name,
            ScanJob.status.in_(["completed", "partial"]),
        )
        .order_by(desc(ScanJob.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    # Reverse so oldest is first (progress metrics need chronological order)
    return list(reversed(jobs))


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/learning/summary/{job_id}
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/summary/{job_id}")
async def get_learning_summary(
    job_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """
    Learning summary for a single scan, compared against the previous scan
    of the same repository (if one exists).
    """
    current_job = await _get_completed_job(db, job_id)
    repo_name   = current_job.repository_name

    # Find previous completed scan for the same repo
    stmt = (
        select(ScanJob)
        .where(
            ScanJob.repository_name == repo_name,
            ScanJob.status.in_(["completed", "partial"]),
            ScanJob.id != current_job.id,
            ScanJob.created_at < current_job.created_at,
        )
        .order_by(desc(ScanJob.created_at))
        .limit(1)
    )
    result  = await db.execute(stmt)
    prev_db = result.scalar_one_or_none()

    cur_dict  = _job_to_dict(current_job)
    prev_dict = _job_to_dict(prev_db) if prev_db else None

    # ── Recurring patterns (needs all repo scans)
    all_repo_jobs = await _jobs_for_repo(db, repo_name)
    all_repo_dicts = [_job_to_dict(j) for j in all_repo_jobs]
    recurring_report = get_recurring_weakness_report(all_repo_dicts)

    # ── Behavioral insights from current scan categories
    cur_result = cur_dict.get("result_json") or {}
    cur_cats   = extract_categories_from_result(cur_result)
    behavioral = generate_behavioral_insights(
        categories = cur_cats,
        recurring  = recurring_report.get("recurring_categories", []),
    )

    summary  = compute_learning_summary(cur_dict, prev_dict)
    roadmap  = build_priority_roadmap(cur_dict.get("result_json"))

    return {
        **summary,
        "roadmap":           roadmap,
        "recurring_report":  recurring_report,
        "behavioral_insights": behavioral,
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/learning/progress/{repo_name}
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/progress/{repo_name:path}")
async def get_learning_progress(
    repo_name: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """
    Progress metrics across all completed scans of a repository.
    Returns score history, trend direction, badges, and per-category trends.
    """
    jobs = await _jobs_for_repo(db, repo_name)
    if not jobs:
        raise HTTPException(
            status_code=404,
            detail=f"No completed scans found for repository '{repo_name}'",
        )

    job_dicts = [_job_to_dict(j) for j in jobs]
    metrics   = compute_progress_metrics(job_dicts)

    return {
        "repository_name": repo_name,
        "scan_count":      len(jobs),
        **metrics,
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/learning/insights/{job_id}
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/insights/{job_id}")
async def get_learning_insights(
    job_id: str,
    force_refresh: bool = False,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """
    AI mentor insights for the top findings in a scan.
    Returns deterministic fallback if AI is disabled or unavailable.
    """
    job      = await _get_completed_job(db, job_id)
    job_dict = _job_to_dict(job)
    repo_name = job.repository_name

    # ── Previous scan for delta context
    stmt = (
        select(ScanJob)
        .where(
            ScanJob.repository_name == repo_name,
            ScanJob.status.in_(["completed", "partial"]),
            ScanJob.id != job.id,
            ScanJob.created_at < job.created_at,
        )
        .order_by(desc(ScanJob.created_at))
        .limit(1)
    )
    prev_res    = await db.execute(stmt)
    prev_db     = prev_res.scalar_one_or_none()
    prev_dict   = _job_to_dict(prev_db) if prev_db else None

    # ── Recurring patterns from full repo history
    all_repo_jobs  = await _jobs_for_repo(db, repo_name)
    all_repo_dicts = [_job_to_dict(j) for j in all_repo_jobs]
    recurring_report = get_recurring_weakness_report(all_repo_dicts)

    # ── Behavioral insights
    cur_result = job_dict.get("result_json") or {}
    cur_cats   = extract_categories_from_result(cur_result)
    cur_sevs   = extract_severity_counts(cur_result)
    cur_score  = compute_health_score(cur_result, cur_sevs)

    behavioral_full = generate_behavioral_insights(
        categories = cur_cats,
        recurring  = recurring_report.get("recurring_categories", []),
    )
    behavioral_signals = get_behavioral_signal_for_ai(behavioral_full)

    # ── Score delta
    prev_result = (prev_dict or {}).get("result_json") or {} if prev_dict else {}
    prev_sevs   = extract_severity_counts(prev_result) if prev_result else {}
    prev_score  = compute_health_score(prev_result, prev_sevs) if prev_result else None
    score_delta = (cur_score - prev_score) if prev_score is not None else None

    insights = get_ai_insights(
        job_id               = job_id,
        result_json          = cur_result,
        previous_result_json = prev_result or None,
        recurring_patterns   = recurring_report.get("recurring_categories", []),
        behavioral_hints     = behavioral_full,
        health_score         = cur_score,
        score_delta          = score_delta,
        force_refresh        = force_refresh,
    )
    return {
        "job_id":             job_id,
        "repository_name":    repo_name,
        "health_score":       cur_score,
        "score_delta":        score_delta,
        "recurring_report":   recurring_report,
        "behavioral_insights_full": behavioral_full,
        **insights,
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/learning/maturity
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/maturity")
async def get_maturity(
    repo_name: str | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """
    Current security maturity level and badge status.
    If repo_name is provided, scoped to that repository.
    Otherwise uses the most recently completed scan.
    """
    if repo_name:
        jobs = await _jobs_for_repo(db, repo_name)
    else:
        # Use global history (all repos, all users) — latest 20. 
        all_jobs_db = await scan_repo.list_scan_jobs(db, limit=20)
        jobs = [j for j in reversed(list(all_jobs_db))
                if j.status in ("completed", "partial")]

    job_dicts = [_job_to_dict(j) for j in jobs]
    report    = get_maturity_report(job_dicts)

    # ── Enrich with recurring patterns for transparent explanation
    recurring_report = get_recurring_weakness_report(job_dicts)
    if job_dicts:
        latest = job_dicts[-1]
        cur_result = latest.get("result_json") or {}
        cur_sevs   = extract_severity_counts(cur_result)
        cur_score  = compute_health_score(cur_result, cur_sevs)
        cur_cats   = extract_categories_from_result(cur_result)
        transparent = get_transparent_maturity_explanation(
            score      = cur_score,
            sev_counts = cur_sevs,
            categories = cur_cats,
            recurring  = recurring_report.get("recurring_categories", []),
            scan_count = len(job_dicts),
        )
        report["transparent"] = transparent

    return {
        "repository_name": repo_name,
        **report,
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/learning/categories
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/categories")
async def list_categories() -> list[dict]:
    """Return all known vulnerability categories with label, color, and icon."""
    return get_all_categories()
