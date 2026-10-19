#!/usr/bin/env bash
# Creates the same roles/databases docker compose creates (by running infra/db/10-init.sh), plus a disposable
# database for the RAG tests. Needs PGHOST/PGPASSWORD for a superuser. Exports generated passwords to $GITHUB_ENV.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${PGHOST:?PGHOST is required}" "${PGPASSWORD:?PGPASSWORD is required}" "${GITHUB_ENV:?GITHUB_ENV is required}"
app_pw=$(openssl rand -hex 16)
rag_pw=$(openssl rand -hex 16)
echo "::add-mask::$app_pw"
echo "::add-mask::$rag_pw"

sql_dir=$(mktemp -d)
cp infra/db/backend_schema.sql "$sql_dir/backend_schema.sql"
cp backend/prisma/intake.sql "$sql_dir/intake.sql"
cp backend/prisma/rls.sql "$sql_dir/rls.sql"
cp services/rag-api/app/schema.sql "$sql_dir/rag_schema.sql"

POSTGRES_USER=postgres APP_DB_PASSWORD="$app_pw" RAG_DB_PASSWORD="$rag_pw" SQL_DIR="$sql_dir" bash infra/db/10-init.sh

psql -v ON_ERROR_STOP=1 --no-psqlrc -U postgres -d postgres -c 'CREATE DATABASE alimony_rag_test OWNER rag_app'
psql -v ON_ERROR_STOP=1 --no-psqlrc -U postgres -d alimony_rag_test -c 'CREATE EXTENSION IF NOT EXISTS vector'

{ echo "APP_DB_PASSWORD=$app_pw"; echo "RAG_DB_PASSWORD=$rag_pw"; } >> "$GITHUB_ENV"
echo "databases ready"
