-- Shared LEGAL knowledge only. Private user documents must never be stored here.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS legal_chunks (
    id              BIGSERIAL PRIMARY KEY,
    content_hash    CHAR(64)  NOT NULL UNIQUE,   -- sha256(document_id|section|text): idempotent ingest
    document_id     TEXT      NOT NULL,
    title           TEXT      NOT NULL,
    document_type   TEXT      NOT NULL,
    section         TEXT      NOT NULL,
    text            TEXT      NOT NULL,
    source_url      TEXT      NOT NULL DEFAULT '',
    authority       TEXT      NOT NULL DEFAULT '',
    official_source BOOLEAN   NOT NULL DEFAULT FALSE,
    jurisdiction    TEXT      NOT NULL DEFAULT '',
    language        TEXT      NOT NULL DEFAULT 'en',
    effective_from  DATE,
    reviewed_on     DATE,
    embedding       vector(384) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_chunks_embedding_hnsw
    ON legal_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS legal_chunks_document_id_idx ON legal_chunks (document_id);
