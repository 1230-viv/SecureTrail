"""
AWS S3 Manager — SecureTrail
Handles uploading and managing files in S3 bucket.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

from Utils.logger import get_logger

logger = get_logger("s3_manager")

# S3 Configuration
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "securetrail-storage")
S3_REGION = os.getenv("S3_REGION", "ap-south-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")


def get_s3_client():
    """Create and return an S3 client."""
    return boto3.client(
        "s3",
        region_name=S3_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


def upload_file_to_s3(
    file_path: Path,
    s3_key: str,
    metadata: Optional[dict] = None,
) -> Optional[str]:
    """
    Upload a file to S3 bucket.

    Args:
        file_path: Local file path to upload
        s3_key: S3 object key (path in bucket)
        metadata: Optional metadata to attach to the object

    Returns:
        S3 URL of uploaded file, or None if failed
    """
    try:
        s3_client = get_s3_client()
        
        # Prepare extra arguments for upload
        extra_args = {"Metadata": metadata} if metadata else None

        # Upload file to S3
        if extra_args:
            s3_client.upload_file(
                str(file_path),
                S3_BUCKET_NAME,
                s3_key,
                ExtraArgs=extra_args,
            )
        else:
            s3_client.upload_file(
                str(file_path),
                S3_BUCKET_NAME,
                s3_key,
            )

        s3_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        logger.info(f"Uploaded {file_path.name} to S3: {s3_key}")
        return s3_url

    except ClientError as e:
        logger.error(f"Failed to upload {file_path.name} to S3: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error uploading to S3: {e}")
        return None


def create_and_upload_zip(
    source_dir: Path,
    job_id: str,
    repository_name: str,
    source_type: str = "github",
) -> Optional[str]:
    """
    Create a ZIP archive from a directory and upload it to S3.

    Args:
        source_dir: Directory to zip
        job_id: Scan job ID
        repository_name: Name of the repository
        source_type: "github" or "upload"

    Returns:
        S3 URL of uploaded ZIP, or None if failed
    """
    try:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"{repository_name}_{timestamp}.zip"
        temp_zip_path = source_dir.parent / zip_filename

        # Create ZIP archive
        logger.info(f"Creating ZIP archive: {zip_filename}")
        shutil.make_archive(
            str(temp_zip_path.with_suffix("")),
            "zip",
            source_dir,
        )

        # Upload to S3
        s3_key = f"scans/{job_id}/{zip_filename}"
        metadata = {
            "job-id": job_id,
            "repository": repository_name,
            "source-type": source_type,
            "timestamp": timestamp,
        }

        s3_url = upload_file_to_s3(temp_zip_path, s3_key, metadata)

        # Cleanup local ZIP file
        temp_zip_path.unlink(missing_ok=True)

        return s3_url

    except Exception as e:
        logger.error(f"Failed to create and upload ZIP: {e}")
        return None


def upload_zip_to_s3(
    zip_path: Path,
    job_id: str,
    repository_name: str,
) -> Optional[str]:
    """
    Upload an existing ZIP file to S3.

    Args:
        zip_path: Path to ZIP file
        job_id: Scan job ID
        repository_name: Repository name

    Returns:
        S3 URL of uploaded ZIP, or None if failed
    """
    try:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        s3_key = f"uploads/{job_id}/{repository_name}_{timestamp}.zip"
        
        metadata = {
            "job-id": job_id,
            "repository": repository_name,
            "source-type": "upload",
            "timestamp": timestamp,
        }

        return upload_file_to_s3(zip_path, s3_key, metadata)

    except Exception as e:
        logger.error(f"Failed to upload ZIP to S3: {e}")
        return None


def delete_from_s3(s3_key: str) -> bool:
    """
    Delete an object from S3 bucket.

    Args:
        s3_key: S3 object key to delete

    Returns:
        True if successful, False otherwise
    """
    try:
        s3_client = get_s3_client()
        s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        logger.info(f"Deleted from S3: {s3_key}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete from S3: {e}")
        return False


def get_s3_url(s3_key: str) -> str:
    """Generate S3 URL from key."""
    return f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"


def extract_s3_key(s3_url: str) -> Optional[str]:
    """
    Extract S3 key from full S3 URL.
    
    Example: 
        https://bucket.s3.region.amazonaws.com/path/to/file.zip 
        → path/to/file.zip
    """
    try:
        # Remove https://bucket.s3.region.amazonaws.com/
        parts = s3_url.split('.amazonaws.com/')
        if len(parts) == 2:
            return parts[1]
        return None
    except Exception:
        return None


def move_to_archive(s3_url: str) -> Optional[str]:
    """
    Move a file to the archive/ folder for lifecycle management.
    
    This enables automatic deletion after 7 days via S3 lifecycle rules.
    Files in archive/ will be automatically deleted by S3 after 7 days.
    
    Args:
        s3_url: Full S3 URL (e.g., "https://bucket.s3.region.amazonaws.com/scans/job_id/file.zip")
    
    Returns:
        New archive S3 URL, or None if failed or if input is None
    """
    if not s3_url:
        return None
        
    try:
        s3_client = get_s3_client()
        
        # Extract S3 key from URL
        s3_key = extract_s3_key(s3_url)
        if not s3_key:
            logger.error(f"Could not extract S3 key from URL: {s3_url}")
            return None
        
        # Extract filename from original key
        filename = s3_key.split('/')[-1]
        archive_key = f"archive/{filename}"
        
        # Copy to archive folder
        copy_source = {'Bucket': S3_BUCKET_NAME, 'Key': s3_key}
        s3_client.copy_object(
            CopySource=copy_source,
            Bucket=S3_BUCKET_NAME,
            Key=archive_key,
        )
        
        # Delete original file
        s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        
        logger.info(f"Moved to archive: {s3_key} → {archive_key}")
        return get_s3_url(archive_key)
        
    except ClientError as e:
        logger.error(f"Failed to move to archive: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error moving to archive: {e}")
        return None

