#!/usr/bin/env bash
# Builds and starts the whole docker compose stack on real images, waits for every healthcheck, then runs smoke-api.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
env_file=$(mktemp)
for v in POSTGRES_PASSWORD APP_DB_PASSWORD RAG_DB_PASSWORD REDIS_PASSWORD; do
  val=$(openssl rand -hex 24); echo "::add-mask::$val"; echo "$v=$val" >> "$env_file"
done
for v in JWT_SECRET FILE_ENCRYPTION_KEY SERVICE_API_KEY; do
  val=$(openssl rand -hex 32); echo "::add-mask::$val"; echo "$v=$val" >> "$env_file"
done
compose=(docker compose --env-file "$env_file")
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then "${compose[@]}" logs --no-color --tail=150 || true; fi
  "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$env_file"
  exit "$status"
}
trap cleanup EXIT

"${compose[@]}" up -d --build --wait --wait-timeout 900
"${compose[@]}" ps

echo "== containers do not run as root"
for svc in backend frontend rag-api worker; do
  uid=$("${compose[@]}" exec -T "$svc" id -u)
  [ "$uid" != "0" ] || { echo "::error::$svc runs as root"; exit 1; }
  echo "ok  $svc runs as uid $uid"
done
echo "== rag-api is ready (database, pgvector, 384-dim column, jobs table)"
"${compose[@]}" exec -T rag-api python -c "import urllib.request as u; r=u.urlopen('http://127.0.0.1:8000/health/ready', timeout=5); print(r.status, r.read().decode())"
echo "== only the frontend is reachable from the host"
for port in 5000 8000 5432 6379; do
  if curl -s -m 3 -o /dev/null "http://127.0.0.1:$port/"; then echo "::error::port $port is exposed on the host"; exit 1; fi
done
FRONTEND_URL=http://127.0.0.1:3000 bash infra/ci/smoke-api.sh
