from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.schemas import LoginRequest, UserRead
from app.services.users import get_or_create_user

router = APIRouter(prefix="/auth", tags=["auth"])


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
    return user
