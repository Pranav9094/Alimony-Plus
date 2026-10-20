"""Apply app/schema.sql (idempotent). Usage: DATABASE_URL=... python -m scripts.init_db"""
import os
import pathlib

import psycopg

sql = (pathlib.Path(__file__).resolve().parent.parent / "app" / "schema.sql").read_text()
with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn:
    conn.execute(sql)
print("schema applied")
