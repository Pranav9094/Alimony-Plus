import pytest
from pydantic import ValidationError

from app.models import ChunkIn, EmbeddingError, SearchRequest, prepare_embedding
from tests.conftest import fake_chunk


def test_search_needs_exactly_one_input():
    with pytest.raises(ValidationError):
        SearchRequest()
    with pytest.raises(ValidationError):
        SearchRequest(query="x", embedding=[0.1] * 384)
    assert SearchRequest(query="x").query == "x"


def test_search_rejects_unknown_fields_and_bad_values():
    with pytest.raises(ValidationError):
        SearchRequest(query="x", sql="DROP TABLE legal_chunks")
    with pytest.raises(ValidationError):
        SearchRequest(query="x", top_k=0)
    with pytest.raises(ValidationError):
        SearchRequest(query="x", language="EN; DROP")
    with pytest.raises(ValidationError):
        SearchRequest(embedding=[float("nan")] * 384)


@pytest.mark.parametrize("vec,code", [
    ([0.1] * 10, "embedding_dimension_mismatch"),
    ([0.0] * 384, "embedding_zero_vector"),
    ([float("inf")] + [0.1] * 383, "embedding_not_finite"),
])
def test_prepare_embedding_errors(vec, code):
    with pytest.raises(EmbeddingError) as e:
        prepare_embedding(vec, 384)
    assert e.value.code == code


def test_prepare_embedding_normalises():
    out = prepare_embedding([3.0, 4.0] + [0.0] * 382, 384)
    assert abs(sum(x * x for x in out) - 1.0) < 1e-9


@pytest.mark.parametrize("url", ["javascript:alert(1)", "data:text/html,<script>", "ftp://x", "//evil.com"])
def test_chunk_rejects_non_http_source_urls(url):
    with pytest.raises(ValidationError):
        ChunkIn(**fake_chunk(source_url=url))


def test_chunk_hash_is_stable_and_content_based():
    a, b = ChunkIn(**fake_chunk(1)), ChunkIn(**fake_chunk(1, title="renamed"))
    assert a.content_hash == b.content_hash
    assert a.content_hash != ChunkIn(**fake_chunk(1, text="different")).content_hash
