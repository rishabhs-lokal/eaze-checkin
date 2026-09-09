from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.models import (
    CheckIn,
    CheckinBannerLog,
    EazeScoreCumulativeLog,
    EazeScoreEvent,
    MoodLog,
    RetentionLog,
    StreakLog,
    TextLog,
    User,
)
from app.schemas import BannerClickCreate, CheckInCreate, CheckInRead, CheckInResult, EazeScoreState
from app.services import eaze_score, shared_ledger
from app.services.users import get_or_create_user

router = APIRouter(prefix="/checkins", tags=["checkins"])


@router.post("", response_model=CheckInResult, status_code=201)
async def create_check_in(payload: CheckInCreate, db: AsyncSession = Depends(get_db)) -> CheckInResult:
    user = await get_or_create_user(db, payload.phone)

    # Naive UTC, matching how created_at is stored (see get_today_earned) —
    # comparisons against DB timestamps need both sides naive.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    last_checkin_at = await eaze_score.get_last_checkin_at(db, user.id)
    next_eligible = eaze_score.next_eligible_at(last_checkin_at)
    if next_eligible is not None and now < next_eligible:
        raise HTTPException(
            status_code=429,
            detail=f"Next check-in available at {next_eligible.isoformat()}Z",
        )

    existing_dates = await eaze_score.get_check_in_dates(db, user.id)
    today = eaze_score.ist_today(now)
    streak_after, first_of_day, bonus_awarded = eaze_score.evaluate_checkin(existing_dates, today)
    # Read before this check-in/its events are added, so the deltas below
    # land exactly on this one.
    prior_mood_selection_count = await eaze_score.get_session_count(db, user.id)
    prior_earned, _prior_claimed = await eaze_score.get_score_totals(db, user.id)

    check_in = CheckIn(user_id=user.id, mood=payload.mood, note=payload.note)
    db.add(check_in)

    # Every check-in that clears the cooldown above earns points — no longer
    # gated to once per calendar day (see CHECKIN_COOLDOWN).
    db.add(
        EazeScoreEvent(user_id=user.id, delta=eaze_score.POINTS_PER_CHECKIN, reason="daily_checkin")
    )
    if bonus_awarded:
        db.add(
            EazeScoreEvent(
                user_id=user.id, delta=eaze_score.WEEKLY_STREAK_BONUS, reason="streak_bonus"
            )
        )

    # Retention tracking — one row every visit (not just the first, unlike
    # LoginLog), recording exactly how much this specific check-in earned.
    earned_this_visit = eaze_score.POINTS_PER_CHECKIN + (
        eaze_score.WEEKLY_STREAK_BONUS if bonus_awarded else 0
    )
    ist_instant = eaze_score.ist_now(now)
    db.add(
        RetentionLog(
            user_id=user.id,
            phone_number=payload.phone,
            eazescore_earned=earned_this_visit,
            log_date=ist_instant.date(),
            log_time=ist_instant.time(),
        )
    )

    # Mood tracking — one row every check-in, active by default (unlike
    # TextLog below).
    db.add(
        MoodLog(
            user_id=user.id,
            phone_number=payload.phone,
            mood=payload.mood,
            log_date=ist_instant.date(),
            log_time=ist_instant.time(),
        )
    )

    # Streak tracking — one row every check-in: the streak as of this
    # check-in, plus a running tally of how many times this user has ever
    # selected a mood (this check-in included).
    db.add(
        StreakLog(
            user_id=user.id,
            phone_number=payload.phone,
            streak=streak_after,
            mood_selection_count=prior_mood_selection_count + 1,
            log_date=ist_instant.date(),
            log_time=ist_instant.time(),
        )
    )

    # Cumulative EazeScore tracking — one row every check-in: the lifetime
    # "earned" total (never reduced by a claim) and total session count, both
    # as of this check-in.
    db.add(
        EazeScoreCumulativeLog(
            user_id=user.id,
            phone_number=payload.phone,
            cumulative_eazescore=prior_earned + earned_this_visit,
            sessions_count=prior_mood_selection_count + 1,
            log_date=ist_instant.date(),
            log_time=ist_instant.time(),
        )
    )

    # Engagement-only — records whether a note was written, never the note's
    # text itself. Logged every check-in, gated by settings.text_log_enabled.
    if get_settings().text_log_enabled:
        db.add(
            TextLog(
                user_id=user.id,
                phone_number=payload.phone,
                engaged_with_text=bool(payload.note),
                log_date=ist_instant.date(),
                log_time=ist_instant.time(),
            )
        )

    await db.commit()
    await db.refresh(check_in)

    # Mirrored into the shared cross-app ledger after the local commit
    # succeeds, so this app's own record of the check-in is never at risk of
    # being lost to a slow/unreachable dependency. eaze_user_id is the raw
    # phone number, unchanged — must match eaze-level-up's key exactly.
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
            checked_in_today=True,
            next_checkin_at=eaze_score.next_eligible_at(check_in.created_at),
        ),
        streak_bonus_awarded=bonus_awarded,
    )


@router.post("/banner-click", status_code=204)
async def log_banner_click(payload: BannerClickCreate, db: AsyncSession = Depends(get_db)) -> None:
    """Logs one row every time a user taps the home page's "Ready for
    today's check-in?" banner (see CheckinBannerLog) — called by the
    frontend right at that click, real users only. Fire-and-forget by
    design: this never blocks or fails the navigation it's tracking."""
    user = await get_or_create_user(db, payload.phone)
    ist_instant = eaze_score.ist_now()
    db.add(
        CheckinBannerLog(
            user_id=user.id,
            phone_number=payload.phone,
            log_date=ist_instant.date(),
            log_time=ist_instant.time(),
        )
    )
    await db.commit()


# Caps how much history one fetch returns — the UI only ever needs the last
# 7 days for the overview plus whatever the drilled-into day has, so this is
# a generous ceiling against unbounded growth, not a meaningful limit today.
CHECKIN_HISTORY_LIMIT = 200


@router.get("/{phone}", response_model=list[CheckInRead])
async def list_check_ins(phone: str, db: AsyncSession = Depends(get_db)) -> list[CheckIn]:
    result = await db.execute(
        select(CheckIn)
        .join(User)
        .where(User.phone == phone)
        .order_by(CheckIn.created_at.desc())
        .limit(CHECKIN_HISTORY_LIMIT)
    )
    return list(result.scalars().all())
