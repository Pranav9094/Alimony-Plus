import json
import os
import pathlib

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

DB_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://rag_app:testpw@127.0.0.1:5432/alimony_rag_test")
API_KEY = "k" * 40
CHUNKS_FILE = pathlib.Path(__file__).resolve().parents[3] / "ai" / "legal_sources" / "embedded_chunks.json"


def make_settings(**kw) -> Settings:
    base = dict(database_url=DB_URL, service_api_key=API_KEY, db_acquire_timeout=2.0)
    base.update(kw)
    return Settings(**base)


@pytest.fixture(scope="session", autouse=True)
def schema():
    try:
        with psycopg.connect(DB_URL, autocommit=True, connect_timeout=3) as conn:
            conn.execute((pathlib.Path(__file__).resolve().parents[1] / "app" / "schema.sql").read_text())
    except psycopg.OperationalError:
        pytest.skip("test database not reachable (set TEST_DATABASE_URL)", allow_module_level=False)


@pytest.fixture(autouse=True)
def empty_table(schema):
    with psycopg.connect(DB_URL, autocommit=True) as conn:
        conn.execute("TRUNCATE legal_chunks RESTART IDENTITY")


@pytest.fixture
def client():
    with TestClient(create_app(make_settings()), raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def auth():
    return {"X-API-Key": API_KEY}


@pytest.fixture(scope="session")
def real_chunks():
    return json.loads(CHUNKS_FILE.read_text(encoding="utf-8"))


def fake_chunk(i=0, **kw):
    vec = [0.0] * 384
    vec[i % 384] = 1.0
    c = dict(document_id=f"DOC_{i}", title=f"Title {i}", document_type="statute", section="content",
             text=f"text {i}", source_url="https://example.org/x", authority="Gov", official_source=True,
             jurisdiction="India", language="en", embedding=vec)
    c.update(kw)
    return c
