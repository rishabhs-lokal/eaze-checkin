import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import engine
from app.routers import auth, checkins, eaze_score, health

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper())

app = FastAPI(title="Eaze API", version="0.1.0")

# Same origin as the frontend now (see the StaticFiles mount below), so this
# is no longer load-bearing for the app itself — left open in case anything
# else ever needs to call the API cross-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(checkins.router)
app.include_router(eaze_score.router)

# Frontend — mounted last and at "/" so every API route above still matches
# first; only requests that don't match one of those (/, /app.js,
# /styles.css, /assets/...) fall through to these static files. html=True
# serves static/index.html for "/".
app.mount("/", StaticFiles(directory="static", html=True), name="static")


@app.on_event("shutdown")
async def shutdown() -> None:
    # Releases pooled connections cleanly on pod termination instead of
    # leaving sockets for kubelet's SIGKILL to slam shut.
    await engine.dispose()
