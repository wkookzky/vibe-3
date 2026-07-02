import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

TEST_DATABASE = Path(tempfile.gettempdir()) / "admin_superapp_test.db"
if TEST_DATABASE.exists():
    TEST_DATABASE.unlink()

os.environ["DATABASE_PATH"] = str(TEST_DATABASE)

from fastapi.testclient import TestClient

from app.main import app
from app.services import news_collector
from app.services.news_collector import ScrapedNewsArticle
from app.services.news_scheduler import KST, previous_kst_date


def test_health_check_reports_database_connection() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["api"]["status"] == "ok"
    assert body["database"]["connected"] is True
    assert body["database"]["driver"] == "sqlite"


def test_team_members_endpoint_returns_seeded_members() -> None:
    with TestClient(app) as client:
        response = client.get("/api/team-members")

    assert response.status_code == 200
    members = response.json()
    assert isinstance(members, list)
    assert len(members) >= 1
    assert {"id", "name", "role", "department"} <= set(members[0])


def test_news_endpoint_returns_seeded_articles() -> None:
    with TestClient(app) as client:
        response = client.get("/api/news")

    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["page_size"] == 10
    assert body["total"] >= 1
    assert body["total_pages"] >= 1
    assert len(body["items"]) >= 1
    assert isinstance(body["items"][0]["keywords"], list)
    assert {"image_url", "category", "has_image", "collected_at"} <= set(body["items"][0])


def test_news_endpoint_filters_by_published_date() -> None:
    with TestClient(app) as client:
        response = client.get("/api/news", params={"published_date": "2026-07-01"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert all(item["published_at"].startswith("2026-07-01") for item in body["items"])


def test_collect_news_endpoint_requires_target_date() -> None:
    with TestClient(app) as client:
        response = client.post("/api/news/collect", json={})

    assert response.status_code == 422


def test_collect_news_endpoint_upserts_articles_for_target_date(monkeypatch) -> None:
    article = ScrapedNewsArticle(
        id="news-test-collect",
        title="경제 정책 테스트 기사",
        source="대한민국 정책브리핑",
        published_at="2026-07-02T09:00:00+09:00",
        summary="테스트 수집 기사 요약입니다.",
        url="https://example.com/news/test-collect",
        image_url="https://example.com/image.jpg",
        category="경제",
        has_image=True,
        keywords=["경제", "정책", "테스트"],
    )

    def fake_fetch(target_date, client=None, max_pages=20):
        assert target_date.isoformat() == "2026-07-02"
        return [article], 0

    monkeypatch.setattr(news_collector, "fetch_policy_news_by_date", fake_fetch)

    with TestClient(app) as client:
        collect_response = client.post("/api/news/collect", json={"target_date": "2026-07-02"})
        list_response = client.get("/api/news", params={"page_size": 50, "published_date": "2026-07-02"})

    assert collect_response.status_code == 200
    assert collect_response.json() == {
        "target_date": "2026-07-02",
        "inserted": 1,
        "updated": 0,
        "total": 1,
        "failed": 0,
        "status": "success",
    }
    assert list_response.status_code == 200
    articles = list_response.json()["items"]
    collected = next(item for item in articles if item["id"] == "news-test-collect")
    assert collected["title"] == "경제 정책 테스트 기사"
    assert collected["has_image"] is True
    assert collected["keywords"] == ["경제", "정책", "테스트"]


def test_collect_news_endpoint_updates_existing_url(monkeypatch) -> None:
    first_article = ScrapedNewsArticle(
        id="news-test-update",
        title="기존 제목",
        source="대한민국 정책브리핑",
        published_at="2026-07-03T09:00:00+09:00",
        summary="기존 요약입니다.",
        url="https://example.com/news/test-update",
        image_url="",
        category="기타",
        has_image=False,
        keywords=["기타"],
    )
    updated_article = ScrapedNewsArticle(
        **{**first_article.__dict__, "title": "수정된 제목", "summary": "수정된 요약입니다."}
    )
    calls = [first_article, updated_article]

    def fake_fetch(target_date, client=None, max_pages=20):
        return [calls.pop(0)], 0

    monkeypatch.setattr(news_collector, "fetch_policy_news_by_date", fake_fetch)

    with TestClient(app) as client:
        first_response = client.post("/api/news/collect", json={"target_date": "2026-07-03"})
        second_response = client.post("/api/news/collect", json={"target_date": "2026-07-03"})
        list_response = client.get("/api/news", params={"published_date": "2026-07-03"})

    assert first_response.json()["inserted"] == 1
    assert second_response.json()["updated"] == 1
    assert list_response.json()["items"][0]["title"] == "수정된 제목"


def test_previous_kst_date_returns_yesterday_in_kst() -> None:
    now = datetime(2026, 7, 2, 0, 30, tzinfo=KST)

    assert previous_kst_date(now).isoformat() == "2026-07-01"
