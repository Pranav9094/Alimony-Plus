class EmbedderUnavailable(RuntimeError):
    pass


class UnavailableEmbedder:
    """Default: no model is loaded, so callers must send their own query embedding."""

    name = "none"

    def embed_query(self, text: str) -> list[float]:
        raise EmbedderUnavailable("text queries are not enabled; send an embedding or set EMBEDDER=e5-small")


class E5Embedder:
    """multilingual-e5-small. Queries use the 'query: ' prefix (stored passages use 'passage: ')."""

    def __init__(self, model_name: str):
        self.name = model_name
        self._model = None

    def embed_query(self, text: str) -> list[float]:
        try:
            if self._model is None:
                from sentence_transformers import SentenceTransformer  # lazy: heavy import

                self._model = SentenceTransformer(self.name)
            vec = self._model.encode(f"query: {text}", normalize_embeddings=True)
        except Exception as exc:  # model missing / download blocked / OOM
            raise EmbedderUnavailable("embedding model could not be loaded") from exc
        return [float(x) for x in vec]


def build_embedder(kind: str, model_name: str):
    if kind == "e5-small":
        return E5Embedder(model_name)
    return UnavailableEmbedder()
