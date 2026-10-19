import hmac
import logging
import re
import time
import uuid
from contextlib import asynccontextmanager

import psycopg
import psycopg_pool
from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import repo
from .config import Settings, get_settings
from .embedder import EmbedderUnavailable, build_embedder
from .models import EmbeddingError, IngestRequest, SearchRequest, prepare_embedding

log = logging.getLogger("rag-api")
DB_ERRORS = (psycopg.OperationalError, psycopg_pool.PoolTimeout, psycopg_pool.PoolClosed)
REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def error_response(request: Request, status: int, code: str, message: str, details=None):
    body = {"error": {"code": code, "message": message, "request_id": getattr(request.state, "request_id", None)}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(body, status_code=status)


def create_app(settings: Settings | None = None, embedder=None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level)
    embedder = embedder or build_embedder(settings.embedder, settings.embedder_model)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.pool = repo.make_pool(
            settings.database_url, settings.db_pool_min, settings.db_pool_max, settings.db_acquire_timeout
        )
        yield
        app.state.pool.close()

    app = FastAPI(title="Alimony+ RAG API", version="1.0.0", lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)  # no public schema/docs by default

    def require_key(x_api_key: str | None = Header(default=None)):
        if not x_api_key or not hmac.compare_digest(x_api_key, settings.service_api_key):
            raise ApiError(401, "unauthorized", "missing or invalid API key")

    def unhandled_response(request: Request, exc: Exception):
        if isinstance(exc, DB_ERRORS):
            log.error("database unavailable rid=%s: %s", request.state.request_id, type(exc).__name__)
            return error_response(request, 503, "database_unavailable", "database is unavailable, retry later")
        log.exception("unhandled error rid=%s", request.state.request_id, exc_info=exc)
        return error_response(request, 500, "internal_error", "internal server error")

    @app.middleware("http")
    async def guard(request: Request, call_next):
        rid = request.headers.get("x-request-id", "")
        request.state.request_id = rid if REQUEST_ID_RE.match(rid) else str(uuid.uuid4())
        cl = request.headers.get("content-length", "")
        if cl.isdigit() and int(cl) > settings.max_body_bytes:
            return error_response(request, 413, "payload_too_large", "request body too large")
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:  # converted here so the headers below apply to error responses too
            response = unhandled_response(request, exc)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        # never log bodies or query text: legal questions can describe private situations
        log.info("%s %s -> %s (%.0f ms) rid=%s", request.method, request.url.path, response.status_code,
                 (time.perf_counter() - start) * 1000, request.state.request_id)
        return response

    @app.exception_handler(ApiError)
    async def _api_error(request, exc: ApiError):
        return error_response(request, exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _validation(request, exc: RequestValidationError):
        # never echo the submitted input (it may contain private text or a large vector)
        details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
        return error_response(request, 422, "validation_error", "request validation failed", details)

    @app.exception_handler(Exception)
    async def _unhandled(request, exc: Exception):
        return unhandled_response(request, exc)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/health/ready")
    def ready(request: Request):
        try:
            info = repo.ready_check(app.state.pool, settings.embedding_dim)
        except DB_ERRORS:
            return JSONResponse({"status": "unavailable", "database": False}, status_code=503)
        ok = info["pgvector"] and info["table"] and info["dim_ok"]
        return JSONResponse({"status": "ready" if ok else "not_ready", "database": True, **info,
                             "embedder": embedder.name}, status_code=200 if ok else 503)

    @app.post("/v1/search", dependencies=[Depends(require_key)])
    def search(body: SearchRequest):
        top_k = body.top_k or settings.default_top_k
        if top_k > settings.max_top_k:
            raise ApiError(422, "top_k_too_large", f"top_k must be at most {settings.max_top_k}")
        try:
            vec = body.embedding if body.embedding is not None else embedder.embed_query(body.query)
            vec = prepare_embedding(vec, settings.embedding_dim)
        except EmbedderUnavailable as exc:
            raise ApiError(503, "embedder_unavailable", str(exc)) from exc
        except EmbeddingError as exc:
            raise ApiError(422, exc.code, str(exc)) from exc
        rows = repo.search(app.state.pool, vec, top_k, body.min_score, body.language, body.official_only)
        results = [{
            "id": r["id"], "score": round(float(r["score"]), 6), "document_id": r["document_id"],
            "title": r["title"], "document_type": r["document_type"], "section": r["section"],
            "text": r["text"], "language": r["language"], "citation_complete": r["citation_complete"],
            "source": {"url": r["source_url"], "authority": r["authority"], "official": r["official_source"],
                       "jurisdiction": r["jurisdiction"],
                       "effective_from": r["effective_from"].isoformat() if r["effective_from"] else None,
                       "reviewed_on": r["reviewed_on"].isoformat() if r["reviewed_on"] else None},
        } for r in rows]
        # `text` is retrieved data, never instructions: callers must treat it as untrusted content.
        return {"results": results, "count": len(results), "top_k": top_k, "untrusted_content": True,
                "embedding_dim": settings.embedding_dim}

    @app.post("/v1/ingest", dependencies=[Depends(require_key)])
    def ingest(body: IngestRequest):
        if len(body.chunks) > settings.max_ingest_batch:
            raise ApiError(422, "batch_too_large", f"at most {settings.max_ingest_batch} chunks per request")
        rows = []
        for i, chunk in enumerate(body.chunks):
            try:
                rows.append((chunk, prepare_embedding(chunk.embedding, settings.embedding_dim)))
            except EmbeddingError as exc:
                # reject the whole batch before writing anything: no partial ingests
                raise ApiError(422, exc.code, f"chunk {i}: {exc}") from exc
        inserted, updated = repo.upsert_chunks(app.state.pool, rows)
        incomplete = sum(1 for c, _ in rows if not (c.source_url and c.authority))
        return {"received": len(rows), "inserted": inserted, "updated": updated, "citation_incomplete": incomplete}

    return app
