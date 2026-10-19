"""Load ai/legal_sources/embedded_chunks.json into pgvector. Idempotent: re-running adds no duplicates.
Usage: DATABASE_URL=... SERVICE_API_KEY=<32+ chars> python -m scripts.load_embedded_chunks [path]"""
import json
import pathlib
import sys

from app import repo
from app.config import get_settings
from app.models import ChunkIn, prepare_embedding

default = pathlib.Path(__file__).resolve().parents[3] / "ai" / "legal_sources" / "embedded_chunks.json"
path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else default
settings = get_settings()
raw = json.loads(path.read_text(encoding="utf-8"))
rows = []
for i, item in enumerate(raw):
    chunk = ChunkIn(**item)
    rows.append((chunk, prepare_embedding(chunk.embedding, settings.embedding_dim)))
pool = repo.make_pool(settings.database_url, 1, 2, settings.db_acquire_timeout)
inserted = updated = 0
for start in range(0, len(rows), settings.max_ingest_batch):
    a, b = repo.upsert_chunks(pool, rows[start:start + settings.max_ingest_batch])
    inserted, updated = inserted + a, updated + b
incomplete = sum(1 for c, _ in rows if not (c.source_url and c.authority))
print(f"loaded {len(rows)} chunks: inserted={inserted} updated={updated} citation_incomplete={incomplete}")
pool.close()
