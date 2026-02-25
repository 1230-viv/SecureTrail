"""
User Repository — SecureTrail
Handles upsert and lookup of OAuth-authenticated users.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from Database.models import User
from Utils.logger import get_logger

logger = get_logger("database.user_repo")


async def upsert_github_user(db: AsyncSession, github_data: dict[str, Any]) -> User:
    """
    Insert or update a GitHub OAuth user.

    On conflict (github_id already exists) the row is updated with the latest
    profile data and last_login_at is refreshed.  Returns the full ORM object.
    """
    now = datetime.now(timezone.utc)
    github_id: int = int(github_data["id"])

    stmt = (
        pg_insert(User)
        .values(
            id=uuid.uuid4(),
            github_id=github_id,
            provider="github",
            login=github_data.get("login"),
            name=github_data.get("name"),
            email=github_data.get("email"),
            avatar_url=github_data.get("avatar_url"),
            html_url=github_data.get("html_url"),
            is_active=True,
            created_at=now,
            last_login_at=now,
        )
        .on_conflict_do_update(
            index_elements=["github_id"],
            set_={
                "login":          github_data.get("login"),
                "name":           github_data.get("name"),
                "email":          github_data.get("email"),
                "avatar_url":     github_data.get("avatar_url"),
                "html_url":       github_data.get("html_url"),
                "is_active":      True,
                "last_login_at":  now,
            },
        )
        .returning(User)
    )

    result = await db.execute(stmt)
    user = result.scalar_one()
    logger.info("Upserted GitHub user login=%r id=%s", user.login, user.id)
    return user


async def get_user_by_github_id(db: AsyncSession, github_id: int) -> User | None:
    """Return the User row matching the given GitHub numeric ID, or None."""
    result = await db.execute(
        select(User).where(User.github_id == github_id)
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Return the User row matching the given internal UUID, or None."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    return result.scalar_one_or_none()


async def update_last_login(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Touch last_login_at without loading the full ORM object."""
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(last_login_at=datetime.now(timezone.utc))
    )
