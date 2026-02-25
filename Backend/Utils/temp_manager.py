"""
Secure temporary directory management for SecureTrail.
All extracted repos and scan artefacts live in predictable, isolated directories
that are automatically cleaned up after a configurable TTL.
"""

import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from Utils.logger import get_logger

logger = get_logger("temp_manager")

# Root directory for all job-scoped temp dirs  
TEMP_ROOT = Path(os.getenv("TEMP_ROOT", "/tmp/securetrail_jobs"))


def ensure_temp_root() -> None:
    TEMP_ROOT.mkdir(parents=True, exist_ok=True)


def create_job_directory(job_id: str) -> Path:
    """
    Create an isolated, absolute-path directory for a scan job.
    Returns the Path object pointing to the newly created directory.
    """
    ensure_temp_root()
    job_dir = TEMP_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    logger.debug(f"Created job directory: {job_dir}")
    return job_dir


def get_job_directory(job_id: str) -> Path:
    return TEMP_ROOT / job_id


def cleanup_job_directory(job_id: str) -> bool:
    """Remove the job directory and all its contents.  Returns True on success."""
    job_dir = TEMP_ROOT / job_id
    if job_dir.exists():
        shutil.rmtree(job_dir, ignore_errors=True)
        logger.info(f"Cleaned up job directory: {job_dir}")
        return True
    return False


def safe_extract_zip(zip_path: Path, dest: Path) -> int:
    """
    Extract a ZIP file to dest, rejecting path-traversal entries.
    Returns the count of extracted files.
    """
    import zipfile

    dest.mkdir(parents=True, exist_ok=True)
    count = 0
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.infolist():
            # Path-traversal guard
            member_path = Path(member.filename)
            if member_path.is_absolute() or ".." in member_path.parts:
                logger.warning(f"Skipping unsafe ZIP entry: {member.filename}")
                continue
            zf.extract(member, dest)
            count += 1
    logger.info(f"Extracted {count} files to {dest}")
    return count


def find_project_root(base_dir: Path) -> Path:
    """
    When a ZIP contains a single top-level folder (common GitHub export pattern),
    return that folder so scanners receive the actual project root.
    """
    children = list(base_dir.iterdir())
    if len(children) == 1 and children[0].is_dir():
        return children[0]
    return base_dir
