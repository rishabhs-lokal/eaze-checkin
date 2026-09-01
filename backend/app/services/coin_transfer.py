import httpx

from app.config import get_settings


async def transfer_coins(eaze_user_id: str, amount: int) -> tuple[str, str | None, str | None]:
    """Attempt the real coin transfer. Returns (status, provider_ref, notes).

    Mock mode (no auth key configured) never calls the real API — this is
    what keeps the flow testable locally without a real credential, mirroring
    the reference implementations this is modeled on.
    """
    settings = get_settings()
    if not settings.eaze_coins_auth_key:
        return "mock_success", "mock", "Mock transfer — EAZE_COINS_AUTH_KEY not configured."

    csv_content = f"user_id,coins\n{eaze_user_id},{amount}\n"
    files = {"file": ("transfer.csv", csv_content, "text/csv")}
    data = {"name": "EazeScore Claim"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.eaze_coins_api_url,
                files=files,
                data=data,
                headers={"x-n8n-auth-key": settings.eaze_coins_auth_key},
            )
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Eaze Coins API request failed: {exc}") from exc

    if response.status_code >= 400:
        raise RuntimeError(f"Eaze Coins API returned {response.status_code}: {response.text}")

    return "submitted", eaze_user_id, response.text


async def notify_claim_failure(phone: str, amount: int, reason: str) -> None:
    """Failure-only ops notification — success is silent by design."""
    settings = get_settings()
    if not settings.slack_webhook_url:
        return
    text = f":x: EazeScore claim failed\nPhone: {phone}\nAmount: {amount}\nReason: {reason}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(settings.slack_webhook_url, json={"text": text})
    except httpx.HTTPError:
        pass
