from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import CoinClaim, EazeScoreEvent, User
from app.schemas import ClaimCreate, ClaimRead, EazeScoreState
from app.services import coin_transfer, eaze_score

router = APIRouter(prefix="/eaze-score", tags=["eaze-score"])


@router.get("/{eaze_user_id}", response_model=EazeScoreState)
async def get_eaze_score(eaze_user_id: str, db: AsyncSession = Depends(get_db)) -> EazeScoreState:
    result = await db.execute(select(User).where(User.eaze_user_id == eaze_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return EazeScoreState(earned=0, claimed=0, available=0, streak=0)

    # One-time-ever welcome bonus — awarded the first time this endpoint is
    # ever called for this user (i.e. their first visit to the EazeScore home
    # page), never re-derived afterward. Idempotent: welcome_bonus_awarded is
    # set in the same commit as the ledger row, so a page reload never pays
    # this out twice.
    welcome_bonus_awarded_now = False
    if not user.welcome_bonus_awarded:
        db.add(EazeScoreEvent(user_id=user.id, delta=eaze_score.WELCOME_BONUS, reason="welcome_bonus"))
        user.welcome_bonus_awarded = True
        await db.commit()
        welcome_bonus_awarded_now = True

    earned, claimed = await eaze_score.get_score_totals(db, user.id)
    dates = await eaze_score.get_check_in_dates(db, user.id)
    sessions_count = await eaze_score.get_session_count(db, user.id)
    today_earned = await eaze_score.get_today_earned(db, user.id)
    last_checkin_at = await eaze_score.get_last_checkin_at(db, user.id)

    today = eaze_score.ist_today()
    checked_in_today = today in dates
    streak = eaze_score.compute_streak(dates, today)
    if streak == 0:
        # Not checked in today — still show the run ending yesterday so the
        # streak doesn't visibly drop to 0 until it's actually broken.
        streak = eaze_score.compute_streak(dates, today - timedelta(days=1))

    return EazeScoreState(
        earned=earned,
        claimed=claimed,
        available=earned - claimed,
        streak=streak,
        sessions_count=sessions_count,
        today_earned=today_earned,
        welcome_bonus_awarded_now=welcome_bonus_awarded_now,
        checked_in_today=checked_in_today,
        next_checkin_at=eaze_score.next_eligible_at(last_checkin_at),
    )


@router.post("/claim", response_model=ClaimRead, status_code=201)
async def claim_coins(payload: ClaimCreate, db: AsyncSession = Depends(get_db)) -> CoinClaim:
    result = await db.execute(select(User).where(User.eaze_user_id == payload.eaze_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    earned, claimed = await eaze_score.get_score_totals(db, user.id)
    available = earned - claimed
    if available <= 0:
        raise HTTPException(status_code=400, detail="No EazeScore available to claim")

    # Tiered, not 1:1 — see eaze_score.compute_coins. A claim always takes the
    # full available balance; there's no partial-amount claim anymore.
    coins = eaze_score.compute_coins(available)

    # Ledger deduction is inserted before the transfer is attempted — a failed
    # transfer never undoes it (see coin_claims.status), matching the reference
    # implementations: a claim record must never be missing when coins might
    # already be in flight, and a race on a second concurrent claim should see
    # this deduction already reflected in `available`. Deducting the full
    # `available` amount is what "resets EazeScore to 0" — earned stays an
    # untouched lifetime audit trail, only available drops to exactly 0.
    db.add(EazeScoreEvent(user_id=user.id, delta=-available, reason="claim"))

    # eaze_user_id is always present now (the sole login identifier — see
    # User.eaze_user_id), so every claim attempts a real transfer. The old
    # "identity_unresolved" status is still a valid historical value in
    # coin_claims.status (see migration 0016) but new claims never produce it.
    status: str
    provider_ref: str | None
    notes: str | None
    error_message: str | None = None
    try:
        status, provider_ref, notes = await coin_transfer.transfer_coins(user.eaze_user_id, coins)
    except RuntimeError as exc:
        status, provider_ref, notes = "failed_provider", None, None
        error_message = str(exc)

    claim = CoinClaim(
        user_id=user.id,
        eazescore_claimed=available,
        coins_requested=coins,
        status=status,
        provider_ref=provider_ref,
        notes=notes,
        error_message=error_message,
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)

    return claim
