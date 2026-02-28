"""
Scan Route — SecureTrail
Exposes job status polling, result retrieval, and manual cleanup.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Header
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

import asyncio
import json
import os

from Jobs.job_manager import job_manager
from Database.connection import get_db_session
from Database.repositories import scan_repo
from Engines.ai.prompt_builder import (
    build_markdown_report,
    build_ai_report_prompt,
    build_hybrid_markdown_report,
    REPORT_SYSTEM_PROMPT,
)

AI_ENABLED = os.getenv("AI_ENABLED", "false").lower() == "true"

router = APIRouter()


@router.get("/status/{job_id}")
async def get_scan_status(job_id: str):
    """Poll the status and progress of a scan job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return job.to_dict()


@router.get("/result/{job_id}")
async def get_scan_result(job_id: str, db: AsyncSession = Depends(get_db_session)):
    """Retrieve the full structured security report for a completed job."""
    # Try in-memory first (live/recent job)
    job = job_manager.get_job(job_id)
    if job:
        if job.status not in ("completed", "partial"):
            raise HTTPException(
                status_code=409,
                detail=f"Job is not yet complete. Current status: {job.status}",
            )
        if not job.result:
            raise HTTPException(status_code=500, detail="Job completed but result is missing")
        return job.result

    # Fall back to persistent DB (job may have been evicted from memory)
    db_job = await scan_repo.get_scan_job(db, job_id)
    if not db_job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    if db_job.status not in ("completed", "partial"):
        raise HTTPException(
            status_code=409,
            detail=f"Job is not yet complete. Current status: {db_job.status}",
        )
    if not db_job.result_json:
        raise HTTPException(status_code=500, detail="Job completed but result is missing")
    return db_job.result_json


@router.get("/jobs")
async def list_jobs(db: AsyncSession = Depends(get_db_session)):
    """
    List all scan jobs, newest first.
    Merges in-memory (live) jobs with DB history so restarted jobs still appear.
    """
    # DB history (persistent, survives restarts)
    db_jobs = await scan_repo.list_scan_jobs(db, limit=100)
    db_job_map = {str(j.id): {
        "job_id":               str(j.id),
        "repository_name":      j.repository_name,
        "source_type":          j.source_type,
        "repo_full_name":       j.repo_full_name,
        "branch":               j.branch,
        "s3_url":               j.s3_url,
        "status":               j.status,
        "progress":             j.progress,
        "stage":                j.stage,
        "total_vulnerabilities": j.total_vulnerabilities,
        "critical_count":       j.critical_count,
        "high_count":           j.high_count,
        "medium_count":         j.medium_count,
        "low_count":            j.low_count,
        "info_count":           j.info_count,
        "created_at":           j.created_at.isoformat() if j.created_at else None,
        "updated_at":           j.updated_at.isoformat() if j.updated_at else None,
        "completed_at":         j.completed_at.isoformat() if j.completed_at else None,
        "error_message":        j.error_message,
    } for j in db_jobs}

    # Override with live in-memory state (more up-to-date for running jobs).
    # Normalize to the same schema as DB rows: ISO timestamps, flat count fields,
    # no embedded result blob (too large and not needed for the list view).
    import datetime as _dt
    def _ts_to_iso(ts) -> str | None:
        if ts is None:
            return None
        if isinstance(ts, float | int):
            return _dt.datetime.utcfromtimestamp(ts).isoformat()
        return str(ts)

    live_jobs = job_manager.all_jobs()
    for jid, live in live_jobs.items():
        result = live.get("result") or {}
        # Normalise status to a plain string (Enum .value) so the
        # frontend can simply compare === "completed" etc.
        raw_status = live.get("status", "queued")
        status_str = raw_status.value if hasattr(raw_status, "value") else str(raw_status)
        db_job_map[jid] = {
            "job_id":                jid,
            "repository_name":       live.get("repository_name"),
            "source_type":           live.get("source_type"),
            "repo_full_name":        live.get("repo_full_name"),
            "branch":                live.get("branch"),
            "s3_url":                live.get("s3_url"),
            "status":                status_str,
            "progress":              live.get("progress", 0),
            "stage":                 live.get("stage", "queued"),
            "total_vulnerabilities": result.get("total_vulnerabilities"),
            "critical_count":        result.get("critical_count"),
            "high_count":            result.get("high_count"),
            "medium_count":          result.get("medium_count"),
            "low_count":             result.get("low_count"),
            "info_count":            result.get("info_count"),
            "created_at":            _ts_to_iso(live.get("created_at")),
            "updated_at":            _ts_to_iso(live.get("updated_at")),
            "completed_at":          _ts_to_iso(live.get("completed_at")),
            "error_message":         live.get("error"),
        }

    return {"jobs": sorted(
        db_job_map.values(),
        key=lambda j: j.get("created_at") or "",
        reverse=True,
    )}


@router.get("/report/{job_id}", response_class=PlainTextResponse)
async def generate_markdown_report(job_id: str, db: AsyncSession = Depends(get_db_session)):
    """
    Generate a professional executive-level security report in Markdown.
    Returns plain text (Markdown) suitable for download or PDF conversion.
    """
    # Resolve the result dict — same lookup chain as /result/{job_id}
    result: dict | None = None

    job = job_manager.get_job(job_id)
    if job:
        if job.status not in ("completed", "partial"):
            raise HTTPException(
                status_code=409,
                detail=f"Job is not yet complete. Current status: {job.status}",
            )
        result = job.result
    else:
        db_job = await scan_repo.get_scan_job(db, job_id)
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
        if db_job.status not in ("completed", "partial"):
            raise HTTPException(
                status_code=409,
                detail=f"Job is not yet complete. Current status: {db_job.status}",
            )
        result = db_job.result_json

    if not result:
        raise HTTPException(status_code=500, detail="Scan result is unavailable.")

    markdown: str | None = None
    used_ai = False

    # ── Try Bedrock for AI-enhanced narrative sections ────────────────
    if AI_ENABLED:
        try:
            from Engines.ai.bedrock_client import invoke_claude, BedrockPermanentError

            user_prompt = build_ai_report_prompt(result)

            # invoke_claude is synchronous — run in a thread pool
            raw = await asyncio.to_thread(
                invoke_claude,
                REPORT_SYSTEM_PROMPT,
                user_prompt,
                0.25,   # slightly higher creativity than per-vuln analysis
                2000,   # enough for 3 narrative sections
            )

            # Strip markdown fences if model wraps output
            clean = raw.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            ai_narratives = json.loads(clean)

            # Validate all three required keys are present and non-empty
            required = ("executive_summary", "key_findings_analysis", "business_impact")
            if all(ai_narratives.get(k, "").strip() for k in required):
                markdown = build_hybrid_markdown_report(result, ai_narratives)
                used_ai = True

        except Exception as exc:
            # Any Bedrock/JSON failure — silently fall back to template
            import logging
            logging.getLogger("scan_route").warning(
                f"AI report generation failed, falling back to template: {exc}"
            )

    # ── Fallback: deterministic template ──────────────────────────────
    if not markdown:
        markdown = build_markdown_report(result)

    repo_slug = (result.get("repository_name") or "report").replace(" ", "-").lower()
    filename  = f"securetrail-{repo_slug}-{job_id[:8]}.md"

    return PlainTextResponse(
        content=markdown,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Report-AI-Enhanced": str(used_ai).lower(),
        },
    )


@router.delete("/cleanup/{job_id}")
async def cleanup_job(job_id: str):
    """Remove a job from the in-memory registry (admin use)."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    job_manager._jobs.pop(job_id, None)
    return {"success": True, "message": f"Job {job_id} removed from memory"}
