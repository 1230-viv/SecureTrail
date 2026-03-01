"""
Fix Verification Routes — SecureTrail Learning System v3
=========================================================
POST /api/learning/verify-fix/{job_id}/{category}
  Body: { rule_id, file_path, severity, code, original_issue }
  → Runs static + AI evaluation, updates lifecycle state, awards XP+badges.

GET /api/learning/lifecycle/{job_id}
  → Returns lifecycle states for all findings in a scan.

GET /api/learning/badges/{repo_name}
  → Returns all earned badges for a repository.

GET /api/learning/skill-tree/{repo_name}
  → Returns full skill tree state for a repository.

GET /api/learning/habits/{repo_name}
  → Returns habit confidence scores for a repository.

GET /api/learning/longitudinal/{job_id}
  → Returns longitudinal behavioral analysis (last 3 scans).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, func as sql_func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from Database.connection import get_db_session
from Database.models import (
    ScanJob,
    VulnLifecycle,
    HabitConfidence,
    SkillTreeProgress,
    ProgressBadge,
    UserXPProgress,
)
from Database.repositories import scan_repo
from Learning.fix_verification import evaluate_fix, VERIFY_XP
from Learning.badge_engine import check_new_badges, BADGE_CATALOG
from Learning.habit_tracker import compute_all_habit_confidence
from Learning.skill_tree import compute_skill_tree_from_scan_history, get_domain_definitions
from Learning.longitudinal_ai import get_longitudinal_analysis
from Learning.learning_engine import (
    _get_findings,
    extract_severity_counts,
    extract_categories_from_result,
)
from Learning.maturity_model import compute_v3_score
from Learning.recurring_weakness import get_recurring_weakness_report
from Learning.historical_comparison import compare_scans
from Learning.category_knowledge import classify_finding

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _job_to_dict(job: ScanJob) -> dict[str, Any]:
    return {
        "id":               str(job.id),
        "repository_name":  job.repository_name,
        "status":           job.status,
        "result_json":      job.result_json or {},
        "total_vulnerabilities": job.total_vulnerabilities,
        "critical_count":   job.critical_count,
        "high_count":       job.high_count,
        "medium_count":     job.medium_count,
        "low_count":        job.low_count,
        "info_count":       job.info_count,
        "created_at":       job.created_at.isoformat() if job.created_at else None,
        "completed_at":     job.completed_at.isoformat() if job.completed_at else None,
    }


async def _get_completed_job(db: AsyncSession, job_id: str) -> ScanJob:
    try:
        uid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")
    job = await scan_repo.get_scan_job(db, uid)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    if job.status not in ("completed", "partial"):
        raise HTTPException(status_code=409, detail=f"Job is not complete (status: {job.status})")
    return job


async def _jobs_for_repo(db: AsyncSession, repo_name: str, limit: int = 20) -> list[ScanJob]:
    stmt = (
        select(ScanJob)
        .where(ScanJob.repository_name == repo_name, ScanJob.status.in_(["completed", "partial"]))
        .order_by(desc(ScanJob.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(reversed(result.scalars().all()))


# ── POST /api/learning/verify-fix/{job_id}/{category} ────────────────────────

class VerifyFixBody(BaseModel):
    rule_id:        str
    file_path:      Optional[str] = None
    severity:       str = "medium"
    code:           str = Field(..., min_length=5, max_length=8000)
    original_issue: str = ""
    label:          Optional[str] = None


@router.post("/verify-fix/{job_id}/{category}")
async def verify_fix(
    job_id: str,
    category: str,
    body: VerifyFixBody,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """
    Submit a code fix for a vulnerability.
    Runs static + AI evaluation, updates lifecycle state, awards XP and badges.
    """
    job = await _get_completed_job(db, job_id)
    repo_name = job.repository_name
    label = body.label or category.replace("_", " ").title()

    # ── Mark lifecycle as fix_attempted immediately ──────────────────────────
    lifecycle_key = (str(job.id), body.rule_id, body.file_path or "")
    existing_stmt = select(VulnLifecycle).where(
        VulnLifecycle.job_id   == job.id,
        VulnLifecycle.rule_id  == body.rule_id,
        VulnLifecycle.file_path == body.file_path,
    )
    existing_row = (await db.execute(existing_stmt)).scalar_one_or_none()

    # Don't allow re-evaluation if already mastered
    if existing_row and existing_row.state == "mastered":
        return {
            "job_id":   job_id,
            "category": category,
            "rule_id":  body.rule_id,
            "already_mastered": True,
            "message": "This finding is already at 'mastered' state.",
            "lifecycle_state": "mastered",
            "improvement_score": 100,
            "is_secure": True,
            "xp_awarded": 0,
            "new_badges": [],
        }

    # ── Run evaluation ────────────────────────────────────────────────────────
    eval_result = evaluate_fix(
        code           = body.code,
        category       = category,
        label          = label,
        severity       = body.severity,
        original_issue = body.original_issue,
        repo_name      = repo_name,
    )

    new_lifecycle_state = eval_result["lifecycle_state"]
    xp_awarded         = eval_result["xp_awarded"]

    # ── Upsert lifecycle row ──────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    lc_stmt = pg_insert(VulnLifecycle).values(
        job_id      = job.id,
        rule_id     = body.rule_id,
        category    = category,
        file_path   = body.file_path,
        severity    = body.severity,
        state       = new_lifecycle_state,
        xp_awarded  = xp_awarded,
        fix_evaluation = eval_result,
        verified_at = now if new_lifecycle_state == "verified" else None,
    )
    lc_upsert = lc_stmt.on_conflict_do_update(
        constraint="uq_vuln_lifecycle",
        set_={
            "state":          lc_stmt.excluded.state,
            "xp_awarded":     lc_stmt.excluded.xp_awarded,
            "fix_evaluation": lc_stmt.excluded.fix_evaluation,
            "verified_at":    lc_stmt.excluded.verified_at,
            "updated_at":     sa.func.now(),
        },
    )
    await db.execute(lc_upsert)

    # ── Update XP if verified ─────────────────────────────────────────────────
    new_badges: list[dict] = []
    if xp_awarded > 0:
        # Get current XP record
        xp_stmt  = select(UserXPProgress).where(UserXPProgress.repository_name == repo_name)
        xp_row   = (await db.execute(xp_stmt)).scalar_one_or_none()
        curr_xp  = xp_row.xp_total if xp_row else 0
        new_total = curr_xp + xp_awarded

        xp_ins = pg_insert(UserXPProgress).values(
            repository_name = repo_name,
            xp_total        = new_total,
            level           = 1,
            level_label     = "Apprentice",
        )
        await db.execute(
            xp_ins.on_conflict_do_update(
                constraint="uq_user_xp_repo",
                set_={"xp_total": xp_ins.excluded.xp_total, "updated_at": sa.func.now()},
            )
        )

        # ── Badge check ───────────────────────────────────────────────────────
        # Count verified fixes per category domain
        verified_count_stmt = select(sql_func.count()).where(
            VulnLifecycle.job_id == job.id,
            VulnLifecycle.state.in_(["verified", "mastered"]),
        )
        total_verified = (await db.execute(verified_count_stmt)).scalar() or 0

        auth_v = (await db.execute(verified_count_stmt.where(
            VulnLifecycle.category.in_(["access_control", "idor", "jwt", "authentication"])
        ))).scalar() or 0
        secrets_v = (await db.execute(verified_count_stmt.where(
            VulnLifecycle.category == "secret_management"
        ))).scalar() or 0
        input_v = (await db.execute(verified_count_stmt.where(
            VulnLifecycle.category.in_(["injection", "xss", "path_traversal"])
        ))).scalar() or 0
        dep_v = (await db.execute(verified_count_stmt.where(
            VulnLifecycle.category == "dependency"
        ))).scalar() or 0

        # Already-earned badges
        earned_stmt  = select(ProgressBadge.badge_id).where(ProgressBadge.repository_name == repo_name)
        already_earned = set((await db.execute(earned_stmt)).scalars().all())

        new_badges = check_new_badges(
            repo_name         = repo_name,
            scan_job_id       = job_id,
            total_verified    = total_verified,
            auth_verified     = auth_v,
            secrets_verified  = secrets_v,
            input_verified    = input_v,
            dependency_verified = dep_v,
            has_zero_criticals  = (job.critical_count or 0) == 0,
            already_earned      = already_earned,
            health_scores       = [],  # streak check skipped here; handled in insights
        )

        for badge in new_badges:
            badge_ins = pg_insert(ProgressBadge).values(
                repository_name   = repo_name,
                badge_id          = badge["id"],
                badge_name        = badge["name"],
                badge_description = badge.get("description", ""),
                earned_at         = now,
                scan_id           = job_id,
            )
            await db.execute(
                badge_ins.on_conflict_do_nothing(
                    constraint="uq_progress_badge_repo_badge"
                )
            )

    await db.commit()

    return {
        "job_id":            job_id,
        "category":          category,
        "rule_id":           body.rule_id,
        "is_secure":         eval_result["is_secure"],
        "improvement_score": eval_result["improvement_score"],
        "missing_checks":    eval_result["missing_checks"],
        "explanation":       eval_result["explanation"],
        "next_step":         eval_result["next_step"],
        "static_flags":      eval_result["static_flags"],
        "lifecycle_state":   new_lifecycle_state,
        "xp_awarded":        xp_awarded,
        "new_badges":        new_badges,
    }


# ── GET /api/learning/lifecycle/{job_id} ────────────────────────────────────

@router.get("/lifecycle/{job_id}")
async def get_lifecycle(
    job_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Return lifecycle states for all tracked findings in a scan."""
    job = await _get_completed_job(db, job_id)

    # Get all lifecycle rows for this job
    lc_stmt = select(VulnLifecycle).where(VulnLifecycle.job_id == job.id)
    lc_rows = (await db.execute(lc_stmt)).scalars().all()

    # Build a state map keyed by rule_id+file_path
    state_map: dict[str, dict] = {}
    for row in lc_rows:
        key = f"{row.rule_id}::{row.file_path or ''}"
        state_map[key] = {
            "rule_id":   row.rule_id,
            "category":  row.category,
            "file_path": row.file_path,
            "severity":  row.severity,
            "state":     row.state,
            "xp_awarded": row.xp_awarded,
            "verified_at": row.verified_at.isoformat() if row.verified_at else None,
        }

    # Augment with findings not yet in lifecycle (default: detected)
    all_findings = _get_findings(job.result_json or {})
    for f in all_findings:
        rule_id   = f.get("rule_id") or f.get("check_id") or ""
        file_path = f.get("file") or f.get("file_path") or ""
        key       = f"{rule_id}::{file_path}"
        if key not in state_map:
            state_map[key] = {
                "rule_id":   rule_id,
                "category":  classify_finding(f),
                "file_path": file_path,
                "severity":  (f.get("severity") or "info").lower(),
                "state":     "detected",
                "xp_awarded": 0,
                "verified_at": None,
            }

    # Summary counts
    states = [v["state"] for v in state_map.values()]
    summary = {s: states.count(s) for s in ("detected", "learning", "fix_attempted", "verified", "mastered")}

    return {
        "job_id":   job_id,
        "findings": list(state_map.values()),
        "summary":  summary,
        "total":    len(state_map),
    }


# ── GET /api/learning/badges/{repo_name} ─────────────────────────────────────

@router.get("/badges/{repo_name:path}")
async def get_badges(
    repo_name: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Return all earned badges for a repository."""
    stmt = (
        select(ProgressBadge)
        .where(ProgressBadge.repository_name == repo_name)
        .order_by(ProgressBadge.earned_at)
    )
    rows = (await db.execute(stmt)).scalars().all()
    earned = [
        {
            "badge_id":    r.badge_id,
            "badge_name":  r.badge_name,
            "description": r.badge_description,
            "earned_at":   r.earned_at.isoformat(),
            "scan_id":     r.scan_id,
        }
        for r in rows
    ]
    # Catalog with earned flag
    catalog = [
        {
            **b,
            "earned": any(e["badge_id"] == b["id"] for e in earned),
        }
        for b in BADGE_CATALOG
    ]
    return {
        "repository_name": repo_name,
        "earned_count":    len(earned),
        "earned":          earned,
        "catalog":         catalog,
    }


# ── GET /api/learning/skill-tree/{repo_name} ─────────────────────────────────

@router.get("/skill-tree/{repo_name:path}")
async def get_skill_tree(
    repo_name: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Return the full skill tree state for a repository."""
    # Get stored domain XP from DB
    st_stmt = select(SkillTreeProgress).where(SkillTreeProgress.repository_name == repo_name)
    st_row  = (await db.execute(st_stmt)).scalar_one_or_none()

    if st_row:
        stored_xp = {
            "auth_authz":        st_row.auth_authz_xp,
            "secrets":           st_row.secrets_xp,
            "api_protection":    st_row.api_protection_xp,
            "input_validation":  st_row.input_validation_xp,
            "dependency":        st_row.dependency_xp,
            "secure_arch":       st_row.secure_arch_xp,
        }
    else:
        stored_xp = {}

    # Recompute from scan history to ensure consistency
    jobs = await _jobs_for_repo(db, repo_name)
    job_dicts = [_job_to_dict(j) for j in jobs]
    live_tree = compute_skill_tree_from_scan_history(job_dicts)

    # Merge stored XP (DB) with live computed (in case of discrepancies)
    for domain in live_tree["domains"]:
        d_id = domain["id"]
        if d_id in stored_xp:
            # Use max of stored vs computed — never lose XP
            computed_xp = domain["xp"]
            db_xp       = stored_xp.get(d_id, 0)
            domain["xp"] = max(computed_xp, db_xp)

    return {
        "repository_name": repo_name,
        **live_tree,
    }


# ── GET /api/learning/habits/{repo_name} ───────────────────────────────────

@router.get("/habits/{repo_name:path}")
async def get_habits(
    repo_name: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Return habit confidence scores for a repository."""
    jobs = await _jobs_for_repo(db, repo_name, limit=50)
    if not jobs:
        raise HTTPException(
            status_code=404,
            detail=f"No completed scans found for repository '{repo_name}'",
        )
    job_dicts = [_job_to_dict(j) for j in jobs]
    habits    = compute_all_habit_confidence(job_dicts)
    return {
        "repository_name": repo_name,
        "scan_count":      len(jobs),
        "habits":          habits,
    }


# ── GET /api/learning/longitudinal/{job_id} ──────────────────────────────────

@router.get("/longitudinal/{job_id}")
async def get_longitudinal(
    job_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Return longitudinal behavioral analysis using last 3 scans."""
    job       = await _get_completed_job(db, job_id)
    repo_name = job.repository_name

    # Fetch last 3 completed scans (oldest first)
    jobs       = await _jobs_for_repo(db, repo_name, limit=3)
    job_dicts  = [_job_to_dict(j) for j in jobs]

    # Build scan summaries for AI
    scan_summaries = []
    for j in job_dicts:
        result_json = j.get("result_json") or {}
        sev         = extract_severity_counts(result_json)
        cats        = extract_categories_from_result(result_json)
        score       = compute_v3_score(sev)
        scan_summaries.append({
            "health_score": score,
            "categories":   cats,
            "date":         j.get("completed_at") or j.get("created_at") or "",
        })

    recurring_report  = get_recurring_weakness_report(job_dicts)
    recurring_cats    = [r.get("category", "") for r in recurring_report.get("recurring_categories", [])]

    # Build resolved + regression from latest scan
    resolved_cats: list[str] = []
    regression_cats: list[str] = []
    if len(job_dicts) >= 2:
        comp = compare_scans(
            (job_dicts[-1].get("result_json") or {}),
            (job_dicts[-2].get("result_json") or {}),
        )
        resolved_cats   = comp.get("resolved_categories", [])
        regression_cats = comp.get("new_categories", [])

    # Top habit from habits endpoint
    habit_records = compute_all_habit_confidence(job_dicts)
    top_habit = habit_records[0]["pattern_name"] if habit_records else ""

    analysis = get_longitudinal_analysis(
        scan_summaries       = scan_summaries,
        recurring_categories = recurring_cats,
        resolved_categories  = resolved_cats,
        regression_categories = regression_cats,
        top_habit            = top_habit,
        repo_name            = repo_name,
    )

    return {
        "job_id":          job_id,
        "repository_name": repo_name,
        "scan_count":      len(job_dicts),
        **analysis,
    }
