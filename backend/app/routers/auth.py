from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import LoginLog, User
from app.schemas import LoginRequest, PhoneResolveResponse, UserRead
from app.services import eaze_score, redash
from app.services.users import get_or_create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/resolve-phone/{eaze_user_id}", response_model=PhoneResolveResponse)
async def resolve_phone(eaze_user_id: str) -> PhoneResolveResponse:
    """Fallback for banner links that hand over eaze_user_id but omit phone
    (see app.js restoreSession) — looks the phone up via the shared Redash
    query that mirrors production users.mobile_no into the analytics
    warehouse. Always 200s with phone: null rather than 404 when nothing is
    found, so the frontend can treat "not found" and "lookup unavailable"
    identically and fall back to the typed-phone login screen either way.
    """
    phone = await redash.lookup_phone_by_eaze_user_id(eaze_user_id)
    return PhoneResolveResponse(phone=phone)


@router.post("/login", response_model=UserRead)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> User:
    """Resolves identity for both entry points this app has:

    - Banner entry (the real, trusted path): the host Eaze app hands us phone
      AND eaze_user_id together, directly — no lookup of any kind. This is
      the same trust model as Mile-stone-Dostt's /auth/login-by-userid: the
      caller-supplied id is trusted outright, not independently verified.
      That's fine if this endpoint is only ever reachable from inside Eaze's
      own app shell; it is NOT fine if this backend is reachable directly,
      since anyone could POST an arbitrary eaze_user_id and self-assign
      someone else's identity for claiming purposes. No token/signature
      check exists yet — flagged, not silently assumed safe.
    - Typed-phone entry (today's dev/testing path): eaze_user_id is simply
      omitted. The user is created/found by phone exactly as before; claims
      remain unresolvable for them until they arrive via the banner at least
      once, same as pre-migration users in the Dostt reference.
    """
    user = await get_or_create_user(db, payload.phone)
    if payload.eaze_user_id:
        user.eaze_user_id = payload.eaze_user_id
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
                phone_number=payload.phone,
                first_login_date=ist_instant.date(),
                first_login_time=ist_instant.time(),
            )
        )
        await db.commit()

    return user
