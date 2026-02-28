from fastapi import APIRouter, HTTPException, Header, BackgroundTasks, Depends
from typing import List, Optional
from github import Github, GithubException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime
from pydantic import BaseModel
from Controller.models import Repository
from Jobs.job_manager import job_manager, JobStatus
from Utils.temp_manager import create_job_directory
from Utils.logger import get_logger
from Utils.s3_manager import create_and_upload_zip
from Database.connection import get_session, get_db
from Database.repositories import scan_repo as db_scan_repo
from Database.models import ScanJob
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


# ── Repository Statistics and Management ──────────────────────────────────────

class RepositoryStats(BaseModel):
    """Statistics for repository overview"""
    total_repositories: int
    active_scans: int
    high_risk_repos: int
    last_scan_hours: int


class RepositoryInfo(BaseModel):
    """Detailed repository information"""
    repository_name: str
    branch: str
    last_scan_date: datetime
    scan_count: int
    status: str
    total_vulnerabilities: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    job_id: str
    risk_level: str
    security_score: int


class RepositoryListResponse(BaseModel):
    """Response for repository list endpoint"""
    repositories: List[RepositoryInfo]
    stats: RepositoryStats


def calculate_risk_level(critical: int, high: int, medium: int) -> str:
    """Calculate risk level based on vulnerability counts"""
    if critical > 0:
        return "Critical"
    elif high >= 3:
        return "High"
    elif high > 0 or medium >= 5:
        return "Medium"
    else:
        return "Low"


def calculate_security_score(critical: int, high: int, medium: int, low: int) -> int:
    """Calculate security score (0-100) based on vulnerabilities"""
    total = critical + high + medium + low
    if total == 0:
        return 100
    
    # Weighted scoring: critical=10, high=5, medium=2, low=1
    weighted_score = (critical * 10) + (high * 5) + (medium * 2) + low
    score = max(0, 100 - weighted_score)
    return round(score)


@router.get("/stats", response_model=RepositoryListResponse)
async def get_repository_stats(
    user_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of all repositories with their scan information.
    Groups scans by repository and returns the most recent scan data.
    """
    try:
        # Query to get all scan jobs
        query = select(ScanJob).order_by(desc(ScanJob.created_at))
        
        if user_id:
            query = query.where(ScanJob.user_id == user_id)
        
        result = await db.execute(query)
        all_jobs = result.scalars().all()
        
        # Group by repository name
        repo_map = {}
        active_scan_count = 0
        
        for job in all_jobs:
            repo_name = job.repository_name or "Unnamed Repository"
            
            # Count active scans
            if job.status in ["scanning", "in_progress"]:
                active_scan_count += 1
            
            if repo_name not in repo_map:
                # First scan for this repo
                repo_map[repo_name] = {
                    "repository_name": repo_name,
                    "branch": job.branch or "main",
                    "last_scan_date": job.created_at,
                    "scan_count": 1,
                    "status": job.status,
                    "total_vulnerabilities": job.total_vulnerabilities or 0,
                    "critical_count": job.critical_count or 0,
                    "high_count": job.high_count or 0,
                    "medium_count": job.medium_count or 0,
                    "low_count": job.low_count or 0,
                    "job_id": str(job.id),
                }
            else:
                # Update scan count
                repo_map[repo_name]["scan_count"] += 1
                
                # Keep most recent scan data
                if job.created_at > repo_map[repo_name]["last_scan_date"]:
                    repo_map[repo_name].update({
                        "branch": job.branch or "main",
                        "last_scan_date": job.created_at,
                        "status": job.status,
                        "total_vulnerabilities": job.total_vulnerabilities or 0,
                        "critical_count": job.critical_count or 0,
                        "high_count": job.high_count or 0,
                        "medium_count": job.medium_count or 0,
                        "low_count": job.low_count or 0,
                        "job_id": str(job.id),
                    })
        
        # Convert to list and add calculated fields
        repositories = []
        high_risk_count = 0
        
        for repo_data in repo_map.values():
            risk_level = calculate_risk_level(
                repo_data["critical_count"],
                repo_data["high_count"],
                repo_data["medium_count"]
            )
            
            security_score = calculate_security_score(
                repo_data["critical_count"],
                repo_data["high_count"],
                repo_data["medium_count"],
                repo_data["low_count"]
            )
            
            if risk_level in ["Critical", "High"]:
                high_risk_count += 1
            
            repo_info = RepositoryInfo(
                **repo_data,
                risk_level=risk_level,
                security_score=security_score
            )
            repositories.append(repo_info)
        
        # Sort by last scan date (most recent first)
        repositories.sort(key=lambda x: x.last_scan_date, reverse=True)
        
        # Calculate last scan hours
        last_scan_hours = 0
        if repositories:
            # Make datetime timezone-aware for comparison
            from datetime import timezone
            now = datetime.now(timezone.utc)
            last_scan = repositories[0].last_scan_date
            # Ensure last_scan is timezone-aware
            if last_scan.tzinfo is None:
                from zoneinfo import ZoneInfo
                last_scan = last_scan.replace(tzinfo=timezone.utc)
            time_diff = now - last_scan
            last_scan_hours = int(time_diff.total_seconds() / 3600)
        
        # Build stats
        stats = RepositoryStats(
            total_repositories=len(repositories),
            active_scans=active_scan_count,
            high_risk_repos=high_risk_count,
            last_scan_hours=last_scan_hours
        )
        
        return RepositoryListResponse(
            repositories=repositories,
            stats=stats
        )
        
    except Exception as e:
        logger.error(f"Error fetching repositories: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch repositories: {str(e)}"
        )


@router.get("/{repository_name}/scans")
async def get_repository_scans(
    repository_name: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all scans for a specific repository.
    """
    try:
        query = select(ScanJob).where(
            ScanJob.repository_name == repository_name
        ).order_by(desc(ScanJob.created_at))
        
        result = await db.execute(query)
        scans = result.scalars().all()
        
        if not scans:
            raise HTTPException(
                status_code=404,
                detail=f"No scans found for repository: {repository_name}"
            )
        
        return {
            "repository_name": repository_name,
            "total_scans": len(scans),
            "scans": [
                {
                    "job_id": str(scan.id),
                    "branch": scan.branch,
                    "status": scan.status,
                    "created_at": scan.created_at,
                    "completed_at": scan.completed_at,
                    "total_vulnerabilities": scan.total_vulnerabilities,
                    "critical_count": scan.critical_count,
                    "high_count": scan.high_count,
                    "medium_count": scan.medium_count,
                    "low_count": scan.low_count,
                }
                for scan in scans
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching repository scans: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch repository scans: {str(e)}"
        )

