"""create eazescore_cumulative_logs table (cumulative EazeScore + session count per check-in)

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "eazescore_cumulative_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("cumulative_eazescore", sa.Integer(), nullable=False),
        sa.Column("sessions_count", sa.Integer(), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("log_time", sa.Time(), nullable=False),
    )
    op.create_index(
        "ix_eazescore_cumulative_logs_user_id", "eazescore_cumulative_logs", ["user_id"]
    )
    op.create_index(
        "ix_eazescore_cumulative_logs_phone_number", "eazescore_cumulative_logs", ["phone_number"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_eazescore_cumulative_logs_phone_number", table_name="eazescore_cumulative_logs"
    )
    op.drop_index("ix_eazescore_cumulative_logs_user_id", table_name="eazescore_cumulative_logs")
    op.drop_table("eazescore_cumulative_logs")
