#!/usr/bin/env bash
# Fast repository checks that need no database: no secrets or build junk committed, scripts parse,
# docker-compose.yml is valid / fails closed / publishes only the frontend, and the SQL mirrors the Prisma contract.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
fail=0
bad() { echo "::error::$*"; fail=1; }

echo "== 1. files that must never be committed"
junk=$(git ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.(local|production|development)$|node_modules/|__pycache__/|\.pyc$|\.pytest_cache|^backend/uploads/[^/]+$|\.(pem|key|p12|pfx)$' | grep -v '^backend/uploads/\.gitkeep$' || true)
[ -z "$junk" ] || bad "committed files that should be ignored:"$'\n'"$junk"

echo "== 2. secret-looking assignments in tracked files"
hits=$(git grep -nIE '(PASSWORD|SECRET|API_KEY|ENCRYPTION_KEY|TOKEN)[A-Z_]*=[0-9A-Za-z+/_-]{16,}' -- . \
        ':!*.example' ':!*.md' ':!package-lock.json' ':!services/rag-api/tests' ':!backend/tests' ':!infra/ci' || true)
[ -z "$hits" ] || bad "possible committed secret:"$'\n'"$hits"

echo "== 3. shell scripts parse"
for f in infra/db/10-init.sh infra/ci/*.sh; do bash -n "$f" || bad "syntax error in $f"; done
if command -v shellcheck >/dev/null; then shellcheck -S warning infra/db/10-init.sh infra/ci/*.sh || bad "shellcheck found problems"; fi
mode=$(git ls-files -s infra/db/10-init.sh | cut -c1-6)
[ "$mode" = "100755" ] || bad "infra/db/10-init.sh must be executable (mode is $mode)"

echo "== 4. SQL mirrors backend/prisma/contract.prisma"
while read -r model; do
  grep -qE "\"$model\"" infra/db/backend_schema.sql backend/prisma/intake.sql || bad "model $model is in contract.prisma but not in infra/db/backend_schema.sql or intake.sql"
done < <(grep -oE '^model [A-Za-z]+' backend/prisma/contract.prisma | cut -d' ' -f2)

echo "== 5. docker-compose.yml"
tmp=$(mktemp); trap 'rm -f "$tmp" "$tmp.json"' EXIT
for v in POSTGRES_PASSWORD APP_DB_PASSWORD RAG_DB_PASSWORD REDIS_PASSWORD; do echo "$v=$(openssl rand -hex 12)" >> "$tmp"; done
for v in JWT_SECRET FILE_ENCRYPTION_KEY SERVICE_API_KEY; do echo "$v=$(openssl rand -hex 32)" >> "$tmp"; done
if docker compose --env-file "$tmp" config --format json > "$tmp.json" 2> "$tmp.err"; then
  python3 - "$tmp.json" <<'PY' || bad "compose policy check failed"
import json, sys
c = json.load(open(sys.argv[1]))
problems = []
for name, svc in c["services"].items():
    for p in svc.get("ports", []):
        if name != "frontend":
            problems.append(f"{name} publishes port {p['published']}: only the frontend may be published")
        elif p.get("host_ip") != "127.0.0.1":
            problems.append("frontend must bind to 127.0.0.1")
    if name in ("backend", "rag-api", "worker", "frontend") and "ALL" not in svc.get("cap_drop", []):
        problems.append(f"{name} should drop all capabilities")
for n in ("backend", "frontend", "rag-api", "worker", "db", "redis"):
    if n not in c["services"]:
        problems.append(f"service {n} is missing")
print("\n".join(problems) or "compose policy ok")
sys.exit(1 if problems else 0)
PY
else
  cat "$tmp.err"; bad "docker compose config failed with a complete .env"
fi
if env -i PATH="$PATH" HOME="$HOME" docker compose --env-file /dev/null config -q >/dev/null 2>&1; then
  bad "docker compose must refuse to start when secrets are missing (it did not)"
fi

if [ "$fail" -eq 0 ]; then echo "hygiene: all checks passed"; else echo "hygiene: FAILED"; exit 1; fi
