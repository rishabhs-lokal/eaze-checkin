"""create login_logs table (first-login-only tracking)

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "login_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("first_login_date", sa.Date(), nullable=False),
        sa.Column("first_login_time", sa.Time(), nullable=False),
    )
    op.create_index("ix_login_logs_phone_number", "login_logs", ["phone_number"])


def downgrade() -> None:
    op.drop_index("ix_login_logs_phone_number", table_name="login_logs")
    op.drop_table("login_logs")
