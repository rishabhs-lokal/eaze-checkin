"""create mood_log table (one row per check-in's mood)

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mood_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("mood", sa.Integer(), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("log_time", sa.Time(), nullable=False),
        sa.CheckConstraint("mood BETWEEN 1 AND 5", name="ck_mood_log_mood_range"),
    )
    op.create_index("ix_mood_log_user_id_log_date", "mood_log", ["user_id", "log_date"])
    op.create_index("ix_mood_log_phone_number", "mood_log", ["phone_number"])


def downgrade() -> None:
    op.drop_index("ix_mood_log_phone_number", table_name="mood_log")
    op.drop_index("ix_mood_log_user_id_log_date", table_name="mood_log")
    op.drop_table("mood_log")
