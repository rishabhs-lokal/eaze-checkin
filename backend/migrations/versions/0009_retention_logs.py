"""create retention_logs table (every check-in visit)

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "retention_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("eazescore_earned", sa.Integer(), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("log_time", sa.Time(), nullable=False),
    )
    op.create_index("ix_retention_logs_user_id_log_date", "retention_logs", ["user_id", "log_date"])
    op.create_index("ix_retention_logs_phone_number", "retention_logs", ["phone_number"])


def downgrade() -> None:
    op.drop_index("ix_retention_logs_phone_number", table_name="retention_logs")
    op.drop_index("ix_retention_logs_user_id_log_date", table_name="retention_logs")
    op.drop_table("retention_logs")
