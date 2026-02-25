"""
Scan Route — SecureTrail
Exposes job status polling, result retrieval, and manual cleanup.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, BackgroundTasks, Header
from typing import Optional

from Jobs.job_manager import job_manager

router = APIRouter()


@router.get("/status/{job_id}")
async def get_scan_status(job_id: str):
    """Poll the status and progress of a scan job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return job.to_dict()


@router.get("/result/{job_id}")
async def get_scan_result(job_id: str):
    """Retrieve the full structured security report for a completed job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    if job.status not in ("completed", "partial"):
        raise HTTPException(
            status_code=409,
            detail=f"Job is not yet complete. Current status: {job.status}",
        )

    if not job.result:
        raise HTTPException(status_code=500, detail="Job completed but result is missing")

    return job.result


@router.get("/jobs")
async def list_jobs():
    """List all active and recent scan jobs."""
    return {"jobs": list(job_manager.all_jobs().values())}


@router.delete("/cleanup/{job_id}")
async def cleanup_job(job_id: str):
    """Remove a job from the registry (admin use)."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    # Remove from in-memory store
    job_manager._jobs.pop(job_id, None)
    return {"success": True, "message": f"Job {job_id} removed"}
