import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    eaze_user_id: str | None
    created_at: datetime


class LoginRequest(BaseModel):
    phone: str = Field(min_length=1, max_length=20)
    # Supplied directly by the banner/host app — never looked up. See
    # app/routers/auth.py for why no external lookup is involved.
    eaze_user_id: str | None = Field(default=None, max_length=100)


class CheckInCreate(BaseModel):
    phone: str = Field(min_length=1, max_length=20)
    mood: int = Field(ge=1, le=5)
    note: str | None = Field(default=None, max_length=2000)


class CheckInRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    mood: int
    note: str | None
    created_at: datetime


class EazeScoreState(BaseModel):
    earned: int
    claimed: int
    available: int
    streak: int
    sessions_count: int = 0
    today_earned: int = 0
    welcome_bonus_awarded_now: bool = False
    # Whether today already has at least one check-in — drives the streak
    # dot's filled/pending state, independent of the cooldown below (a user
    # can be checked in for today and still be on cooldown for their next one).
    checked_in_today: bool = False
    # None means eligible right now; otherwise the ISO timestamp (UTC) of
    # when this user's next check-in will next earn points.
    next_checkin_at: datetime | None = None


class CheckInResult(BaseModel):
    check_in: CheckInRead
    score: EazeScoreState
    streak_bonus_awarded: bool


class BannerClickCreate(BaseModel):
    phone: str = Field(min_length=1, max_length=20)


class ClaimCreate(BaseModel):
    phone: str = Field(min_length=1, max_length=20)
    # No amount — a claim always takes the full available EazeScore balance,
    # converted via the tiered rate, never a partial user-chosen amount.


class ClaimRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    eazescore_claimed: int
    coins_requested: int
    status: str
    provider_ref: str | None
    notes: str | None
    error_message: str | None
    created_at: datetime
