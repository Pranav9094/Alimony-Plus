#!/bin/bash
# Runs ONCE, on first start of an empty data volume (postgres image /docker-entrypoint-initdb.d).
# Creates least-privilege roles + both databases. Passwords come from the environment, never from this file.
set -euo pipefail
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
: "${RAG_DB_PASSWORD:?RAG_DB_PASSWORD is required}"
SQL_DIR="${SQL_DIR:-/sql}"
PSQL=(psql -v ON_ERROR_STOP=1 --no-psqlrc --username "${POSTGRES_USER:-postgres}")

"${PSQL[@]}" --dbname postgres -v app_pw="$APP_DB_PASSWORD" -v rag_pw="$RAG_DB_PASSWORD" <<'SQL'
CREATE ROLE alimony_app LOGIN PASSWORD :'app_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE rag_app     LOGIN PASSWORD :'rag_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE alimony     OWNER postgres;     -- tables stay owned by the superuser so row-level security binds alimony_app
CREATE DATABASE alimony_rag OWNER rag_app;
SQL

# --- backend database: schema (from prisma/contract.prisma) + intake table + RLS policy on Document ---
"${PSQL[@]}" --dbname alimony -f "$SQL_DIR/backend_schema.sql"
"${PSQL[@]}" --dbname alimony -f "$SQL_DIR/intake.sql"
"${PSQL[@]}" --dbname alimony -f "$SQL_DIR/rls.sql"
"${PSQL[@]}" --dbname alimony <<'SQL'
GRANT USAGE ON SCHEMA public TO alimony_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO alimony_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO alimony_app;
REVOKE UPDATE, DELETE ON "AuditLog" FROM alimony_app;   -- audit trail is append-only for the app
SQL

# --- RAG database: shared legal knowledge only. Must be the LAST step (the healthcheck waits for legal_chunks) ---
"${PSQL[@]}" --dbname alimony_rag -c 'CREATE EXTENSION IF NOT EXISTS vector'
"${PSQL[@]}" --dbname alimony_rag -c 'SET ROLE rag_app' -f "$SQL_DIR/rag_schema.sql"
echo "alimony-plus: databases initialised"
