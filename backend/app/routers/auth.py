from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import LoginLog, User
from app.schemas import LoginRequest, UserRead
from app.services import eaze_score
from app.services.users import get_or_create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserRead)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> User:
    """Resolves identity from eaze_user_id alone — the banner link (see
    app.js restoreSession) is the only entry point, and it always supplies
    this directly. No phone number is ever collected or stored.

    The caller-supplied id is trusted outright, not independently verified
    (same trust model as Milestone-Dostt's /auth/login-by-userid). That's
    fine as long as this endpoint is only reachable from inside Eaze's own
    app shell; it is NOT fine if this backend is reachable directly, since
    anyone could POST an arbitrary eaze_user_id and self-assign someone
    else's identity for claiming purposes. No token/signature check exists
    yet — flagged, not silently assumed safe.
    """
    user = await get_or_create_user(db, payload.eaze_user_id)
    await db.commit()
    await db.refresh(user)

    # First-login-only record (see LoginLog) — check-then-insert, not an
    # upsert: this must never be overwritten after the very first login.
    existing_log = await db.execute(select(LoginLog).where(LoginLog.user_id == user.id))
    if existing_log.scalar_one_or_none() is None:
        ist_instant = eaze_score.ist_now()
        db.add(
            LoginLog(
                user_id=user.id,
                first_login_date=ist_instant.date(),
                first_login_time=ist_instant.time(),
            )
        )
        await db.commit()

    return user
