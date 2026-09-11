import asyncio
import time

import httpx

from app.config import get_settings

# How long a cached Redash result is trusted before it re-runs the query —
# phone numbers change rarely, so this trades a little staleness for far
# fewer BigQuery scans on repeat lookups of the same user_id.
REDASH_CACHE_MAX_AGE_SECONDS = 3600

REDASH_POLL_INTERVAL_SECONDS = 1.0
REDASH_POLL_TIMEOUT_SECONDS = 15.0

# Job status codes from Redash's /api/jobs/<id> — 3 is success, 4 is failure,
# anything else (pending/started) means keep polling.
_JOB_STATUS_SUCCESS = 3
_JOB_STATUS_FAILED = 4


async def lookup_phone_by_eaze_user_id(eaze_user_id: str) -> str | None:
    """Resolves a phone number from the Eaze platform user id via the shared
    Redash query (20342) that mirrors production users.mobile_no into the
    analytics warehouse — the fallback for when a banner link's ?phone= param
    is missing (see app.js restoreSession). Returns None whenever a phone
    can't be produced (key not configured, user id not found, Redash/BigQuery
    unavailable or slow) — callers treat all of those the same as "no phone
    available" rather than surfacing the difference to the user.
    """
    settings = get_settings()
    if not settings.redash_api_key:
        return None

    headers = {"Authorization": f"Key {settings.redash_api_key}"}
    base = settings.redash_base_url

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            submit = await client.post(
                f"{base}/api/queries/{settings.redash_phone_lookup_query_id}/results",
                json={"parameters": {"user_ids": eaze_user_id}, "max_age": REDASH_CACHE_MAX_AGE_SECONDS},
                headers=headers,
            )
            submit.raise_for_status()
            body = submit.json()

            # A fresh-enough cached result comes back inline; otherwise this
            # queues a job that needs polling until it finishes.
            query_result = body.get("query_result")
            if query_result is None:
                query_result = await _poll_job(client, base, headers, body.get("job", {}).get("id"))
            if query_result is None:
                return None

            rows = query_result.get("data", {}).get("rows", [])
    except httpx.HTTPError:
        return None

    if not rows:
        return None
    return rows[0].get("mobile_no") or None


async def _poll_job(client: httpx.AsyncClient, base: str, headers: dict, job_id: str | None) -> dict | None:
    if not job_id:
        return None
    deadline = time.monotonic() + REDASH_POLL_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        await asyncio.sleep(REDASH_POLL_INTERVAL_SECONDS)
        resp = await client.get(f"{base}/api/jobs/{job_id}", headers=headers)
        resp.raise_for_status()
        job = resp.json().get("job", {})
        status = job.get("status")
        if status == _JOB_STATUS_SUCCESS:
            result_id = job.get("query_result_id")
            if result_id is None:
                return None
            result_resp = await client.get(f"{base}/api/query_results/{result_id}", headers=headers)
            result_resp.raise_for_status()
            return result_resp.json().get("query_result")
        if status == _JOB_STATUS_FAILED:
            return None
    return None
