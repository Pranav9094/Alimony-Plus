"""Environment-driven settings. The service refuses to start without a database URL
and a strong service API key (fail closed)."""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    service_api_key: str = Field(min_length=32)

    embedding_dim: int = 384          # intfloat/multilingual-e5-small
    embedder: str = "none"            # none | e5-small  (text queries need an embedder)
    embedder_model: str = "intfloat/multilingual-e5-small"

    default_top_k: int = 5
    max_top_k: int = 20
    max_ingest_batch: int = 200
    max_body_bytes: int = 5_000_000

    db_pool_min: int = 1
    db_pool_max: int = 5
    db_acquire_timeout: float = 5.0
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
