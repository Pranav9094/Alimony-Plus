import psycopg

from tests.conftest import API_KEY, DB_URL, fake_chunk, make_settings


def count():
    with psycopg.connect(DB_URL) as conn:
        return conn.execute("SELECT count(*) FROM legal_chunks").fetchone()[0]


def ingest(client, auth, chunks):
    return client.post("/v1/ingest", json={"chunks": chunks}, headers=auth)


# ---------- health & auth ----------
def test_health_and_ready(client):
    assert client.get("/health").json() == {"status": "ok"}
    r = client.get("/health/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready" and body["pgvector"] and body["dim_ok"] and body["column_dim"] == 384


def test_docs_and_schema_not_public(client):
    for p in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(p).status_code == 404


def test_endpoints_require_api_key(client):
    for headers in ({}, {"X-API-Key": "wrong" * 10}):
        assert client.post("/v1/search", json={"query": "x"}, headers=headers).status_code == 401
        assert client.post("/v1/ingest", json={"chunks": [fake_chunk()]}, headers=headers).status_code == 401
    assert count() == 0


def test_ready_reports_503_when_database_down():
    from fastapi.testclient import TestClient

    from app.main import create_app

    bad = make_settings(database_url="postgresql://rag_app:testpw@127.0.0.1:1/none", db_acquire_timeout=1.0)
    with TestClient(create_app(bad), raise_server_exceptions=False) as c:
        assert c.get("/health").status_code == 200          # liveness unaffected
        assert c.get("/health/ready").status_code == 503    # readiness fails
        r = c.post("/v1/search", json={"embedding": [0.1] * 384}, headers={"X-API-Key": API_KEY})
        assert r.status_code == 503 and r.json()["error"]["code"] == "database_unavailable"


# ---------- ingest ----------
def test_ingest_is_idempotent(client, auth):
    chunks = [fake_chunk(i) for i in range(5)]
    first = ingest(client, auth, chunks).json()
    second = ingest(client, auth, chunks).json()
    assert (first["inserted"], first["updated"]) == (5, 0)
    assert (second["inserted"], second["updated"]) == (0, 5)
    assert count() == 5


def test_ingest_rejects_bad_batch_atomically(client, auth):
    good, bad = fake_chunk(1), fake_chunk(2, embedding=[0.1] * 12)
    r = ingest(client, auth, [good, bad])
    assert r.status_code == 422 and r.json()["error"]["code"] == "embedding_dimension_mismatch"
    assert count() == 0                                   # nothing partially written


def test_ingest_rejects_javascript_source_url_and_zero_vector(client, auth):
    assert ingest(client, auth, [fake_chunk(1, source_url="javascript:alert(1)")]).status_code == 422
    assert ingest(client, auth, [fake_chunk(1, embedding=[0.0] * 384)]).json()["error"]["code"] == "embedding_zero_vector"
    assert count() == 0


def test_ingest_batch_limit(client, auth):
    r = ingest(client, auth, [fake_chunk(i) for i in range(201)])
    assert r.status_code == 422 and r.json()["error"]["code"] == "batch_too_large"


def test_ingest_flags_incomplete_citations(client, auth):
    r = ingest(client, auth, [fake_chunk(1, source_url=""), fake_chunk(2)]).json()
    assert r["citation_incomplete"] == 1


# ---------- search ----------
def test_search_on_empty_table_returns_empty_list(client, auth):
    r = client.post("/v1/search", json={"embedding": [0.1] * 384}, headers=auth)
    assert r.status_code == 200 and r.json()["results"] == [] and r.json()["count"] == 0


def test_search_returns_nearest_first_with_source_metadata(client, auth):
    chunks = [fake_chunk(i) for i in range(10)]
    ingest(client, auth, chunks)
    r = client.post("/v1/search", json={"embedding": chunks[3]["embedding"], "top_k": 3}, headers=auth).json()
    assert r["results"][0]["document_id"] == "DOC_3" and r["results"][0]["score"] > 0.999
    assert r["untrusted_content"] is True and r["count"] == 3
    src = r["results"][0]["source"]
    assert src["url"] == "https://example.org/x" and src["official"] is True
    assert r["results"][0]["citation_complete"] is True


def test_search_filters_and_min_score(client, auth):
    ingest(client, auth, [fake_chunk(1), fake_chunk(2, official_source=False), fake_chunk(3, language="hi")])
    q = fake_chunk(1)["embedding"]
    only_official = client.post("/v1/search", json={"embedding": q, "official_only": True, "top_k": 10}, headers=auth).json()
    assert {x["document_id"] for x in only_official["results"]} == {"DOC_1", "DOC_3"}
    hindi = client.post("/v1/search", json={"embedding": q, "language": "hi", "top_k": 10}, headers=auth).json()
    assert [x["document_id"] for x in hindi["results"]] == ["DOC_3"]
    strict = client.post("/v1/search", json={"embedding": q, "min_score": 0.9, "top_k": 10}, headers=auth).json()
    assert [x["document_id"] for x in strict["results"]] == ["DOC_1"]


def test_search_rejects_invalid_embeddings_without_echoing_them(client, auth):
    for emb, code in (([0.1] * 10, "embedding_dimension_mismatch"), ([0.0] * 384, "embedding_zero_vector")):
        r = client.post("/v1/search", json={"embedding": emb}, headers=auth)
        assert r.status_code == 422 and r.json()["error"]["code"] == code
    r = client.post("/v1/search", json={"embedding": ["a"] * 384}, headers=auth)
    assert r.status_code == 422 and "a" * 5 not in r.text and r.json()["error"]["code"] == "validation_error"
    r = client.post("/v1/search", content='{"embedding": [NaN, 1]}', headers={**auth, "Content-Type": "application/json"})
    assert r.status_code == 422


def test_search_validation_errors(client, auth):
    assert client.post("/v1/search", json={}, headers=auth).status_code == 422
    assert client.post("/v1/search", json={"query": "x", "embedding": [0.1] * 384}, headers=auth).status_code == 422
    r = client.post("/v1/search", json={"embedding": [0.1] * 384, "top_k": 21}, headers=auth)
    assert r.status_code == 422 and r.json()["error"]["code"] == "top_k_too_large"


def test_text_query_without_embedder_gives_clear_503(client, auth):
    r = client.post("/v1/search", json={"query": "interim maintenance"}, headers=auth)
    assert r.status_code == 503 and r.json()["error"]["code"] == "embedder_unavailable"


def test_text_query_with_embedder_works(auth):
    from fastapi.testclient import TestClient

    from app.main import create_app

    class Fake:
        name = "fake"

        def embed_query(self, text):
            return fake_chunk(4)["embedding"]

    with TestClient(create_app(make_settings(), embedder=Fake())) as c:
        ingest(c, auth, [fake_chunk(i) for i in range(6)])
        r = c.post("/v1/search", json={"query": "anything"}, headers=auth).json()
        assert r["results"][0]["document_id"] == "DOC_4"


# ---------- errors & privacy ----------
def test_unexpected_errors_do_not_leak_internals(auth, monkeypatch):
    from fastapi.testclient import TestClient

    from app import main
    from app.main import create_app

    def boom(*a, **k):
        raise RuntimeError("SELECT secret FROM users; password=hunter2")

    monkeypatch.setattr(main.repo, "search", boom)
    with TestClient(create_app(make_settings()), raise_server_exceptions=False) as c:
        r = c.post("/v1/search", json={"embedding": [0.1] * 384}, headers=auth)
    assert r.status_code == 500 and r.json()["error"]["code"] == "internal_error"
    assert "hunter2" not in r.text and "SELECT" not in r.text and "Traceback" not in r.text
    assert r.json()["error"]["request_id"] == r.headers["X-Request-ID"]


def test_request_id_is_sanitised_and_responses_not_cached(client):
    r = client.get("/health", headers={"X-Request-ID": "bad id\r\nX-Injected: 1"})
    assert "X-Injected" not in r.headers and len(r.headers["X-Request-ID"]) >= 8
    assert r.headers["Cache-Control"] == "no-store" and r.headers["X-Content-Type-Options"] == "nosniff"
    ok = client.get("/health", headers={"X-Request-ID": "abc-12345678"})
    assert ok.headers["X-Request-ID"] == "abc-12345678"


def test_oversized_body_rejected(client, auth):
    r = client.post("/v1/ingest", content=b"x" * 5_000_100, headers={**auth, "Content-Type": "application/json"})
    assert r.status_code == 413


# ---------- the real legal data ----------
def test_real_chunks_load_and_self_retrieve(client, auth, real_chunks):
    r = ingest(client, auth, real_chunks[:80]).json()
    r2 = ingest(client, auth, real_chunks[:80]).json()
    assert r["inserted"] == 80 and r2["inserted"] == 0 and count() == 80
    for idx in (0, 17, 42, 79):
        q = real_chunks[idx]
        res = client.post("/v1/search", json={"embedding": q["embedding"], "top_k": 1}, headers=auth).json()["results"][0]
        assert res["document_id"] == q["document_id"] and res["text"] == q["text"] and res["score"] > 0.999
