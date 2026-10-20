# Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`. It needs **no repository secrets**: every password and key
is generated fresh inside the job and masked in the logs. The workflow only has read access to the repository.

| Job | What it checks |
| --- | --- |
| `hygiene` | No `.env`, caches or key files committed; no secret-looking values; shell scripts parse (and pass shellcheck); `infra/db/backend_schema.sql` still covers every model in `backend/prisma/contract.prisma`; `docker-compose.yml` is valid, refuses to start without secrets, publishes only the frontend on 127.0.0.1 and drops capabilities. |
| `backend` | Creates the databases with `infra/db/10-init.sh` (the same script Docker uses), starts the backend as the least-privilege database role, runs the integration/security tests (IDOR on every resource, XSS payloads, upload spoofing, privacy of responses, safety branch). |
| `frontend` | `npm ci`, typecheck, unit tests, production build. |
| `rag-api` | Real Postgres + pgvector and real Redis: unit tests, database tests, and end-to-end tests with a real Celery worker process. |
| `docker-stack` | Builds and starts the whole Compose stack on real images, waits for every healthcheck, checks containers are non-root and internal ports are not exposed, then runs `infra/ci/smoke-api.sh` through the frontend. **Informational** (`continue-on-error`) until it has passed once on GitHub; delete that line in the workflow to make it required. |

## Run the same checks locally
```bash
bash infra/ci/hygiene.sh                                   # needs docker compose + python3
FRONTEND_URL=http://127.0.0.1:3000 bash infra/ci/smoke-api.sh   # against a running stack
bash infra/ci/smoke-stack.sh                               # full Docker stack (needs Docker)
```

## Not covered yet
- Playwright end-to-end browser tests (`npm run test:e2e`) are not run in CI.
- No dependency-vulnerability gate (`npm audit` / `pip-audit`) yet; adding one would also flag problems that are not ours.
- Deployment (AWS) is not part of this workflow.
- Actions are pinned by major version (`actions/checkout@v4`), not by commit SHA.
