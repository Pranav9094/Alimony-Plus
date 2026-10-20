#!/usr/bin/env bash
# Black-box check of the running stack through the frontend proxy (the only thing a browser can reach).
# Usage: FRONTEND_URL=http://127.0.0.1:3000 bash infra/ci/smoke-api.sh
set -euo pipefail
base="${FRONTEND_URL:-http://127.0.0.1:3000}"
api="$base/api/backend"
origin="Origin: $base"
json="Content-Type: application/json"
jar=$(mktemp); trap 'rm -f "$jar"' EXIT
email="ci-$(date +%s)-$RANDOM@example.com"
pw="Ci-$(openssl rand -hex 8)!"

expect() { # expect <description> <wanted-status> <actual-status>
  if [ "$2" != "$3" ]; then echo "::error::$1: expected HTTP $2, got $3"; exit 1; fi
  echo "ok  $1 (HTTP $3)"
}
code() { curl -s -o /dev/null -w '%{http_code}' -m 20 "$@"; }
field() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

home=$(code "$base/")
{ [ "$home" = "200" ] || [ "$home" = "307" ]; } || { echo "::error::home page returned HTTP $home"; exit 1; }
echo "ok  home page responds (HTTP $home)"
expect "register"                     201 "$(code -H "$origin" -H "$json" -X POST "$api/auth/register" -d "{\"name\":\"CI User\",\"email\":\"$email\",\"password\":\"$pw\"}")"
expect "login"                        200 "$(code -c "$jar" -H "$origin" -H "$json" -X POST "$api/auth/login" -d "{\"email\":\"$email\",\"password\":\"$pw\"}")"
grep -q "HttpOnly" "$jar" || { echo "::error::session cookie is not HttpOnly"; exit 1; }
echo "ok  session cookie is HttpOnly"
case_id=$(curl -s -m 20 -b "$jar" -H "$origin" -H "$json" -X POST "$api/cases" -d '{"title":"CI smoke case"}' | field "d['case']['id']")
echo "ok  case created (id $case_id)"
expect "save intake"                  200 "$(code -b "$jar" -H "$origin" -H "$json" -X POST "$api/cases/$case_id/intake" -d '{"relationshipStatus":"married","marriageType":"hindu_rites","hasDependentChildren":"yes","safetyRisk":"no"}')"
routes=$(curl -s -m 20 -b "$jar" "$api/cases/$case_id/navigator" | field "len(d['navigator']['routes'])")
[ "$routes" -ge 1 ] || { echo "::error::navigator returned no routes"; exit 1; }
echo "ok  navigator returned $routes route(s)"
items=$(curl -s -m 20 -b "$jar" "$api/cases/$case_id/checklist" | field "len((d.get('checklist') or d)['items'])")
[ "$items" -ge 1 ] || { echo "::error::checklist is empty"; exit 1; }
echo "ok  checklist has $items item(s)"
code -b "$jar" -H "$origin" -H "$json" -X POST "$api/cases/$case_id/intake" -d '{"safetyRisk":"immediate"}' >/dev/null
safety=$(curl -s -m 20 -b "$jar" "$api/cases/$case_id/navigator" | field "d['navigator'].get('safetyFirst')")
[ "$safety" = "True" ] || { echo "::error::safety-first branch did not activate"; exit 1; }
echo "ok  safety-first branch activates"
expect "no session cookie is refused"  401 "$(code "$api/cases/$case_id/navigator")"
expect "cross-origin write is refused" 403 "$(code -b "$jar" -H "Origin: https://evil.example" -H "$json" -X POST "$api/cases/$case_id/intake" -d '{"safetyRisk":"no"}')"
echo "smoke: all checks passed"
