# Running Alimony+ with Docker

Starts the whole stack locally: PostgreSQL 16 + pgvector, Redis, backend (Express), RAG API (FastAPI) and the frontend (Next.js).
Only the frontend is published, on `127.0.0.1:3000`. Everything else stays on the internal Docker network.

## 1. Prerequisites
Docker Desktop (Compose v2) and a way to generate random hex values (`openssl` in Git Bash, macOS or Linux).

## 2. Configure
```bash
cp .env.example .env        # .env is git-ignored; never commit it
```
Fill **every** value in `.env` (Compose refuses to start if one is missing):

| Variable | How to generate |
| --- | --- |
| `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `RAG_DB_PASSWORD`, `REDIS_PASSWORD` | `openssl rand -hex 24` (hex only, so it is safe inside URLs) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `FILE_ENCRYPTION_KEY` | `openssl rand -hex 32` (exactly 64 hex characters) |
| `SERVICE_API_KEY` | `openssl rand -hex 32` (32+ characters) |

## 3. Start
```bash
docker compose up --build
```
Open http://localhost:3000 (Chrome or Firefox; the session cookie is `Secure`, which Safari does not accept over plain http).

## 4. Load the legal source chunks (once)
```bash
docker compose run --rm -v ./ai/legal_sources:/data:ro rag-api python -m scripts.load_embedded_chunks /data/embedded_chunks.json
```
Re-running is safe: chunks are keyed by a content hash, so no duplicates are created.

## 5. Reset everything
```bash
docker compose down -v      # deletes the database, Redis data and encrypted uploads
```

## How the database is created
`infra/db/10-init.sh` runs **once**, on the first start with an empty data volume. It creates two least-privilege roles
(`alimony_app`, `rag_app`), the `alimony` and `alimony_rag` databases, the tables, the intake table and the row-level
security policy on `Document`. The app role cannot change or delete audit-log rows. Schema changes later need a migration
or `docker compose down -v` in development. `infra/db/backend_schema.sql` mirrors `backend/prisma/contract.prisma`; update both together.

## What has been tested, and what has not
- Tested: the backend and frontend images build and run as a non-root user and report healthy; the backend passes its
  16 integration/security tests against the container and the bootstrapped database; the frontend proxy flow works against
  the backend container; `docker-compose.yml` validates and fails closed when a secret is missing.
- Tested only with locally assembled stand-in base images (Docker Hub was not reachable from the test machine).
- **Not yet confirmed:** a real `docker compose up --build` with the official `pgvector/pgvector:pg16`, `redis:7-alpine`,
  `node:22-slim` and `python:3.12-slim` images; the RAG container run; the `cap_drop: ALL` and `no-new-privileges` settings on those images.
- Not built yet: Celery workers (Redis is started but unused), AWS deployment and CI/CD.
