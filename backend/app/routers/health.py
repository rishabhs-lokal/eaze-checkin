from fastapi import APIRouter, HTTPException

from app.db import ping_db

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def liveness() -> dict[str, str]:
    # Liveness never touches the database — a slow/unreachable DB should not
    # get a healthy pod killed and restarted by kubelet.
    return {"status": "ok"}


@router.get("/readyz")
async def readiness() -> dict[str, str]:
    try:
        await ping_db()
    except Exception as exc:  # noqa: BLE001 — any DB failure means "not ready"
        raise HTTPException(status_code=503, detail=f"database unavailable: {exc}") from exc
    return {"status": "ready"}
