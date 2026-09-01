import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CheckIn, EazeScoreEvent

POINTS_PER_CHECKIN = 10
WEEKLY_STREAK_BONUS = 50
STREAK_TARGET = 7


def compute_streak(dates: set[date], as_of: date) -> int:
    """Length of the consecutive run of dates ending at as_of (0 if as_of itself
    isn't in the set)."""
    streak = 0
    cursor = as_of
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def evaluate_checkin(existing_dates: set[date], today: date) -> tuple[int, bool, bool]:
    """Pure logic for one check-in submission, given the user's check-in dates
    from before this request. Returns (streak_after, award_daily, bonus_awarded).

    award_daily is False when today is already in existing_dates — the row
    still gets created (see checkins.py), but points are only ever awarded
    once per calendar day, mirroring the "one entry per day" intent without
    a hard uniqueness constraint on the check_ins table.
    """
    already_checked_in_today = today in existing_dates
    streak_before = compute_streak(existing_dates, today - timedelta(days=1))
    streak_after = compute_streak(existing_dates | {today}, today)
    award_daily = not already_checked_in_today
    bonus_awarded = award_daily and streak_before < STREAK_TARGET and streak_after >= STREAK_TARGET
    return streak_after, award_daily, bonus_awarded


async def get_check_in_dates(db: AsyncSession, user_id: uuid.UUID) -> set[date]:
    result = await db.execute(select(CheckIn.created_at).where(CheckIn.user_id == user_id))
    return {row[0].date() for row in result.all()}


async def get_score_totals(db: AsyncSession, user_id: uuid.UUID) -> tuple[int, int]:
    """Returns (earned, claimed) — both derived from the ledger, never a stored
    mutable counter, so a claim can never double-spend the same points."""
    earned_result = await db.execute(
        select(func.coalesce(func.sum(EazeScoreEvent.delta), 0)).where(
            EazeScoreEvent.user_id == user_id,
            EazeScoreEvent.reason.in_(("daily_checkin", "streak_bonus")),
        )
    )
    claimed_result = await db.execute(
        select(func.coalesce(func.sum(-EazeScoreEvent.delta), 0)).where(
            EazeScoreEvent.user_id == user_id,
            EazeScoreEvent.reason == "claim",
        )
    )
    return int(earned_result.scalar_one()), int(claimed_result.scalar_one())
