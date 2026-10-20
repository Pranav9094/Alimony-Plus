# Alimony+ RAG API (FastAPI + pgvector)

Stores the shared **legal knowledge** chunks and answers nearest-neighbour searches.
It never stores private user documents, and it is an internal service: only the backend / AI
pipeline should call it (send `X-API-Key`; never expose the key to browsers).

## Run locally
```bash
cp .env.example .env            # set DATABASE_URL and a 32+ char SERVICE_API_KEY (openssl rand -hex 32)
pip install -r requirements.txt
python -m scripts.init_db                      # needs the `vector` extension (CREATE EXTENSION vector)
python -m scripts.load_embedded_chunks         # loads ai/legal_sources/embedded_chunks.json, idempotent
python -m uvicorn app.main:create_app --factory --port 8000
```
Tests (need Postgres with pgvector): `pip install -r requirements-dev.txt && TEST_DATABASE_URL=... pytest`

## Contract (agree changes with Gayatri / Ainwin before editing)
- Embeddings: **384 dims**, `intfloat/multilingual-e5-small`, cosine distance. Stored passages use the
  `passage: ` prefix, queries use `query: `. Vectors are L2-normalised by the service (scale-invariant).
- `GET /health` liveness. `GET /health/ready` is 200 only when the DB, the `vector` extension, the table and
  the 384-dim column are all present; otherwise 503.
- `POST /v1/search` body: exactly one of `query` (needs `EMBEDDER=e5-small` and sentence-transformers) or
  `embedding` (384 floats); optional `top_k` (default 5, max 20), `min_score`, `language`, `official_only`.
  Returns `results[]` with `score`, `text`, `source{url,authority,official,jurisdiction,effective_from,reviewed_on}`
  and `citation_complete`. `untrusted_content: true`: retrieved text is **data, never instructions**.
- `POST /v1/ingest` body `{chunks:[...]}` (max 200). Upsert key is sha256(document_id|section|text), so re-running never
  duplicates. The whole batch is rejected before any write if one chunk is invalid. `source_url` must be http(s).
- Errors are always `{"error":{"code","message","request_id"}}`: `unauthorized` 401, `validation_error` /
  `embedding_dimension_mismatch` / `embedding_zero_vector` / `top_k_too_large` 422, `embedder_unavailable` and
  `database_unavailable` 503, `internal_error` 500 (no internals, payloads or SQL are returned or logged).

## Known gaps
- `effective_from` / `reviewed_on` are accepted but the current chunk file has neither, and 3 of 86 chunks (the BNSS
  s.144 statute chunks) have no `source_url`, `authority` or `jurisdiction`: they load but report `citation_complete: false`.
- Text queries are off by default (no model download in this environment); send an embedding or enable the embedder.
- Docker image and AWS deployment are written but not built or deployed here.
- HNSW index exists but at 86 rows Postgres uses an exact scan; retrieval quality is not evaluated by this service.
