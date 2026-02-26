from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from typing import List, Optional
from github import Github, GithubException
from Controller.models import Repository
from Jobs.job_manager import job_manager, JobStatus
from Utils.temp_manager import create_job_directory
from Utils.logger import get_logger
from Utils.s3_manager import create_and_upload_zip
from Database.connection import get_session
from Database.repositories import scan_repo as db_scan_repo
import subprocess
import os

router = APIRouter()
logger = get_logger("route.repository")

GIT_CLONE_TIMEOUT = int(os.getenv("GIT_CLONE_TIMEOUT", "120"))


@router.get("/list", response_model=List[Repository])
async def list_repositories(authorization: Optional[str] = Header(None)):
    """List GitHub repositories for authenticated user"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    access_token = authorization.replace("Bearer ", "")
    try:
        g = Github(access_token)
        user = g.get_user()
        repos = user.get_repos(sort="updated", direction="desc")
        return [
            Repository(
                id=repo.id,
                name=repo.name,
                full_name=repo.full_name,
                description=repo.description,
                private=repo.private,
                html_url=repo.html_url,
                default_branch=repo.default_branch,
                language=repo.language,
                updated_at=repo.updated_at.isoformat(),
            )
            for repo in repos[:50]
        ]
    except GithubException as e:
        raise HTTPException(status_code=400, detail=f"GitHub API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@router.post("/scan")
async def scan_repository(
    background_tasks: BackgroundTasks,
    repo_full_name: str,
    branch: str = "main",
    authorization: Optional[str] = Header(None),
):
    """
    Clone a GitHub repository and launch a full security scan.
    Returns a job_id for polling via GET /api/scan/status/{job_id}.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    access_token = authorization.replace("Bearer ", "")
    try:
        g = Github(access_token)
        repo = g.get_repo(repo_full_name)
    except GithubException as e:
        raise HTTPException(status_code=400, detail=f"GitHub API error: {str(e)}")

    repo_name = repo.name
    job_id = job_manager.create_job(repository_name=repo_name, source_type="github")
    job_dir = create_job_directory(job_id)
    clone_dir = job_dir / "repo"

    # Persist job record to DB (non-fatal if DB unavailable)
    try:
        async with get_session() as db:
            await db_scan_repo.create_scan_job(
                db, job_id=job_id, repository_name=repo_name,
                source_type="github", repo_full_name=repo_full_name, branch=branch
            )
    except Exception as _db_exc:
        logger.warning(f"Failed to persist scan job to DB: {_db_exc}")

    # Authenticated clone URL (never logged)
    clone_url = f"https://x-access-token:{access_token}@github.com/{repo_full_name}.git"

    background_tasks.add_task(
        _clone_and_scan,
        job_id=job_id,
        clone_url=clone_url,
        clone_dir=clone_dir,
        branch=branch,
        repo_name=repo_name,
    )

    logger.info(f"GitHub scan queued: job={job_id}, repo={repo_full_name}, branch={branch}")
    return {
        "success": True,
        "job_id": job_id,
        "repository_name": repo_name,
        "message": "Repository scan queued. Poll /api/scan/status/{job_id} for progress.",
    }


async def _clone_and_scan(
    job_id: str,
    clone_url: str,
    clone_dir,
    branch: str,
    repo_name: str,
) -> None:
    """Background task: clone then run full pipeline."""
    import asyncio
    from pipeline import run_scan_pipeline
    from pathlib import Path

    log = logger
    job_manager.update_job(job_id, status=JobStatus.RUNNING, stage="cloning", progress=2)

    try:
        proc = await asyncio.create_subprocess_exec(
            "git", "clone",
            "--depth=1",
            "--branch", branch,
            clone_url,
            str(clone_dir),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=GIT_CLONE_TIMEOUT)
        if proc.returncode != 0:
            err = stderr.decode()[-500:]
            raise RuntimeError(f"git clone failed: {err}")

        log.info(f"GitHub repo cloned successfully: {repo_name}")

        # Create ZIP and upload to S3
        job_manager.update_job(job_id, stage="uploading_to_s3", progress=3)
        log.info(f"Creating ZIP and uploading to S3 for job {job_id}")
        s3_url = create_and_upload_zip(
            source_dir=Path(clone_dir),
            job_id=job_id,
            repository_name=repo_name,
            source_type="github"
        )
        
        if s3_url:
            log.info(f"Repository uploaded to S3: {s3_url}")
            # Update DB with S3 URL
            try:
                async with get_session() as db:
                    await db_scan_repo.update_scan_job(db, job_id, s3_url=s3_url)
                    # No need to call commit() - get_session() auto-commits
            except Exception as e:
                log.warning(f"Failed to update S3 URL in DB: {e}")
        else:
            log.warning(f"Failed to upload repository ZIP to S3 for job {job_id}")

        job_manager.update_job(job_id, stage="queued", progress=4)
        await run_scan_pipeline(
            job_id=job_id,
            project_dir=Path(clone_dir),
            repository_name=repo_name,
            cleanup_after=True,
        )
    except Exception as e:
        log.error(f"Clone/scan failed for job {job_id}: {e}")
        job_manager.update_job(job_id, status=JobStatus.FAILED, error=str(e))

