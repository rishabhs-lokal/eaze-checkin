"""create text_log table (hidden, off-by-default note capture)

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "text_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("note_text", sa.Text(), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("log_time", sa.Time(), nullable=False),
    )
    op.create_index("ix_text_log_user_id_log_date", "text_log", ["user_id", "log_date"])
    op.create_index("ix_text_log_phone_number", "text_log", ["phone_number"])


def downgrade() -> None:
    op.drop_index("ix_text_log_phone_number", table_name="text_log")
    op.drop_index("ix_text_log_user_id_log_date", table_name="text_log")
    op.drop_table("text_log")
