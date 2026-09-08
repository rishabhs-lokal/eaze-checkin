"""create streak_log table (streak + running mood-selection count per check-in)

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "streak_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("streak", sa.Integer(), nullable=False),
        sa.Column("mood_selection_count", sa.Integer(), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("log_time", sa.Time(), nullable=False),
    )
    op.create_index("ix_streak_log_user_id_log_date", "streak_log", ["user_id", "log_date"])
    op.create_index("ix_streak_log_phone_number", "streak_log", ["phone_number"])


def downgrade() -> None:
    op.drop_index("ix_streak_log_phone_number", table_name="streak_log")
    op.drop_index("ix_streak_log_user_id_log_date", table_name="streak_log")
    op.drop_table("streak_log")
