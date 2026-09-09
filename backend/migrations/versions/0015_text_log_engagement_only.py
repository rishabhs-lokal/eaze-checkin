"""text_log: replace verbatim note_text with a yes/no engagement flag

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "text_log",
        sa.Column("engaged_with_text", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("text_log", "engaged_with_text", server_default=None)
    op.drop_column("text_log", "note_text")


def downgrade() -> None:
    op.add_column(
        "text_log",
        sa.Column("note_text", sa.Text(), nullable=False, server_default=""),
    )
    op.alter_column("text_log", "note_text", server_default=None)
    op.drop_column("text_log", "engaged_with_text")
