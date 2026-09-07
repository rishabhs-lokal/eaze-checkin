"""coin_claims: add eazescore_claimed (tiered coin conversion, full-balance claims)

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing rows predate the tiered conversion (coins_requested was 1:1
    # with the points claimed) — backfill eazescore_claimed from that column
    # so historical rows stay self-consistent, then drop the default.
    op.add_column(
        "coin_claims",
        sa.Column("eazescore_claimed", sa.Integer(), nullable=True),
    )
    op.execute("UPDATE coin_claims SET eazescore_claimed = coins_requested")
    op.alter_column("coin_claims", "eazescore_claimed", nullable=False)


def downgrade() -> None:
    op.drop_column("coin_claims", "eazescore_claimed")
