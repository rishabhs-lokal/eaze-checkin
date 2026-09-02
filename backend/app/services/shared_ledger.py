"""Reports this app's own EazeScore events into eaze-level-up's shared,
cross-app ledger (POST /api/score/events) — the single source of truth both
apps' "lifetime EazeScore" totals are meant to read from.

eaze_user_id here is the phone number, passed through unchanged — no
normalization, no lookup. eaze-level-up's own ledger keys on the same raw
value (the number typed at its login screen), so the two must match exactly
or the same person's activity silently splits into two identities.

Best-effort only: a check-in must never fail, and the user must never see an
error, because a *different app's* API was slow or unreachable. Every
failure is logged and swallowed here.
"""
import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 3.0


async def report_to_shared_ledger(*, eaze_user_id: str, event_type: str, points: int) -> None:
    settings = get_settings()
    if not settings.eaze_level_up_api_url:
        return

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{settings.eaze_level_up_api_url}/api/score/events",
                json={
                    "eazeUserId": eaze_user_id,
                    "sourceApp": "checkin",
                    "eventType": event_type,
                    "points": points,
                },
            )
            response.raise_for_status()
    except Exception as exc:  # noqa: BLE001 - deliberately broad, see module docstring
        logger.warning(
            "shared ledger report failed (eaze_user_id=%s, event_type=%s, points=%s): %s",
            eaze_user_id, event_type, points, exc,
        )
