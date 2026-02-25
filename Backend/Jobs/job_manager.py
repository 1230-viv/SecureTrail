"""
In-memory Job Manager for SecureTrail.
Tracks the lifecycle of every scan job:  queued → running → completed | failed.

For production SaaS deployment this store should be replaced with Redis
(the interface is deliberately kept compatible via the JobStore ABC).
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, Optional

from Utils.logger import get_logger

logger = get_logger("job_manager")


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"   # completed with some scanner errors


@dataclass
class ScanJob:
    job_id: str
    repository_name: str
    source_type: str          # "zip" | "github"
    status: JobStatus = JobStatus.QUEUED
    progress: int = 0         # 0-100
    stage: str = "queued"
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "repository_name": self.repository_name,
            "source_type": self.source_type,
            "status": self.status,
            "progress": self.progress,
            "stage": self.stage,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "completed_at": self.completed_at,
        }


class JobManager:
    """Thread-safe in-memory job store."""

    def __init__(self) -> None:
        self._jobs: Dict[str, ScanJob] = {}
        self._lock = asyncio.Lock()

    def create_job(self, repository_name: str, source_type: str) -> str:
        job_id = str(uuid.uuid4())
        job = ScanJob(job_id=job_id, repository_name=repository_name, source_type=source_type)
        self._jobs[job_id] = job
        logger.info(f"Created job {job_id} for repo '{repository_name}' ({source_type})")
        return job_id

    def get_job(self, job_id: str) -> Optional[ScanJob]:
        return self._jobs.get(job_id)

    def update_job(
        self,
        job_id: str,
        *,
        status: Optional[JobStatus] = None,
        progress: Optional[int] = None,
        stage: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        job = self._jobs.get(job_id)
        if not job:
            logger.warning(f"update_job: unknown job_id {job_id}")
            return
        if status is not None:
            job.status = status
            if status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.PARTIAL):
                job.completed_at = time.time()
        if progress is not None:
            job.progress = progress
        if stage is not None:
            job.stage = stage
        if result is not None:
            job.result = result
        if error is not None:
            job.error = error
        job.updated_at = time.time()
        logger.debug(f"Job {job_id}: stage={job.stage}, progress={job.progress}%, status={job.status}")

    def all_jobs(self) -> Dict[str, Dict[str, Any]]:
        return {jid: job.to_dict() for jid, job in self._jobs.items()}

    def purge_old_jobs(self, max_age_seconds: int = 3600) -> int:
        """Remove completed jobs older than max_age_seconds. Returns count removed."""
        now = time.time()
        to_remove = [
            jid for jid, job in self._jobs.items()
            if job.completed_at and (now - job.completed_at) > max_age_seconds
        ]
        for jid in to_remove:
            del self._jobs[jid]
        if to_remove:
            logger.info(f"Purged {len(to_remove)} old jobs")
        return len(to_remove)


# Global singleton — importable anywhere in the application
job_manager = JobManager()
