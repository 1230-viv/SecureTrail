"""
Learning Routes — SecureTrail Learning System v3
=================================================
Endpoints:
  GET /api/learning/summary/{job_id}   — single-scan learning summary
  GET /api/learning/progress/{repo}    — cross-scan progress + trend
  GET /api/learning/insights/{job_id}  — AI mentor panel (cached)
  GET /api/learning/maturity           — current maturity level + badges

v3 additions:
  - historical_comparison (resolved/new/recurring counts + risk momentum)
  - xp_engine (XP gained per scan, level progress)
  - behavioral evidence[] + fix_now fields
  - v3 linear maturity score formula
"""

from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Optional

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.dialects.postgresql import insert as pg_insert

from Database.connection import get_db_session
from Database.models import ScanJob, LearningInsightsCache, VulnGuideCache, UserXPProgress
from Database.repositories import scan_repo

from Learning.learning_engine import (
    compute_learning_summary,
    compute_progress_metrics,
    build_priority_roadmap,
    compute_health_score,
    extract_severity_counts,
    extract_categories_from_result,
    _get_findings,
)
from Learning.ai_mentor import get_ai_insights
from Learning.maturity_model import (
    get_maturity_report,
    get_transparent_maturity_explanation,
    compute_v3_score,
)
from Learning.category_knowledge import get_all_categories, CATEGORY_KNOWLEDGE, classify_finding, get_knowledge
from Learning.recurring_weakness import get_recurring_weakness_report
from Learning.behavioral_insights import generate_behavioral_insights, get_behavioral_signal_for_ai
from Learning.historical_comparison import compare_scans
from Learning.xp_engine import compute_xp_data

logger = logging.getLogger(__name__)
_AI_ENABLED: bool = os.getenv("AI_ENABLED", "false").lower() == "true"

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
    cur_sevs   = extract_severity_counts(cur_result)
    behavioral = generate_behavioral_insights(
        categories = cur_cats,
        recurring  = recurring_report.get("recurring_categories", []),
        findings   = _get_findings(cur_result),
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
    v3: includes risk_momentum, xp_data, historical comparison, evidence[].
    """
    job      = await _get_completed_job(db, job_id)
    job_dict = _job_to_dict(job)
    repo_name = job.repository_name

    # ── DB cache check ───────────────────────────────────────────────────────
    if not force_refresh:
        cache_stmt = select(LearningInsightsCache).where(
            LearningInsightsCache.job_id == job.id
        )
        cache_res = await db.execute(cache_stmt)
        cached_row = cache_res.scalar_one_or_none()
        if cached_row is not None:
            return cached_row.payload

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
    prev_res  = await db.execute(stmt)
    prev_db   = prev_res.scalar_one_or_none()
    prev_dict = _job_to_dict(prev_db) if prev_db else None

    # ── Recurring patterns from full repo history
    all_repo_jobs  = await _jobs_for_repo(db, repo_name)
    all_repo_dicts = [_job_to_dict(j) for j in all_repo_jobs]
    recurring_report = get_recurring_weakness_report(all_repo_dicts)

    # ── Current scan data
    cur_result  = job_dict.get("result_json") or {}
    cur_cats    = extract_categories_from_result(cur_result)
    cur_sevs    = extract_severity_counts(cur_result)
    cur_score   = compute_v3_score(cur_sevs)
    cur_findings = _get_findings(cur_result)

    # ── Historical comparison (v3)
    prev_result = (prev_dict or {}).get("result_json") or {} if prev_dict else {}
    comparison  = compare_scans(cur_result, prev_result if prev_result else None)
    risk_momentum = comparison.get("risk_momentum", "stable")
    prev_score    = comparison.get("previous_score")
    score_delta   = comparison.get("score_delta")

    historical_summary = {
        "previous_health_score":  prev_score,
        "resolved_categories":    comparison.get("resolved_categories", []),
        "new_categories":         comparison.get("new_categories", []),
        "recurring_categories":   comparison.get("recurring_categories", []),
    }

    # ── XP calculation (v3)
    resolved_sevs = comparison.get("resolved_severities", {})
    xp_data = compute_xp_data(
        repo_name           = repo_name,
        resolved_severities = resolved_sevs,
        scan_id             = job_id,
        persist             = True,
    )

    # ── Behavioral insights (v3 — with evidence[])
    behavioral_full = generate_behavioral_insights(
        categories = cur_cats,
        recurring  = recurring_report.get("recurring_categories", []),
        findings   = cur_findings,
    )
    behavioral_signals = get_behavioral_signal_for_ai(behavioral_full)

    # ── Priority roadmap with priority_score = severity_weight × recurrence_multiplier
    roadmap_raw = build_priority_roadmap(cur_result)
    for item in roadmap_raw:
        cat = item.get("category", "")
        # Recurrence multiplier: 1.5× if category is recurring
        is_rec = any(r.get("category") == cat for r in recurring_report.get("recurring_categories", []))
        item["recurrence_multiplier"] = 1.5 if is_rec else 1.0
        item["priority_score_v3"] = round(item.get("priority_score", 0) * item["recurrence_multiplier"], 3)
        item["is_recurring"] = is_rec
    roadmap_raw.sort(key=lambda x: x["priority_score_v3"], reverse=True)

    # ── AI insights
    insights = get_ai_insights(
        job_id               = job_id,
        result_json          = cur_result,
        previous_result_json = prev_result or None,
        recurring_patterns   = recurring_report.get("recurring_categories", []),
        behavioral_hints     = behavioral_full,
        health_score         = cur_score,
        score_delta          = score_delta,
        force_refresh        = force_refresh,
        risk_momentum        = risk_momentum,
        historical_summary   = historical_summary,
        project_name         = repo_name,
    )

    # ── Persist XP to DB ─────────────────────────────────────────────────────
    try:
        _xp_stmt = pg_insert(UserXPProgress).values(
            repository_name=repo_name,
            xp_total=xp_data.get("xp_total", 0),
            level=xp_data.get("level", 1),
            level_label=xp_data.get("level_label", "Apprentice"),
            earned_badges=xp_data.get("badges", []),
            history=xp_data.get("breakdown", []),
        )
        xp_upsert = _xp_stmt.on_conflict_do_update(
            constraint="uq_user_xp_repo",
            set_={
                "xp_total":      _xp_stmt.excluded.xp_total,
                "level":         _xp_stmt.excluded.level,
                "level_label":   _xp_stmt.excluded.level_label,
                "earned_badges": _xp_stmt.excluded.earned_badges,
                "history":       _xp_stmt.excluded.history,
                "updated_at":    sa.func.now(),
            },
        )
        await db.execute(xp_upsert)
    except Exception as _xp_err:
        logger.warning("XP DB persist failed for %s: %s", repo_name, _xp_err)

    response = {
        "job_id":                    job_id,
        "repository_name":           repo_name,
        "health_score":              cur_score,
        "score_formula":             "100 - (critical×15) - (high×8) - (medium×3) - (low×1)",
        "score_delta":               score_delta,
        "risk_momentum":             risk_momentum,
        "historical_comparison":     comparison,
        "xp_data":                   xp_data,
        "recurring_report":          recurring_report,
        "behavioral_insights_full":  behavioral_full,
        "priority_roadmap_v3":       roadmap_raw,
        **insights,
    }

    # ── Write insights to DB cache ──────────────────────────────────────────
    try:
        _ins_stmt = pg_insert(LearningInsightsCache).values(
            job_id=job.id,
            payload=response,
        )
        ins_upsert = _ins_stmt.on_conflict_do_update(
            index_elements=["job_id"],
            set_={"payload": _ins_stmt.excluded.payload,
                  "generated_at": sa.func.now()},
        )
        await db.execute(ins_upsert)
        await db.commit()
    except Exception as _cache_err:
        logger.warning("Insights cache DB write failed for %s: %s", job_id, _cache_err)

    return response


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
        cur_score  = compute_v3_score(cur_sevs)
        cur_cats   = extract_categories_from_result(cur_result)
        transparent = get_transparent_maturity_explanation(
            score      = cur_score,
            sev_counts = cur_sevs,
            categories = cur_cats,
            recurring  = recurring_report.get("recurring_categories", []),
            scan_count = len(job_dicts),
        )
        report["transparent"] = transparent
        report["score"] = cur_score  # override with v3 score

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


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/learning/chat
# ─────────────────────────────────────────────────────────────────────────────
class _ChatMsg(BaseModel):
    role: str     # "user" | "assistant"
    content: str


class _ChatBody(BaseModel):
    messages: list[_ChatMsg]
    job_id:    Optional[str] = None
    repo_name: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/learning/vuln-guide/{job_id}/{category}
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/vuln-guide/{job_id}/{category}")
async def get_vuln_guide(
    job_id: str,
    category: str,
    refresh: str = "",
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """
    Vulnerability learning guide for a specific category in a scan.
    Returns:
      - All findings in this category (file, line, severity, snippet)
      - AI-generated what/why/how-to-fix + before/after code
      - Category metadata (label, color, explanation)
    """
    job = await _get_completed_job(db, job_id)

    # ── DB cache check ───────────────────────────────────────────────────────
    if not refresh:
        vg_stmt = select(VulnGuideCache).where(
            VulnGuideCache.job_id == job.id,
            VulnGuideCache.category == category,
        )
        vg_res = await db.execute(vg_stmt)
        vg_cached = vg_res.scalar_one_or_none()
        if vg_cached is not None:
            return vg_cached.payload

    result_json = job.result_json or {}
    all_findings = _get_findings(result_json)

    # ── Filter findings to this category ────────────────────────────────────
    cat_findings = [
        f for f in all_findings
        if classify_finding(f) == category
    ]

    # ── Severity breakdown for this category ───────────────────────────────
    from collections import Counter
    cat_sevs: Counter = Counter(
        (f.get("severity") or "info").lower() for f in cat_findings
    )

    # ── Serialize findings (cap at 30 to stay lean) ─────────────────────────
    serialized = []
    for f in cat_findings[:30]:
        serialized.append({
            "file":         f.get("file") or f.get("file_path") or "",
            "line":         f.get("line") or f.get("start_line") or None,
            "line_end":     f.get("line_end") or f.get("end_line") or None,
            "severity":     (f.get("severity") or "info").lower(),
            "title":        f.get("title") or f.get("rule_id") or category,
            "message":      f.get("description") or f.get("message") or "",
            "rule_id":      f.get("rule_id") or f.get("check_id") or "",
            "code_snippet": (f.get("code_snippet") or "")[:400],
        })

    # ── Static knowledge from category_knowledge.py ──────────────────────────
    knowledge = get_knowledge(category)
    label        = knowledge.get("label", category.replace("_", " ").title())
    color        = knowledge.get("color", "#6366f1")
    plain_what   = knowledge.get("plain_explanation", "")
    plain_why    = knowledge.get("why_it_matters", "")
    plain_fix    = knowledge.get("secure_pattern", "")
    code_ex      = knowledge.get("code_example", {})
    checklist    = knowledge.get("checklist", [])
    cwe_refs     = knowledge.get("cwe_refs", [])

    # ── AI guide (if AI_ENABLED) ─────────────────────────────────────────────
    ai_guide: dict[str, Any] = {}
    source = "static"

    if _AI_ENABLED and cat_findings:
        try:
            from Engines.ai.bedrock_client import invoke_chat

            # Sample up to 5 findings as context
            sample = cat_findings[:5]
            file_lines = "\n".join(
                f"  • {f.get('file','?')}:{f.get('line','?')} "
                f"[{(f.get('severity') or 'info').upper()}] "
                f"{f.get('title') or f.get('rule_id','?')}"
                + (f"\n    Code: {(f.get('code_snippet','') or '')[:120]}" if f.get('code_snippet') else "")
                for f in sample
            )
            prompt = (
                f"A developer is learning about the security category: **{label}** ({category}).\n"
                f"Their code has {len(cat_findings)} finding(s) of this type in the repository '"
                f"{job.repository_name}'.\n\n"
                f"Sample affected locations:\n{file_lines}\n\n"
                "Produce a structured educational guide using **exactly** these section headers:\n\n"
                f"## What is {label}?\n"
                "Brief explanation (3-4 sentences) of what this vulnerability class is.\n\n"
                "## Why it matters\n"
                "Business and security impact in plain language. No scare tactics — focus on concrete risk.\n\n"
                "## Secure Code Template\n"
                "Provide a ready-to-use code template the developer can adapt directly. "
                "Use a fenced code block with the correct language. Label it '# ✅ Secure template'.\n\n"
                "## Common Mistake Patterns\n"
                "List 3-5 specific coding patterns that trigger this category (what developers accidentally write). "
                "For each mistake show a short insecure snippet and one-line explanation.\n\n"
                "## How to fix it\n"
                "Step-by-step remediation specific to the findings above. "
                "Reference actual file names if possible.\n\n"
                "## How to test this fix\n"
                "Provide 2-3 concrete testing steps (unit test assertion, curl command, or tool invocation) "
                "to verify the fix was applied correctly.\n\n"
                "## Quick checklist\n"
                "5-7 bullet points a developer can use as a pre-commit checklist.\n\n"
                "Rules: use fenced markdown code blocks (```python etc). "
                "Do NOT use 'attacker' — use 'unauthorised actor'. "
                "Do NOT use 'exploit' — use 'misuse'. "
                "Keep total response under 1400 tokens."
            )
            system = (
                "You are a senior application security educator embedded in SecureTrail. "
                "Write educational, constructive content for developers learning to fix their security issues. "
                "Use professional language. "
                "Never use the words 'attacker', 'exploit', 'hack', or 'penetration'. "
                "Replace 'attacker' with 'unauthorised actor', 'exploit' with 'misuse', "
                "'penetration' with 'security evaluation', 'vulnerability' with 'security issue' where natural. "
                "Outputs must be deterministic, structured, and developer-focused. "
                "Always emit valid markdown with fenced code blocks. "
                "Do not include preamble or 'Sure, here is...' phrases — start directly with the first section header."
            )
            raw = invoke_chat([{"role": "user", "content": prompt}], system)
            ai_guide = {"full_guide": raw}
            source = "ai"
        except Exception as exc:
            logger.warning("Vuln guide AI call failed for %s/%s: %s", job_id, category, exc)

    vg_response = {
        "job_id":      job_id,
        "repo_name":   job.repository_name,
        "category":    category,
        "label":       label,
        "color":       color,
        "icon":        knowledge.get("icon", "Shield"),
        "total":       len(cat_findings),
        "sev_counts":  dict(cat_sevs),
        "findings":    serialized,
        # Static knowledge fallback
        "plain_what":  plain_what,
        "plain_why":   plain_why,
        "plain_fix":   plain_fix,
        "code_example": code_ex,
        "checklist":   checklist,
        "cwe_refs":    cwe_refs,
        # AI content (empty dict if AI disabled / failed)
        "ai_guide":    ai_guide,
        "source":      source,
    }

    # ── Write to DB cache ────────────────────────────────────────────────────
    try:
        _vg_stmt = pg_insert(VulnGuideCache).values(
            job_id=job.id,
            category=category,
            payload=vg_response,
        )
        vg_upsert = _vg_stmt.on_conflict_do_update(
            constraint="uq_vuln_guide_job_category",
            set_={"payload": _vg_stmt.excluded.payload,
                  "generated_at": sa.func.now()},
        )
        await db.execute(vg_upsert)
        await db.commit()
    except Exception as _vg_err:
        logger.warning("VulnGuide cache DB write failed for %s/%s: %s", job_id, category, _vg_err)

    return vg_response


@router.post("/chat")
async def learning_chat(
    body: _ChatBody,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Multi-turn AI security mentor chat.
    Accepts conversation history + optional scan job_id for context injection.
    Backed by Meta Llama 4 Maverick via Bedrock Converse API.
    """
    context_lines: list[str] = []

    if body.job_id:
        try:
            job_db = await _get_completed_job(db, body.job_id)
            cur_result = job_db.result_json or {}
            sev        = extract_severity_counts(cur_result)
            hs         = compute_v3_score(sev)
            findings   = _get_findings(cur_result)[:6]
            top_str    = "; ".join(
                f"{f.get('rule_id','?')} [{(f.get('severity') or 'info').lower()}]"
                for f in findings
            ) or "none"
            context_lines = [
                f"Repository: {job_db.repository_name}",
                f"Security health score: {hs}/100",
                f"Critical: {sev.get('critical',0)}  High: {sev.get('high',0)}  "
                f"Medium: {sev.get('medium',0)}  Low: {sev.get('low',0)}",
                f"Top findings: {top_str}",
            ]
        except HTTPException:
            pass  # job not found — proceed without context
        except Exception as exc:
            logger.warning("Chat context load failed for job %s: %s", body.job_id, exc)

    ctx_block  = "\n".join(context_lines)
    system_prompt = (
        "You are a senior application security mentor embedded in SecureTrail, "
        "an AI-powered developer security learning platform.\n"
        "Your role: help developers understand their security weaknesses, "
        "learn secure coding practices, and write more secure code.\n"
        "Guidelines:\n"
        "- Be conversational, concise (2-4 paragraphs max), educational, and encouraging.\n"
        "- Address the developer as 'you' / 'your'.\n"
        "- When showing code, use fenced code blocks with language label (```python, ```javascript, etc.).\n"
        "- Use professional language only. Replace: exploit→misuse risk, "
        "attacker→unauthorised actor, penetration→security evaluation.\n"
        "- If the developer asks about something unrelated to security, politely "
        "redirect back to their security posture.\n"
        + (f"\n--- Current Scan Context ---\n{ctx_block}\n" if ctx_block else "")
    )

    if not _AI_ENABLED:
        return {
            "role":    "assistant",
            "content": (
                "The AI mentor is currently offline. "
                "Set `AI_ENABLED=true` in your environment and ensure Bedrock access is configured."
            ),
        }

    try:
        from Engines.ai.bedrock_client import invoke_chat
        msgs  = [{"role": m.role, "content": m.content} for m in body.messages]
        reply = invoke_chat(msgs, system_prompt=system_prompt)
        return {"role": "assistant", "content": reply}
    except Exception as exc:
        logger.warning("Chat AI call failed: %s", exc)
        return {
            "role":    "assistant",
            "content": (
                "I'm having trouble reaching the AI service right now. "
                "Please try again in a moment."
            ),
            "error": str(exc),
        }
