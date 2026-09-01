"""eaze score flow: users gains identity columns, add eaze_score_events, coin_claims, login_events

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("eaze_user_id", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(length=100), nullable=True))
    op.add_column(
        "users",
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_eaze_user_id", "users", ["eaze_user_id"], unique=True)

    op.create_table(
        "eaze_score_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "reason IN ('daily_checkin', 'streak_bonus', 'claim')", name="ck_score_events_reason"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_score_events_user_id_created_at", "eaze_score_events", ["user_id", "created_at"]
    )

    op.create_table(
        "coin_claims",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("coins_requested", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("provider_ref", sa.String(length=200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('submitted', 'success', 'mock_success', 'failed_provider')",
            name="ck_coin_claims_status",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_coin_claims_user_id_created_at", "coin_claims", ["user_id", "created_at"])

    op.create_table(
        "login_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("eaze_user_id", sa.String(length=100), nullable=True),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("login_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_login_events_phone_number_created_at", "login_events", ["phone_number", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_login_events_phone_number_created_at", table_name="login_events")
    op.drop_table("login_events")

    op.drop_index("ix_coin_claims_user_id_created_at", table_name="coin_claims")
    op.drop_table("coin_claims")

    op.drop_index("ix_score_events_user_id_created_at", table_name="eaze_score_events")
    op.drop_table("eaze_score_events")

    op.drop_index("ix_users_eaze_user_id", table_name="users")
    op.drop_column("users", "updated_at")
    op.drop_column("users", "display_name")
    op.drop_column("users", "eaze_user_id")
