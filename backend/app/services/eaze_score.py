import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CheckIn, EazeScoreEvent

POINTS_PER_CHECKIN = 10
WEEKLY_STREAK_BONUS = 50
STREAK_TARGET = 7
# One-time-ever, awarded the first time a user's EazeScore home page loads
# (see app/routers/eaze_score.py) — not part of the daily_checkin/streak_bonus
# earn rules, which stay exactly as they were.
WELCOME_BONUS = 20
# Multiple check-ins are allowed per day, each earning POINTS_PER_CHECKIN, as
# long as this much time has passed since the user's last one — a rolling
# cooldown, not a per-calendar-day reset (see next_eligible_at).
CHECKIN_COOLDOWN = timedelta(hours=3)


def compute_streak(dates: set[date], as_of: date) -> int:
    """Length of the consecutive run of dates ending at as_of (0 if as_of itself
    isn't in the set)."""
    streak = 0
    cursor = as_of
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def next_eligible_at(last_checkin_at: datetime | None) -> datetime | None:
    """When this user's next check-in may earn points, per the cooldown. None
    if they've never checked in (always eligible) or the cooldown has passed."""
    if last_checkin_at is None:
        return None
    return last_checkin_at + CHECKIN_COOLDOWN


def evaluate_checkin(existing_dates: set[date], today: date) -> tuple[int, bool, bool]:
    """Streak/bonus logic for one check-in submission, given the user's
    check-in dates from before this request. Returns (streak_after,
    first_of_day, bonus_awarded).

    Points are no longer gated by "first check-in of the day" — the cooldown
    in checkins.py handles that instead, and every check-in that clears it
    earns points. first_of_day only matters for the streak: a day counts once
    towards it regardless of how many check-ins happen within it, so the
    streak-completion bonus should only ever fire on that day's first one.
    """
    first_of_day = today not in existing_dates
    streak_before = compute_streak(existing_dates, today - timedelta(days=1))
    streak_after = compute_streak(existing_dates | {today}, today)
    bonus_awarded = first_of_day and streak_before < STREAK_TARGET and streak_after >= STREAK_TARGET
    return streak_after, first_of_day, bonus_awarded


async def get_check_in_dates(db: AsyncSession, user_id: uuid.UUID) -> set[date]:
    result = await db.execute(select(CheckIn.created_at).where(CheckIn.user_id == user_id))
    return {row[0].date() for row in result.all()}


async def get_last_checkin_at(db: AsyncSession, user_id: uuid.UUID) -> datetime | None:
    result = await db.execute(
        select(func.max(CheckIn.created_at)).where(CheckIn.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_score_totals(db: AsyncSession, user_id: uuid.UUID) -> tuple[int, int]:
    """Returns (earned, claimed) — both derived from the ledger, never a stored
    mutable counter, so a claim can never double-spend the same points."""
    earned_result = await db.execute(
        select(func.coalesce(func.sum(EazeScoreEvent.delta), 0)).where(
            EazeScoreEvent.user_id == user_id,
            EazeScoreEvent.reason.in_(("daily_checkin", "streak_bonus", "welcome_bonus")),
        )
    )
    claimed_result = await db.execute(
        select(func.coalesce(func.sum(-EazeScoreEvent.delta), 0)).where(
            EazeScoreEvent.user_id == user_id,
            EazeScoreEvent.reason == "claim",
        )
    )
    return int(earned_result.scalar_one()), int(claimed_result.scalar_one())


async def get_session_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Number of check-in sessions the user has ever submitted — the count
    shown on the EazeScore home page under the lifetime total."""
    result = await db.execute(
        select(func.count()).select_from(CheckIn).where(CheckIn.user_id == user_id)
    )
    return int(result.scalar_one())


async def get_today_earned(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Sum of today's daily_checkin/streak_bonus events — "today's improvement,"
    shown on the check-in page's EazeScore Daily card. Excludes welcome_bonus,
    which is a one-time home-page event, not a daily one."""
    # created_at is stored naive (UTC-implied, matching every other date
    # comparison in this module) — build a naive boundary to match, or
    # asyncpg rejects comparing an offset-aware value to it.
    today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time())
    result = await db.execute(
        select(func.coalesce(func.sum(EazeScoreEvent.delta), 0)).where(
            EazeScoreEvent.user_id == user_id,
            EazeScoreEvent.reason.in_(("daily_checkin", "streak_bonus")),
            EazeScoreEvent.created_at >= today_start,
        )
    )
    return int(result.scalar_one())
