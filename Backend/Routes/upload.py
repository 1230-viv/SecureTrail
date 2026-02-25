from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import os
import zipfile
import shutil
from pathlib import Path
import aiofiles
from Controller.models import UploadResponse

router = APIRouter()

# Get upload directory from env
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 104857600))  # 100MB

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/zip", response_model=UploadResponse)
async def upload_zip(file: UploadFile = File(...)):
    """Upload and extract a ZIP file"""
    
    # Validate file type
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are allowed")
    
    # Create a unique directory for this upload
    upload_id = os.urandom(16).hex()
    upload_path = os.path.join(UPLOAD_DIR, upload_id)
    os.makedirs(upload_path, exist_ok=True)
    
    zip_file_path = os.path.join(upload_path, file.filename)
    
    try:
        # Save uploaded file
        content = await file.read()
        
        # Check file size
        if len(content) > MAX_UPLOAD_SIZE:
            shutil.rmtree(upload_path)
            raise HTTPException(
                status_code=400, 
                detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE / 1048576}MB"
            )
        
        async with aiofiles.open(zip_file_path, 'wb') as f:
            await f.write(content)
        
        # Extract ZIP file
        extract_path = os.path.join(upload_path, "extracted")
        os.makedirs(extract_path, exist_ok=True)
        
        with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
            # Security check: prevent path traversal
            for file_info in zip_ref.filelist:
                if file_info.filename.startswith('/') or '..' in file_info.filename:
                    shutil.rmtree(upload_path)
                    raise HTTPException(status_code=400, detail="Invalid ZIP file structure")
            
            zip_ref.extractall(extract_path)
        
        # Count extracted files
        files_count = sum(1 for _ in Path(extract_path).rglob('*') if _.is_file())
        
        # Remove the ZIP file after extraction
        os.remove(zip_file_path)
        
        return UploadResponse(
            success=True,
            message="Extracted Successfully",
            repository_name=file.filename.replace('.zip', ''),
            files_count=files_count
        )
    
    except zipfile.BadZipFile:
        if os.path.exists(upload_path):
            shutil.rmtree(upload_path)
        raise HTTPException(status_code=400, detail="Invalid or corrupted ZIP file")
    
    except Exception as e:
        if os.path.exists(upload_path):
            shutil.rmtree(upload_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.delete("/cleanup/{upload_id}")
async def cleanup_upload(upload_id: str):
    """Cleanup uploaded files"""
    upload_path = os.path.join(UPLOAD_DIR, upload_id)
    
    if not os.path.exists(upload_path):
        raise HTTPException(status_code=404, detail="Upload not found")
    
    try:
        shutil.rmtree(upload_path)
        return {"success": True, "message": "Cleanup successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")
