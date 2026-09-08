"""check_ins: add generated check_in_date/time_of_day (IST) + indexes; daily_mood_summary view

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-07

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Must match app.services.eaze_score.IST_OFFSET / app.models._IST_INTERVAL —
# the fixed day-boundary convention this whole app uses (see that module's
# docstring for why: users are IST-based, so "today"/streaks/check-in dates
# all derive from IST regardless of server or device timezone).
IST_INTERVAL = "INTERVAL '5 hours 30 minutes'"


def upgrade() -> None:
    op.execute(
        f"""
        ALTER TABLE check_ins
        ADD COLUMN check_in_date date
        GENERATED ALWAYS AS ((created_at + {IST_INTERVAL})::date) STORED
        """
    )
    op.execute(
        f"""
        ALTER TABLE check_ins
        ADD COLUMN time_of_day varchar(10)
        GENERATED ALWAYS AS (
          CASE
            WHEN EXTRACT(HOUR FROM created_at + {IST_INTERVAL}) >= 5
             AND EXTRACT(HOUR FROM created_at + {IST_INTERVAL}) < 12 THEN 'morning'
            WHEN EXTRACT(HOUR FROM created_at + {IST_INTERVAL}) >= 12
             AND EXTRACT(HOUR FROM created_at + {IST_INTERVAL}) < 17 THEN 'afternoon'
            WHEN EXTRACT(HOUR FROM created_at + {IST_INTERVAL}) >= 17
             AND EXTRACT(HOUR FROM created_at + {IST_INTERVAL}) < 21 THEN 'evening'
            ELSE 'night'
          END
        ) STORED
        """
    )
    op.create_index("ix_check_ins_user_id_check_in_date", "check_ins", ["user_id", "check_in_date"])
    op.create_index("ix_check_ins_check_in_date", "check_ins", ["check_in_date"])

    # Per-user, per-IST-day mood aggregate — a plain view (not materialized,
    # so it's never stale) that turns "average mood per day" from a client-
    # side reduction over raw rows into a single indexed group-by.
    op.execute(
        """
        CREATE VIEW daily_mood_summary AS
        SELECT
          user_id,
          check_in_date,
          COUNT(*) AS checkin_count,
          ROUND(AVG(mood)::numeric, 2) AS avg_mood,
          MIN(mood) AS min_mood,
          MAX(mood) AS max_mood
        FROM check_ins
        GROUP BY user_id, check_in_date
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS daily_mood_summary")
    op.drop_index("ix_check_ins_check_in_date", table_name="check_ins")
    op.drop_index("ix_check_ins_user_id_check_in_date", table_name="check_ins")
    op.execute("ALTER TABLE check_ins DROP COLUMN time_of_day")
    op.execute("ALTER TABLE check_ins DROP COLUMN check_in_date")
