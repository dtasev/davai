import pytest
from io import StringIO
from django.core.management import call_command
from tracker.models import WorkItem, Project, Context, Progress, WorkItemEmbedding
from tracker.embedding import (
    format_work_item_text,
    compute_content_hash,
    index_work_item,
    MockEmbeddingProvider,
)


@pytest.mark.django_db
class TestVectorSearchAndEmbedding:
    def test_format_work_item_text_and_hash(self, test_project, test_user):
        item = WorkItem.objects.create(
            project=test_project,
            key=f"{test_project.key}-100",
            title="Design Authentication Service",
            description="Build OIDC integration with Authelia",
            priority="HIGH",
            created_by=test_user,
        )
        Context.objects.create(
            work_item=item,
            user=test_user,
            summary="Technical context: RFC 6749 compliant OIDC flow."
        )
        Progress.objects.create(
            work_item=item,
            created_by=test_user,
            summary="Configured authorization endpoint",
            status="step completed"
        )

        formatted = format_work_item_text(item)
        assert f"Key: {item.key}" in formatted
        assert "Design Authentication Service" in formatted
        assert "RFC 6749 compliant" in formatted
        assert "Configured authorization endpoint" in formatted

        h1 = compute_content_hash(formatted)
        h2 = compute_content_hash(formatted)
        assert h1 == h2
        assert len(h1) == 64

    def test_mock_embedding_provider_shape(self):
        provider = MockEmbeddingProvider()
        vec = provider.embed_query("Hello semantic search")
        assert len(vec) == 384
        assert isinstance(vec[0], float)

        batch = provider.embed_documents(["doc 1", "doc 2"])
        assert len(batch) == 2
        assert len(batch[0]) == 384

    def test_auto_indexing_signal_lifecycle(self, test_project, test_user):
        item = WorkItem.objects.create(
            project=test_project,
            key=f"{test_project.key}-101",
            title="Database Connection Pooling",
            description="Tune PostgreSQL max_connections and pgbouncer",
            priority="MEDIUM",
            created_by=test_user,
        )

        # WorkItem signal auto-created embedding
        assert hasattr(item, "embedding")
        original_hash = item.embedding.content_hash
        assert len(item.embedding.embedding) == 384

        # Updating non-embedded metadata field (e.g. source) shouldn't change text hash if empty
        item.source = "https://example.com/tickets/1"
        item.save()
        item.refresh_from_db()
        assert item.embedding.content_hash == original_hash

        # Adding progress should trigger re-indexing
        Progress.objects.create(
            work_item=item,
            created_by=test_user,
            summary="Added pgbouncer config file",
            status="step completed",
        )
        item.refresh_from_db()
        assert item.embedding.content_hash != original_hash

    def test_search_api_hybrid_and_modes(self, ninja_client, test_project, test_user):
        # Create work items with distinctive topics
        item1 = WorkItem.objects.create(
            project=test_project,
            key=f"{test_project.key}-201",
            title="Kubernetes Ingress Controller Upgrade",
            description="Update traefik ingress controller to latest stable release",
            priority="HIGH",
            created_by=test_user,
        )
        item2 = WorkItem.objects.create(
            project=test_project,
            key=f"{test_project.key}-202",
            title="Fix React Button Alignment",
            description="CSS flexbox centering issue in navigation header bar",
            priority="LOW",
            created_by=test_user,
        )

        # 1. Search with semantic query in project
        res = ninja_client.get(f"/projects/{test_project.key}/search?q=k8s+cluster+networking")
        assert res.status_code == 200
        data = res.json()
        assert data["mode"] == "hybrid"
        assert data["total"] > 0
        top = data["results"][0]
        assert top["work_item"]["key"] == item1.key
        assert top["score"] == 1.0

        # 2. Search mode=keyword
        res_kw = ninja_client.get(f"/projects/{test_project.key}/search?q=flexbox&mode=keyword")
        assert res_kw.status_code == 200
        data_kw = res_kw.json()
        assert data_kw["mode"] == "keyword"
        assert len(data_kw["results"]) == 1
        assert data_kw["results"][0]["work_item"]["key"] == item2.key
        assert data_kw["results"][0]["match_type"] == "keyword"

        # 3. Search with priority filter
        res_filtered = ninja_client.get(f"/projects/{test_project.key}/search?q=upgrade&priority=LOW")
        assert res_filtered.status_code == 200
        data_filtered = res_filtered.json()
        for r in data_filtered["results"]:
            assert r["work_item"]["priority"] == "LOW"

        # 4. Global search endpoint
        res_global = ninja_client.get("/search?q=Kubernetes")
        assert res_global.status_code == 200
        data_global = res_global.json()
        assert any(r["work_item"]["key"] == item1.key for r in data_global["results"])

        # 5. Empty query returns recent items
        res_empty = ninja_client.get(f"/projects/{test_project.key}/search?q=")
        assert res_empty.status_code == 200
        assert res_empty.json()["total"] >= 2

    def test_backfill_management_command(self, test_project, test_user):
        item = WorkItem.objects.create(
            project=test_project,
            key=f"{test_project.key}-301",
            title="Backfill Test Item",
            description="Testing backfill command",
            created_by=test_user,
        )
        # Delete embedding to simulate unindexed item
        WorkItemEmbedding.objects.filter(work_item=item).delete()
        item.refresh_from_db()
        assert not hasattr(item, "embedding")

        out = StringIO()
        call_command("backfill_embeddings", project=test_project.key, stdout=out)
        output = out.getvalue()
        assert "Embedding backfill complete" in output

        item.refresh_from_db()
        assert hasattr(item, "embedding")
        assert len(item.embedding.embedding) == 384
