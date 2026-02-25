from fastapi import APIRouter, HTTPException, Header, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import os
from github import Github, GithubException
from Controller.models import GitHubAuthResponse
import httpx

from Database.connection import get_db_session
from Database.repositories import user_repo

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
async def github_callback(code: str, db: AsyncSession = Depends(get_db_session)):
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
        github_user = g.get_user()

        github_data = {
            "id":         github_user.id,
            "login":      github_user.login,
            "name":       github_user.name,
            "email":      github_user.email,
            "avatar_url": github_user.avatar_url,
            "html_url":   github_user.html_url,
        }

        # Persist / update the user record in PostgreSQL
        try:
            db_user = await user_repo.upsert_github_user(db, github_data)
            user_id = str(db_user.id)
        except Exception:
            user_id = None   # non-fatal — don't block the login flow

        return GitHubAuthResponse(
            access_token=access_token,
            user={
                "id":         github_user.id,
                "internal_id": user_id,
                "login":      github_user.login,
                "name":       github_user.name,
                "email":      github_user.email,
                "avatar_url": github_user.avatar_url,
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
