import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import engine
from app.routers import checkins, eaze_score, health

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper())

app = FastAPI(title="Eaze API", version="0.1.0")

# The frontend mockup is served separately (its own static-file origin) and
# calls this API directly from the browser — needs CORS open for that to work.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(checkins.router)
app.include_router(eaze_score.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "eaze-api", "env": settings.app_env}


@app.on_event("shutdown")
async def shutdown() -> None:
    # Releases pooled connections cleanly on pod termination instead of
    # leaving sockets for kubelet's SIGKILL to slam shut.
    await engine.dispose()
