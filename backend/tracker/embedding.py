import hashlib
import os
import logging
from abc import ABC, abstractmethod
from typing import List, Optional

logger = logging.getLogger(__name__)

EMBEDDING_DIMENSIONS = 384
DEFAULT_MODEL_NAME = "BAAI/bge-small-en-v1.5"


def compute_content_hash(text: str) -> str:
    """Computes a deterministic SHA-256 hash of the normalized text."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def format_work_item_text(work_item) -> str:
    """
    Builds a structured markdown text representation of a WorkItem
    including its key, title, priority, description, context summary,
    and recent progress logs.
    """
    parts = [
        f"Key: {work_item.key}",
        f"Title: {work_item.title}",
        f"Priority: {work_item.priority}",
    ]
    if work_item.project:
        parts.append(f"Project: {work_item.project.key} - {work_item.project.name}")

    if work_item.description and work_item.description.strip():
        parts.append(f"Description:\n{work_item.description.strip()}")

    # Context summary if available
    context = getattr(work_item, "context", None)
    if context and context.summary and context.summary.strip():
        parts.append(f"Context / Technical Specs:\n{context.summary.strip()}")

    # Include recent progress updates (up to 5 entries)
    recent_progress = list(work_item.progress.order_by("-created_at")[:5])
    if recent_progress:
        progress_lines = []
        for p in recent_progress:
            ts = p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else ""
            progress_lines.append(f"- [{ts}] ({p.status}): {p.summary.strip()}")
        parts.append("Recent Progress Notes:\n" + "\n".join(progress_lines))

    return "\n\n".join(parts)


class BaseEmbeddingProvider(ABC):
    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding vector for a single query."""
        pass

    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for multiple documents."""
        pass


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic pseudo-embedding for testing or offline environments
    without external dependencies.
    """
    def _hash_to_vec(self, text: str) -> List[float]:
        h = hashlib.sha256(text.encode("utf-8")).digest()
        # Create a unit-normalized vector of size 384
        raw = [(b / 255.0) - 0.5 for b in h]
        extended = (raw * ((EMBEDDING_DIMENSIONS // len(raw)) + 1))[:EMBEDDING_DIMENSIONS]
        norm = sum(x * x for x in extended) ** 0.5 or 1.0
        return [x / norm for x in extended]

    def embed_query(self, text: str) -> List[float]:
        return self._hash_to_vec(text)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._hash_to_vec(t) for t in texts]


class FastEmbedProvider(BaseEmbeddingProvider):
    """
    In-process ONNX Runtime embeddings using FastEmbed.
    Default model: BAAI/bge-small-en-v1.5 (384 dimensions).
    Fast, CPU-optimized, runs entirely within the local container without external API keys.
    """
    _model = None

    def __init__(self, model_name: str = DEFAULT_MODEL_NAME):
        self.model_name = model_name

    def _get_model(self):
        if FastEmbedProvider._model is None:
            from fastembed import TextEmbedding
            logger.info("Initializing FastEmbed model: %s", self.model_name)
            FastEmbedProvider._model = TextEmbedding(model_name=self.model_name)
        return FastEmbedProvider._model

    def embed_query(self, text: str) -> List[float]:
        model = self._get_model()
        results = list(model.embed([text]))
        return [float(x) for x in results[0]]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        model = self._get_model()
        results = list(model.embed(texts))
        return [[float(x) for x in vec] for vec in results]


_active_provider: Optional[BaseEmbeddingProvider] = None


def get_embedding_provider() -> BaseEmbeddingProvider:
    global _active_provider
    if _active_provider is not None:
        return _active_provider

    provider_name = os.getenv("EMBEDDING_PROVIDER", "fastembed").lower().strip()
    if provider_name == "mock":
        _active_provider = MockEmbeddingProvider()
    else:
        try:
            _active_provider = FastEmbedProvider()
        except Exception as e:
            logger.warning("Could not initialize FastEmbed provider (%s); falling back to Mock provider.", e)
            _active_provider = MockEmbeddingProvider()

    return _active_provider


def index_work_item(work_item, force: bool = False):
    """
    Renders text for the work item, checks content hash,
    and updates WorkItemEmbedding in PostgreSQL.
    """
    from tracker.models import WorkItemEmbedding

    text = format_work_item_text(work_item)
    content_hash = compute_content_hash(text)

    embedding_obj = getattr(work_item, "embedding", None)
    if not force and embedding_obj and embedding_obj.content_hash == content_hash:
        # Content unchanged, skip re-embedding
        return embedding_obj

    provider = get_embedding_provider()
    vec = provider.embed_query(text)

    if embedding_obj:
        embedding_obj.embedding = vec
        embedding_obj.content_hash = content_hash
        embedding_obj.embedded_text = text
        embedding_obj.save(update_fields=["embedding", "content_hash", "embedded_text", "updated_at"])
    else:
        embedding_obj = WorkItemEmbedding.objects.create(
            work_item=work_item,
            embedding=vec,
            content_hash=content_hash,
            embedded_text=text,
        )

    return embedding_obj
