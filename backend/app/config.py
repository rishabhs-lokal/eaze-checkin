from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    log_level: str = "info"

    # Any Postgres-compliant connection string, e.g.
    # postgresql://user:pass@host:5432/dbname
    # The driver suffix (+asyncpg) is added automatically if missing.
    database_url: str = "postgresql://eaze:eaze@localhost:5432/eaze"

    # Per-pod pool sizing. Total connections opened against the database is
    # roughly replicas * (db_pool_size + db_max_overflow) — keep this modest
    # and raise Postgres's max_connections in step with replica count.
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout_seconds: int = 30

    # Real coin-transfer call, gated for mock mode. Unset key -> claims are
    # recorded as mock_success without ever calling the real API, exactly
    # like the reference implementations this flow is modeled on.
    eaze_coins_auth_key: str | None = None
    eaze_coins_api_url: str = "https://api.eazeapp.com/payments/free-coins/upload/"

# Engagement-only logging of the "Add a note" field into text_log — only
    # records whether a note was written (yes/no), never its text, so this is
    # safe to leave on by default. Set TEXT_LOG_ENABLED=false to turn it off.
    text_log_enabled: bool = True

    # The shared, cross-app EazeScore ledger (eaze-level-up's own backend).
    # host.docker.internal is the local-dev default because this service and
    # eaze-level-up run as two separate docker-compose projects with no
    # shared network — that hostname is how a container reaches a port
    # published on the host machine. Unset -> check-ins simply aren't
    # mirrored anywhere else; this app's own scoring is unaffected either way.
    eaze_level_up_api_url: str | None = "http://host.docker.internal:3000"

    # Fallback phone lookup (Redash query 20342, mirrors production
    # users.mobile_no into the analytics warehouse) for banner links that
    # hand over eaze_user_id but omit phone — see
    # app/services/redash.py. Unset key -> the lookup is skipped entirely
    # and the frontend falls back to the typed-phone login screen.
    redash_api_key: str | None = None
    redash_base_url: str = "https://analytics.getlokalapp.com"
    redash_phone_lookup_query_id: int = 20342

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql+asyncpg://"):
            return url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
