from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from github import Github, GithubException
from Controller.models import Repository

router = APIRouter()

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
        
        repository_list = []
        for repo in repos[:50]:  # Limit to 50 most recent repos
            repository_list.append(Repository(
                id=repo.id,
                name=repo.name,
                full_name=repo.full_name,
                description=repo.description,
                private=repo.private,
                html_url=repo.html_url,
                default_branch=repo.default_branch,
                language=repo.language,
                updated_at=repo.updated_at.isoformat()
            ))
        
        return repository_list
    
    except GithubException as e:
        raise HTTPException(status_code=400, detail=f"GitHub API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@router.post("/clone")
async def clone_repository(
    repo_full_name: str,
    branch: str = "main",
    authorization: Optional[str] = Header(None)
):
    """Clone a GitHub repository"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    access_token = authorization.replace("Bearer ", "")
    
    try:
        g = Github(access_token)
        repo = g.get_repo(repo_full_name)
        
        # Here you would implement actual cloning logic
        # For now, we'll return success with repo info
        
        return {
            "success": True,
            "message": f"Repository {repo.name} queued for analysis",
            "repository": {
                "name": repo.name,
                "branch": branch,
                "url": repo.clone_url
            }
        }
    
    except GithubException as e:
        raise HTTPException(status_code=400, detail=f"GitHub API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
