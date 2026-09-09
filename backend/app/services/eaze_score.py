import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CheckIn, EazeScoreEvent

# Fixed day-boundary convention for this whole app — "today," streaks, and
# every check-in's calendar date are all IST, regardless of server or device
# timezone (matches what the frontend shows users, who are IST-based). Every
# timestamp in the DB stays stored as naive UTC; IST is only ever applied at
# the point of deriving a *date* from one, via to_ist_date/ist_today below —
# never change how created_at itself is stored.
IST_OFFSET = timedelta(hours=5, minutes=30)

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

# EazeScore -> coin conversion, tiered rather than 1:1. The first
# HALFWAY_THRESHOLD points of a claim convert at LOW_RATE; anything beyond
# that converts at HIGH_RATE — a claim always empties the full available
# balance (see claim_coins in routers/eaze_score.py), never a partial amount,
# so "available" resets to exactly 0 and starts accumulating fresh from there.
HALFWAY_THRESHOLD = 250
LOW_RATE = 0.5
HIGH_RATE = 1.0


def compute_coins(score: int) -> int:
    """EazeScore -> coins at claim time. Rounds half up to a whole coin (e.g.
    an odd score at the 0.5 rate lands on a X.5 coin value, which rounds up,
    not down) — int(x + 0.5) rather than round(), since Python's round()
    banker's-rounds X.5 to the nearest *even* int, which would round some
    X.5 values down."""
    if score <= 0:
        return 0
    if score <= HALFWAY_THRESHOLD:
        coins = score * LOW_RATE
    else:
        coins = HALFWAY_THRESHOLD * LOW_RATE + (score - HALFWAY_THRESHOLD) * HIGH_RATE
    return int(coins + 0.5)


def to_ist_date(utc_naive: datetime) -> date:
    """The IST calendar date a naive-UTC timestamp falls on."""
    return (utc_naive + IST_OFFSET).date()


def ist_today(now_utc_naive: datetime | None = None) -> date:
    """Today's IST calendar date. Pass an explicit naive-UTC `now` (e.g. one
    already computed by the caller) to avoid a second, possibly-inconsistent
    clock read within the same request; omit it to read the clock here."""
    now = now_utc_naive if now_utc_naive is not None else datetime.now(timezone.utc).replace(tzinfo=None)
    return to_ist_date(now)


def ist_midnight_utc(ist_date: date) -> datetime:
    """The naive-UTC instant corresponding to IST midnight on the given IST
    date — for range comparisons against created_at (stored naive-UTC)."""
    return datetime(ist_date.year, ist_date.month, ist_date.day) - IST_OFFSET


def ist_now(now_utc_naive: datetime | None = None) -> datetime:
    """The current instant as an IST wall-clock naive datetime — for
    splitting into separate (date, time) columns, e.g. login_logs."""
    now = now_utc_naive if now_utc_naive is not None else datetime.now(timezone.utc).replace(tzinfo=None)
    return now + IST_OFFSET


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
    # check_in_date is a DB-generated column (IST calendar date, see the
    # model) — a plain indexed SELECT DISTINCT instead of pulling every raw
    # timestamp and converting in Python.
    result = await db.execute(
        select(CheckIn.check_in_date).where(CheckIn.user_id == user_id).distinct()
    )
    return {row[0] for row in result.all()}


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
    # eaze_score_events has no check_in_date column of its own (it's not a
    # check-in), so "today" is still derived here — via the same IST
    # boundary as everywhere else, translated back to a naive-UTC instant to
    # compare against created_at (stored naive-UTC).
    today_start = ist_midnight_utc(ist_today())
    result = await db.execute(
        select(func.coalesce(func.sum(EazeScoreEvent.delta), 0)).where(
            EazeScoreEvent.user_id == user_id,
            EazeScoreEvent.reason.in_(("daily_checkin", "streak_bonus")),
            EazeScoreEvent.created_at >= today_start,
        )
    )
    return int(result.scalar_one())
