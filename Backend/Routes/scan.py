"""
Scan Route — SecureTrail
Exposes job status polling, result retrieval, and manual cleanup.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from Jobs.job_manager import job_manager
from Database.connection import get_db_session
from Database.repositories import scan_repo

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

    # Override with live in-memory state (more up-to-date for running jobs)
    live_jobs = job_manager.all_jobs()
    for jid, live in live_jobs.items():
        db_job_map[jid] = live  # in-memory wins for live state

    return {"jobs": sorted(db_job_map.values(), key=lambda j: j.get("created_at") or "", reverse=True)}


@router.delete("/cleanup/{job_id}")
async def cleanup_job(job_id: str):
    """Remove a job from the in-memory registry (admin use)."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    job_manager._jobs.pop(job_id, None)
    return {"success": True, "message": f"Job {job_id} removed from memory"}
