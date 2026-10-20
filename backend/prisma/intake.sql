-- Adds the Intake table (apply once on an existing database).
-- `prisma db update` would also drop the manual RLS policy on "Document",
-- so apply this file with psql instead and keep rls.sql applied.
CREATE TABLE IF NOT EXISTS "Intake" (
    "id"         SERIAL PRIMARY KEY,
    "caseId"     INTEGER NOT NULL UNIQUE,
    "userId"     INTEGER NOT NULL,
    "answers"    TEXT NOT NULL,
    "safetyFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
