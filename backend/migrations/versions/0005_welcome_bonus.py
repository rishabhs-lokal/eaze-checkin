"""users: add welcome_bonus_awarded; eaze_score_events: allow welcome_bonus reason

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "welcome_bonus_awarded", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
    )
    op.drop_constraint("ck_score_events_reason", "eaze_score_events", type_="check")
    op.create_check_constraint(
        "ck_score_events_reason",
        "eaze_score_events",
        "reason IN ('daily_checkin', 'streak_bonus', 'claim', 'welcome_bonus')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_score_events_reason", "eaze_score_events", type_="check")
    op.create_check_constraint(
        "ck_score_events_reason",
        "eaze_score_events",
        "reason IN ('daily_checkin', 'streak_bonus', 'claim')",
    )
    op.drop_column("users", "welcome_bonus_awarded")
