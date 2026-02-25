from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os
from github import Github, GithubException
from Controller.models import GitHubAuthResponse
import httpx

router = APIRouter()

@router.get("/github/login")
async def github_login():
    """Get GitHub OAuth login URL"""
    client_id = os.getenv("GITHUB_CLIENT_ID")
    redirect_uri = os.getenv("GITHUB_REDIRECT_URI")
    
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
    
    auth_url = f"https://github.com/login/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&scope=repo,user"
    
    return {"auth_url": auth_url}

@router.get("/github/callback")
async def github_callback(code: str):
    """Handle GitHub OAuth callback"""
    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
    
    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get access token")
        
        token_data = response.json()
        access_token = token_data.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token received")
    
    # Get user info
    try:
        g = Github(access_token)
        user = g.get_user()
        
        return GitHubAuthResponse(
            access_token=access_token,
            user={
                "id": user.id,
                "login": user.login,
                "name": user.name,
                "email": user.email,
                "avatar_url": user.avatar_url
            }
        )
    except GithubException as e:
        raise HTTPException(status_code=400, detail=f"GitHub API error: {str(e)}")

@router.get("/google/login")
async def google_login():
    """Get Google OAuth login URL"""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    
    if not client_id:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile"
    )
    
    return {"auth_url": auth_url}

@router.post("/logout")
async def logout():
    """Logout user"""
    return {"message": "Logged out successfully"}
