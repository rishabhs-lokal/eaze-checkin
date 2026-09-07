import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    # Real Eaze account id — resolved via a phone lookup at registration time.
    # Nullable: stays null until that lookup succeeds. Required to address the
    # real coin-transfer API, which is keyed by this id, not phone.
    eaze_user_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # One-time-ever flag, same pattern as a permanent eligibility snapshot —
    # set the instant the bonus is awarded, never re-derived, so it can never
    # be paid out twice regardless of how many times the home page is loaded.
    welcome_bonus_awarded: Mapped[bool] = mapped_column(
        Boolean, server_default="false", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    check_ins: Mapped[list["CheckIn"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    score_events: Mapped[list["EazeScoreEvent"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    coin_claims: Mapped[list["CoinClaim"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class CheckIn(Base):
    __tablename__ = "check_ins"
    __table_args__ = (
        CheckConstraint("mood BETWEEN 1 AND 5", name="ck_check_ins_mood_range"),
        Index("ix_check_ins_user_id_created_at", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mood: Mapped[int] = mapped_column(nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="check_ins")


class EazeScoreEvent(Base):
    """Append-only ledger of every EazeScore change — earns and claims alike.

    Available-to-claim is never a stored counter; it's derived by summing this
    table (see app/services/eaze_score.py), so a claim can never double-spend
    the same points and every change stays auditable.
    """

    __tablename__ = "eaze_score_events"
    __table_args__ = (
        CheckConstraint(
            "reason IN ('daily_checkin', 'streak_bonus', 'claim', 'welcome_bonus')",
            name="ck_score_events_reason",
        ),
        Index("ix_score_events_user_id_created_at", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    delta: Mapped[int] = mapped_column(nullable=False)
    reason: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="score_events")


class CoinClaim(Base):
    """One row per claim/transfer attempt — mirrors the ledger's 'claim' event
    but tracks the external wallet-transfer outcome specifically."""

    __tablename__ = "coin_claims"
    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted', 'success', 'mock_success', 'failed_provider', 'identity_unresolved')",
            name="ck_coin_claims_status",
        ),
        Index("ix_coin_claims_user_id_created_at", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # The full EazeScore balance this claim zeroed out — distinct from
    # coins_requested since the conversion is no longer 1:1 (see
    # eaze_score.compute_coins).
    eazescore_claimed: Mapped[int] = mapped_column(nullable=False)
    coins_requested: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    provider_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="coin_claims")


class LoginEvent(Base):
    """One row per successful phone-number login — separate from the score
    ledger, pure activity tracking."""

    __tablename__ = "login_events"
    __table_args__ = (Index("ix_login_events_phone_number_created_at", "phone_number", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Nullable like users.eaze_user_id — a login can happen before identity
    # resolution succeeds.
    eaze_user_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    login_at: Mapped[datetime] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
