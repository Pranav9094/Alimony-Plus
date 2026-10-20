import hashlib
import math
from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Float = Annotated[float, Field(allow_inf_nan=False)]


class SearchRequest(BaseModel):
    """Send exactly one of `query` (needs an embedder) or `embedding` (e5 query vector)."""

    model_config = ConfigDict(extra="forbid")

    query: str | None = Field(default=None, min_length=1, max_length=2000)
    embedding: list[Float] | None = Field(default=None, max_length=4096)
    top_k: int | None = Field(default=None, ge=1)
    min_score: float = Field(default=0.0, ge=-1.0, le=1.0)
    language: str | None = Field(default=None, pattern=r"^[a-z]{2,3}$")
    official_only: bool = False

    @model_validator(mode="after")
    def exactly_one_input(self):
        if (self.query is None) == (self.embedding is None):
            raise ValueError("provide exactly one of 'query' or 'embedding'")
        return self


class ChunkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=500)
    document_type: str = Field(min_length=1, max_length=100)
    section: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=20000)
    source_url: str = Field(default="", max_length=2000)
    authority: str = Field(default="", max_length=300)
    official_source: bool = False
    jurisdiction: str = Field(default="", max_length=200)
    language: str = Field(default="en", pattern=r"^[a-z]{2,3}$")
    effective_from: date | None = None
    reviewed_on: date | None = None
    embedding: list[Float] = Field(max_length=4096)

    @field_validator("source_url")
    @classmethod
    def only_http_urls(cls, v: str) -> str:
        # Blocks javascript:/data: URLs that could later be rendered as links.
        if v and not (v.startswith("https://") or v.startswith("http://")):
            raise ValueError("source_url must start with http:// or https://")
        return v

    @property
    def content_hash(self) -> str:
        raw = f"{self.document_id}|{self.section}|{self.text}".encode()
        return hashlib.sha256(raw).hexdigest()


class IngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chunks: list[ChunkIn] = Field(min_length=1, max_length=1000)


class EmbeddingError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def prepare_embedding(vec: list[float], dim: int) -> list[float]:
    """Validate and L2-normalise. Raises EmbeddingError with a stable error code."""
    if len(vec) != dim:
        raise EmbeddingError("embedding_dimension_mismatch", f"expected {dim} values, got {len(vec)}")
    if not all(math.isfinite(x) for x in vec):
        raise EmbeddingError("embedding_not_finite", "embedding contains NaN or infinity")
    norm = math.sqrt(sum(x * x for x in vec))
    if norm < 1e-9:
        raise EmbeddingError("embedding_zero_vector", "embedding is a zero vector")
    return [x / norm for x in vec]
