from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import CheckIn, User
from app.schemas import CheckInCreate, CheckInRead

router = APIRouter(prefix="/checkins", tags=["checkins"])


async def _get_or_create_user(db: AsyncSession, phone: str) -> User:
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(phone=phone)
        db.add(user)
        await db.flush()
    return user


@router.post("", response_model=CheckInRead, status_code=201)
async def create_check_in(payload: CheckInCreate, db: AsyncSession = Depends(get_db)) -> CheckIn:
    user = await _get_or_create_user(db, payload.phone)
    check_in = CheckIn(user_id=user.id, mood=payload.mood, note=payload.note)
    db.add(check_in)
    await db.commit()
    await db.refresh(check_in)
    return check_in


@router.get("/{phone}", response_model=list[CheckInRead])
async def list_check_ins(phone: str, db: AsyncSession = Depends(get_db)) -> list[CheckIn]:
    result = await db.execute(
        select(CheckIn).join(User).where(User.phone == phone).order_by(CheckIn.created_at)
    )
    return list(result.scalars().all())
