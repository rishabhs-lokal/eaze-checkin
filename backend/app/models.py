import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    ForeignKey,
    Index,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

# The +5:30 IST day-boundary offset, inlined into the generated-column SQL
# below — must match app.services.eaze_score.IST_OFFSET exactly (Postgres
# GENERATED expressions can't reference Python constants).
_IST_INTERVAL = "INTERVAL '5 hours 30 minutes'"

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
    login_log: Mapped["LoginLog | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    retention_logs: Mapped[list["RetentionLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    text_logs: Mapped[list["TextLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    mood_logs: Mapped[list["MoodLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    streak_logs: Mapped[list["StreakLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    eazescore_cumulative_logs: Mapped[list["EazeScoreCumulativeLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    checkin_banner_logs: Mapped[list["CheckinBannerLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class CheckIn(Base):
    __tablename__ = "check_ins"
    __table_args__ = (
        CheckConstraint("mood BETWEEN 1 AND 5", name="ck_check_ins_mood_range"),
        Index("ix_check_ins_user_id_created_at", "user_id", "created_at"),
        Index("ix_check_ins_user_id_check_in_date", "user_id", "check_in_date"),
        Index("ix_check_ins_check_in_date", "check_in_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mood: Mapped[int] = mapped_column(nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    # DB-generated (Postgres STORED, see migration 0007) — the IST calendar
    # date and time-of-day bucket this check-in falls on, so streaks, "days
    # checked in," and analytics queries are plain indexed SQL instead of
    # pulling every raw timestamp into Python/JS to derive the same thing.
    # Read-only: never set directly, Postgres computes it from created_at.
    check_in_date: Mapped[date] = mapped_column(
        Date, Computed(f"(created_at + {_IST_INTERVAL})::date", persisted=True), nullable=False
    )
    time_of_day: Mapped[str] = mapped_column(
        String(10),
        Computed(
            f"""
            CASE
              WHEN EXTRACT(HOUR FROM created_at + {_IST_INTERVAL}) >= 5
               AND EXTRACT(HOUR FROM created_at + {_IST_INTERVAL}) < 12 THEN 'morning'
              WHEN EXTRACT(HOUR FROM created_at + {_IST_INTERVAL}) >= 12
               AND EXTRACT(HOUR FROM created_at + {_IST_INTERVAL}) < 17 THEN 'afternoon'
              WHEN EXTRACT(HOUR FROM created_at + {_IST_INTERVAL}) >= 17
               AND EXTRACT(HOUR FROM created_at + {_IST_INTERVAL}) < 21 THEN 'evening'
              ELSE 'night'
            END
            """,
            persisted=True,
        ),
        nullable=False,
    )

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


class LoginLog(Base):
    """One row per user, ever — their first successful login only. Distinct
    from LoginEvent/login_events above (every login, still unwired) — this
    table exists specifically to answer "when did this user first log in,"
    same one-time-ever pattern as users.welcome_bonus_awarded: written once,
    on the first call to POST /auth/login for that user, never updated after.
    Date and time are split into their own columns (not one timestamp) as
    asked, both derived via the app's fixed IST day-boundary convention (see
    app.services.eaze_score.IST_OFFSET) for consistency with everything else."""

    __tablename__ = "login_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    first_login_date: Mapped[date] = mapped_column(Date, nullable=False)
    first_login_time: Mapped[time] = mapped_column(Time, nullable=False)

    user: Mapped["User"] = relationship(back_populates="login_log")


class RetentionLog(Base):
    """One row per check-in *visit* — every time, not just the first (unlike
    LoginLog above). Tracks how much EazeScore that specific visit earned,
    for retention/engagement analysis — written alongside the check-in's own
    eaze_score_events rows (see routers/checkins.py), not derived from them,
    so it stays a plain flat table to query without summing ledger deltas."""

    __tablename__ = "retention_logs"
    __table_args__ = (
        Index("ix_retention_logs_user_id_log_date", "user_id", "log_date"),
        Index("ix_retention_logs_phone_number", "phone_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    eazescore_earned: Mapped[int] = mapped_column(nullable=False)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    log_time: Mapped[time] = mapped_column(Time, nullable=False)

    user: Mapped["User"] = relationship(back_populates="retention_logs")


class TextLog(Base):
    """Verbatim capture of the "Add a note" free-text field — hidden and
    OFF BY DEFAULT. Nothing is ever written here unless
    settings.text_log_enabled is explicitly set to true (see
    routers/checkins.py) — this table existing is the capability being
    ready, not permission to record it. Notes are personal, sometimes
    sensitive reflections; this must never start capturing silently."""

    __tablename__ = "text_log"
    __table_args__ = (
        Index("ix_text_log_user_id_log_date", "user_id", "log_date"),
        Index("ix_text_log_phone_number", "phone_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    log_time: Mapped[time] = mapped_column(Time, nullable=False)

    user: Mapped["User"] = relationship(back_populates="text_logs")


class MoodLog(Base):
    """One row per check-in, logging just the mood value selected that day —
    active by default (unlike TextLog above), for mood-trend analytics
    without needing to query check_ins directly."""

    __tablename__ = "mood_log"
    __table_args__ = (
        CheckConstraint("mood BETWEEN 1 AND 5", name="ck_mood_log_mood_range"),
        Index("ix_mood_log_user_id_log_date", "user_id", "log_date"),
        Index("ix_mood_log_phone_number", "phone_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    mood: Mapped[int] = mapped_column(nullable=False)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    log_time: Mapped[time] = mapped_column(Time, nullable=False)

    user: Mapped["User"] = relationship(back_populates="mood_logs")


class StreakLog(Base):
    """One row per check-in: the user's streak as of that check-in, plus a
    running tally (mood_selection_count) of how many times they've ever
    selected a mood — i.e. total check-ins so far, this one included. Active
    by default, same as MoodLog."""

    __tablename__ = "streak_log"
    __table_args__ = (
        Index("ix_streak_log_user_id_log_date", "user_id", "log_date"),
        Index("ix_streak_log_phone_number", "phone_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    streak: Mapped[int] = mapped_column(nullable=False)
    mood_selection_count: Mapped[int] = mapped_column(nullable=False)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    log_time: Mapped[time] = mapped_column(Time, nullable=False)

    user: Mapped["User"] = relationship(back_populates="streak_logs")


class EazeScoreCumulativeLog(Base):
    """One row per check-in: the user's cumulative (lifetime) EazeScore and
    total session count as of that check-in — same "earned" total the home
    page calls "Your lifetime EazeScore" (never reduced by a claim; see
    eaze_score.get_score_totals), not the claim-resettable available balance."""

    __tablename__ = "eazescore_cumulative_logs"
    __table_args__ = (
        Index("ix_eazescore_cumulative_logs_user_id", "user_id"),
        Index("ix_eazescore_cumulative_logs_phone_number", "phone_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    cumulative_eazescore: Mapped[int] = mapped_column(nullable=False)
    sessions_count: Mapped[int] = mapped_column(nullable=False)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    log_time: Mapped[time] = mapped_column(Time, nullable=False)

    user: Mapped["User"] = relationship(back_populates="eazescore_cumulative_logs")


class CheckinBannerLog(Base):
    """One row every time a user taps the home page's "Ready for today's
    check-in?" banner — i.e. every time they enter the check-in flow from
    there (the home page being the "second page" of the login -> home ->
    checkin flow). Written by POST /checkins/banner-click, called by the
    frontend right when that banner is tapped — real users only, testers
    never hit the backend at all."""

    __tablename__ = "checkin_banner_log"
    __table_args__ = (
        Index("ix_checkin_banner_log_user_id_log_date", "user_id", "log_date"),
        Index("ix_checkin_banner_log_phone_number", "phone_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    log_time: Mapped[time] = mapped_column(Time, nullable=False)

    user: Mapped["User"] = relationship(back_populates="checkin_banner_logs")
