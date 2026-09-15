from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


async def get_or_create_user(db: AsyncSession, eaze_user_id: str) -> User:
    result = await db.execute(select(User).where(User.eaze_user_id == eaze_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(eaze_user_id=eaze_user_id)
        db.add(user)
        await db.flush()
    return user
