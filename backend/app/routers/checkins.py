from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import CheckIn, EazeScoreEvent, User
from app.schemas import CheckInCreate, CheckInRead, CheckInResult, EazeScoreState
from app.services import eaze_score, shared_ledger
from app.services.users import get_or_create_user

router = APIRouter(prefix="/checkins", tags=["checkins"])


@router.post("", response_model=CheckInResult, status_code=201)
async def create_check_in(payload: CheckInCreate, db: AsyncSession = Depends(get_db)) -> CheckInResult:
    user = await get_or_create_user(db, payload.phone)

    existing_dates = await eaze_score.get_check_in_dates(db, user.id)
    today = datetime.now(timezone.utc).date()
    streak_after, award_daily, bonus_awarded = eaze_score.evaluate_checkin(existing_dates, today)

    check_in = CheckIn(user_id=user.id, mood=payload.mood, note=payload.note)
    db.add(check_in)

    if award_daily:
        db.add(
            EazeScoreEvent(
                user_id=user.id, delta=eaze_score.POINTS_PER_CHECKIN, reason="daily_checkin"
            )
        )
        if bonus_awarded:
            db.add(
                EazeScoreEvent(
                    user_id=user.id, delta=eaze_score.WEEKLY_STREAK_BONUS, reason="streak_bonus"
                )
            )

    await db.commit()
    await db.refresh(check_in)

    # Mirrored into the shared cross-app ledger after the local commit
    # succeeds, so this app's own record of the check-in is never at risk of
    # being lost to a slow/unreachable dependency. eaze_user_id is the raw
    # phone number, unchanged — must match eaze-level-up's key exactly.
    if award_daily:
        await shared_ledger.report_to_shared_ledger(
            eaze_user_id=payload.phone, event_type="daily_checkin", points=eaze_score.POINTS_PER_CHECKIN,
        )
        if bonus_awarded:
            await shared_ledger.report_to_shared_ledger(
                eaze_user_id=payload.phone, event_type="streak_bonus", points=eaze_score.WEEKLY_STREAK_BONUS,
            )

    earned, claimed = await eaze_score.get_score_totals(db, user.id)
    sessions_count = await eaze_score.get_session_count(db, user.id)
    today_earned = await eaze_score.get_today_earned(db, user.id)
    return CheckInResult(
        check_in=CheckInRead.model_validate(check_in),
        score=EazeScoreState(
            earned=earned,
            claimed=claimed,
            available=earned - claimed,
            streak=streak_after,
            sessions_count=sessions_count,
            today_earned=today_earned,
        ),
        streak_bonus_awarded=bonus_awarded,
    )


@router.get("/{phone}", response_model=list[CheckInRead])
async def list_check_ins(phone: str, db: AsyncSession = Depends(get_db)) -> list[CheckIn]:
    result = await db.execute(
        select(CheckIn).join(User).where(User.phone == phone).order_by(CheckIn.created_at)
    )
    return list(result.scalars().all())
