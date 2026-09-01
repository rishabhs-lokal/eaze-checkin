from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import CoinClaim, EazeScoreEvent, User
from app.schemas import ClaimCreate, ClaimRead, EazeScoreState
from app.services import coin_transfer, eaze_score

router = APIRouter(prefix="/eaze-score", tags=["eaze-score"])


@router.get("/{phone}", response_model=EazeScoreState)
async def get_eaze_score(phone: str, db: AsyncSession = Depends(get_db)) -> EazeScoreState:
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if user is None:
        return EazeScoreState(earned=0, claimed=0, available=0, streak=0)

    earned, claimed = await eaze_score.get_score_totals(db, user.id)
    dates = await eaze_score.get_check_in_dates(db, user.id)

    today = datetime.now(timezone.utc).date()
    streak = eaze_score.compute_streak(dates, today)
    if streak == 0:
        # Not checked in today — still show the run ending yesterday so the
        # streak doesn't visibly drop to 0 until it's actually broken.
        streak = eaze_score.compute_streak(dates, today - timedelta(days=1))

    return EazeScoreState(earned=earned, claimed=claimed, available=earned - claimed, streak=streak)


@router.post("/claim", response_model=ClaimRead, status_code=201)
async def claim_coins(payload: ClaimCreate, db: AsyncSession = Depends(get_db)) -> CoinClaim:
    result = await db.execute(select(User).where(User.phone == payload.phone))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    earned, claimed = await eaze_score.get_score_totals(db, user.id)
    available = earned - claimed
    if payload.amount > available:
        raise HTTPException(
            status_code=400, detail=f"Requested {payload.amount} exceeds available {available}"
        )

    # Ledger deduction is inserted before the transfer is attempted — a failed
    # transfer never undoes it (see coin_claims.status), matching the reference
    # implementations: a claim record must never be missing when coins might
    # already be in flight, and a race on a second concurrent claim should see
    # this deduction already reflected in `available`.
    db.add(EazeScoreEvent(user_id=user.id, delta=-payload.amount, reason="claim"))

    status: str
    provider_ref: str | None
    notes: str | None
    error_message: str | None = None

    if not user.eaze_user_id:
        status, provider_ref, notes = "failed_provider", None, None
        error_message = "No eaze_user_id resolved for this user — cannot address a transfer."
    else:
        try:
            status, provider_ref, notes = await coin_transfer.transfer_coins(
                user.eaze_user_id, payload.amount
            )
        except RuntimeError as exc:
            status, provider_ref, notes = "failed_provider", None, None
            error_message = str(exc)

    claim = CoinClaim(
        user_id=user.id,
        coins_requested=payload.amount,
        status=status,
        provider_ref=provider_ref,
        notes=notes,
        error_message=error_message,
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)

    if status == "failed_provider":
        await coin_transfer.notify_claim_failure(
            payload.phone, payload.amount, error_message or "unknown error"
        )

    return claim
