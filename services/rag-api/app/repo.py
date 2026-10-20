from pgvector import Vector
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


def _configure(conn):
    register_vector(conn)


def make_pool(database_url: str, min_size: int, max_size: int, timeout: float) -> ConnectionPool:
    # open(wait=False): the service starts even if the DB is down; /health/ready reports it.
    pool = ConnectionPool(
        database_url, min_size=min_size, max_size=max_size, timeout=timeout,
        configure=_configure, open=False,
    )
    pool.open(wait=False)
    return pool


UPSERT = """
INSERT INTO legal_chunks (content_hash, document_id, title, document_type, section, text,
    source_url, authority, official_source, jurisdiction, language, effective_from, reviewed_on, embedding)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON CONFLICT (content_hash) DO UPDATE SET
    title=EXCLUDED.title, document_type=EXCLUDED.document_type, source_url=EXCLUDED.source_url,
    authority=EXCLUDED.authority, official_source=EXCLUDED.official_source,
    jurisdiction=EXCLUDED.jurisdiction, language=EXCLUDED.language,
    effective_from=EXCLUDED.effective_from, reviewed_on=EXCLUDED.reviewed_on,
    embedding=EXCLUDED.embedding, updated_at=now()
RETURNING (xmax = 0) AS inserted
"""


def upsert_chunks(pool, rows) -> tuple[int, int]:
    """rows: list of (ChunkIn, normalised_embedding). One transaction; re-running never duplicates."""
    inserted = updated = 0
    with pool.connection() as conn:
        with conn.transaction():
            for chunk, emb in rows:
                cur = conn.execute(UPSERT, (
                    chunk.content_hash, chunk.document_id, chunk.title, chunk.document_type, chunk.section,
                    chunk.text, chunk.source_url, chunk.authority, chunk.official_source, chunk.jurisdiction,
                    chunk.language, chunk.effective_from, chunk.reviewed_on, Vector(emb),
                ))
                if cur.fetchone()[0]:
                    inserted += 1
                else:
                    updated += 1
    return inserted, updated


def search(pool, emb, top_k, min_score, language, official_only):
    filters, fparams = [], []
    if language:
        filters.append("language = %s")
        fparams.append(language)
    if official_only:
        filters.append("official_source")
    clause = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = f"""
        SELECT * FROM (
            SELECT id, document_id, title, document_type, section, text, source_url, authority,
                   official_source, jurisdiction, language, effective_from, reviewed_on,
                   (source_url <> '' AND authority <> '') AS citation_complete,
                   1 - (embedding <=> %s) AS score
            FROM legal_chunks {clause}
            ORDER BY embedding <=> %s
            LIMIT %s
        ) t WHERE score >= %s ORDER BY score DESC
    """
    vec = Vector(emb)
    # placeholder order in the SQL text: score-vector, filters..., order-vector, limit, min_score
    params = [vec, *fparams, vec, top_k, min_score]
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            return cur.execute(sql, params).fetchall()


def ready_check(pool, expected_dim: int) -> dict:
    with pool.connection() as conn:
        conn.execute("SELECT 1")
        ext = conn.execute("SELECT 1 FROM pg_extension WHERE extname='vector'").fetchone()
        row = conn.execute(
            "SELECT a.atttypmod FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid "
            "WHERE c.relname='legal_chunks' AND a.attname='embedding' AND NOT a.attisdropped"
        ).fetchone()
        count = conn.execute("SELECT count(*) FROM legal_chunks").fetchone()[0] if row else 0
    return {"pgvector": bool(ext), "table": bool(row), "column_dim": row[0] if row else None,
            "dim_ok": bool(row) and row[0] == expected_dim, "chunks": count}
