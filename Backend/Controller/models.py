from pydantic import BaseModel
from typing import Optional, List

class GitHubAuthRequest(BaseModel):
    code: str

class GitHubAuthResponse(BaseModel):
    access_token: str
    user: dict

class Repository(BaseModel):
    id: int
    name: str
    full_name: str
    description: Optional[str]
    private: bool
    html_url: str
    default_branch: str
    language: Optional[str]
    updated_at: str

class UploadResponse(BaseModel):
    success: bool
    message: str
    repository_name: Optional[str] = None
    files_count: Optional[int] = None
