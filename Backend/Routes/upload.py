from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import os
import shutil
from pathlib import Path
import aiofiles

from Controller.models import UploadResponse
from Jobs.job_manager import job_manager, JobStatus
from Utils.temp_manager import create_job_directory, safe_extract_zip, find_project_root
from Utils.logger import get_logger
from Utils.s3_manager import upload_zip_to_s3
from Database.connection import get_session
from Database.repositories import scan_repo as db_scan_repo

router = APIRouter()
logger = get_logger("route.upload")

MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 104857600))  # 100MB


@router.post("/zip")
async def upload_zip(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload a ZIP archive and immediately queue it for security analysis.
    Returns a job_id for status polling via GET /api/scan/status/{job_id}.
    """
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are allowed")

    repo_name = file.filename[:-4]  # strip .zip
    job_id = job_manager.create_job(repository_name=repo_name, source_type="zip")
    job_dir = create_job_directory(job_id)

    # Persist job record to DB (non-fatal if DB unavailable)
    try:
        async with get_session() as db:
            await db_scan_repo.create_scan_job(
                db, job_id=job_id, repository_name=repo_name, source_type="zip"
            )
    except Exception as _db_exc:
        logger.warning(f"Failed to persist scan job to DB: {_db_exc}")

    try:
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            job_manager.update_job(job_id, status=JobStatus.FAILED, error="File too large")
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // 1048576}MB",
            )

        zip_path = job_dir / file.filename
        async with aiofiles.open(zip_path, "wb") as f:
            await f.write(content)

        # Upload ZIP to S3 for permanent storage
        logger.info(f"Uploading ZIP to S3 for job {job_id}")
        s3_url = upload_zip_to_s3(zip_path, job_id, repo_name)
        if s3_url:
            logger.info(f"ZIP uploaded to S3: {s3_url}")
            # Update DB with S3 URL
            try:
                async with get_session() as db:
                    await db_scan_repo.update_scan_job(db, job_id, s3_url=s3_url)
                    # No need to call commit() - get_session() auto-commits
            except Exception as e:
                logger.warning(f"Failed to update S3 URL in DB: {e}")
        else:
            logger.warning(f"Failed to upload ZIP to S3 for job {job_id}")

        # Extract with path-traversal protection
        extract_dir = job_dir / "extracted"
        files_count = safe_extract_zip(zip_path, extract_dir)
        
        # Clean up the temporary ZIP file after extraction
        zip_path.unlink(missing_ok=True)
        logger.debug(f"Cleaned up temporary ZIP file: {zip_path.name}")

        # Find the actual project root (handles GitHub single-folder ZIPs)
        project_root = find_project_root(extract_dir)

        job_manager.update_job(job_id, stage="queued", progress=2)

        # Launch scan pipeline in background — non-blocking
        background_tasks.add_task(_run_pipeline, job_id, project_root, repo_name)

        logger.info(f"ZIP upload complete for job {job_id}: {files_count} files")
        return {
            "success": True,
            "job_id": job_id,
            "repository_name": repo_name,
            "files_count": files_count,
            "message": "File uploaded and scan queued. Poll /api/scan/status/{job_id} for progress.",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed for job {job_id}: {e}")
        job_manager.update_job(job_id, status=JobStatus.FAILED, error=str(e))
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


async def _run_pipeline(job_id: str, project_root: Path, repo_name: str) -> None:
    """Background task wrapper for the scan pipeline."""
    from pipeline import run_scan_pipeline
    job_manager.update_job(job_id, status=JobStatus.RUNNING, stage="running", progress=3)
    await run_scan_pipeline(
        job_id=job_id,
        project_dir=project_root,
        repository_name=repo_name,
        cleanup_after=True,
    )

