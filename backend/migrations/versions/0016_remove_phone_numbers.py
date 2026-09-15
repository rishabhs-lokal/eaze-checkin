"""remove phone number collection entirely — eaze_user_id becomes the sole
identifier

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Accounts that only ever logged in via the old typed-phone path have no
    # eaze_user_id and no future value once phone is gone — delete them
    # first so users.eaze_user_id can become NOT NULL below. Cascades to
    # their check_ins/score events/claims/logs via each table's existing
    # ON DELETE CASCADE foreign key.
    op.execute("DELETE FROM users WHERE eaze_user_id IS NULL")

    # users: drop phone, eaze_user_id becomes the sole required identifier.
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_column("users", "phone")
    op.alter_column("users", "eaze_user_id", nullable=False)

    # login_events: unwired table, kept in sync with the model for
    # consistency — drop phone_number, eaze_user_id becomes required, and
    # its composite index moves from (phone_number, created_at) to
    # (eaze_user_id, created_at).
    op.drop_index("ix_login_events_phone_number_created_at", table_name="login_events")
    op.drop_column("login_events", "phone_number")
    op.alter_column("login_events", "eaze_user_id", nullable=False)
    op.create_index(
        "ix_login_events_eaze_user_id_created_at", "login_events", ["eaze_user_id", "created_at"]
    )

    # Every other table below only ever stored phone_number as a
    # denormalized, query-convenience column alongside the real user_id FK
    # — safe to drop outright, nothing else derives from it.
    op.drop_index("ix_login_logs_phone_number", table_name="login_logs")
    op.drop_column("login_logs", "phone_number")

    op.drop_index("ix_retention_logs_phone_number", table_name="retention_logs")
    op.drop_column("retention_logs", "phone_number")

    op.drop_index("ix_text_log_phone_number", table_name="text_log")
    op.drop_column("text_log", "phone_number")

    op.drop_index("ix_mood_log_phone_number", table_name="mood_log")
    op.drop_column("mood_log", "phone_number")

    op.drop_index("ix_streak_log_phone_number", table_name="streak_log")
    op.drop_column("streak_log", "phone_number")

    op.drop_index("ix_eazescore_cumulative_logs_phone_number", table_name="eazescore_cumulative_logs")
    op.drop_column("eazescore_cumulative_logs", "phone_number")

    op.drop_index("ix_checkin_banner_log_phone_number", table_name="checkin_banner_log")
    op.drop_column("checkin_banner_log", "phone_number")


def downgrade() -> None:
    op.add_column("checkin_banner_log", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index("ix_checkin_banner_log_phone_number", "checkin_banner_log", ["phone_number"])

    op.add_column(
        "eazescore_cumulative_logs", sa.Column("phone_number", sa.String(length=20), nullable=True)
    )
    op.create_index(
        "ix_eazescore_cumulative_logs_phone_number", "eazescore_cumulative_logs", ["phone_number"]
    )

    op.add_column("streak_log", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index("ix_streak_log_phone_number", "streak_log", ["phone_number"])

    op.add_column("mood_log", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index("ix_mood_log_phone_number", "mood_log", ["phone_number"])

    op.add_column("text_log", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index("ix_text_log_phone_number", "text_log", ["phone_number"])

    op.add_column("retention_logs", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index("ix_retention_logs_phone_number", "retention_logs", ["phone_number"])

    op.add_column("login_logs", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index("ix_login_logs_phone_number", "login_logs", ["phone_number"])

    op.drop_index("ix_login_events_eaze_user_id_created_at", table_name="login_events")
    op.alter_column("login_events", "eaze_user_id", nullable=True)
    op.add_column("login_events", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index(
        "ix_login_events_phone_number_created_at", "login_events", ["phone_number", "created_at"]
    )

    op.alter_column("users", "eaze_user_id", nullable=True)
    op.add_column("users", sa.Column("phone", sa.String(length=20), nullable=True))
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
