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
