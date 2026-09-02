"""coin_claims: add identity_unresolved status, distinct from failed_provider

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-02

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_coin_claims_status", "coin_claims", type_="check")
    op.create_check_constraint(
        "ck_coin_claims_status",
        "coin_claims",
        "status IN ('submitted', 'success', 'mock_success', 'failed_provider', 'identity_unresolved')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_coin_claims_status", "coin_claims", type_="check")
    op.create_check_constraint(
        "ck_coin_claims_status",
        "coin_claims",
        "status IN ('submitted', 'success', 'mock_success', 'failed_provider')",
    )
