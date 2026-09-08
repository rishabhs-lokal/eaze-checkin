"""create checkin_banner_log table (home-page banner click-throughs)

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "checkin_banner_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("log_time", sa.Time(), nullable=False),
    )
    op.create_index("ix_checkin_banner_log_user_id_log_date", "checkin_banner_log", ["user_id", "log_date"])
    op.create_index("ix_checkin_banner_log_phone_number", "checkin_banner_log", ["phone_number"])


def downgrade() -> None:
    op.drop_index("ix_checkin_banner_log_phone_number", table_name="checkin_banner_log")
    op.drop_index("ix_checkin_banner_log_user_id_log_date", table_name="checkin_banner_log")
    op.drop_table("checkin_banner_log")
