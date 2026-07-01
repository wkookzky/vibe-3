import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from app.core.config import settings


def database_file() -> Path:
    return Path(__file__).resolve().parents[2] / settings.database_path


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    db_path = database_file()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize_database() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS health_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                checked_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS schedule_events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                event_type TEXT NOT NULL,
                starts_at TEXT NOT NULL,
                ends_at TEXT NOT NULL,
                owner_name TEXT NOT NULL,
                visibility TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS news_articles (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                source TEXT NOT NULL,
                published_at TEXT NOT NULL,
                summary TEXT NOT NULL,
                url TEXT NOT NULL,
                keywords TEXT NOT NULL
            )
            """
        )
        seed_data(connection)


def seed_data(connection: sqlite3.Connection) -> None:
    event_count = connection.execute("SELECT COUNT(*) FROM schedule_events").fetchone()[0]
    if event_count == 0:
        connection.executemany(
            """
            INSERT INTO schedule_events
            (id, title, event_type, starts_at, ends_at, owner_name, visibility)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("evt-001", "연가", "vacation", "2026-07-02T09:00:00+09:00", "2026-07-02T18:00:00+09:00", "김행정", "team"),
                ("evt-002", "구청 협의 출장", "business_trip", "2026-07-03T10:00:00+09:00", "2026-07-03T16:00:00+09:00", "이민원", "public"),
                ("evt-003", "민원 응대 교육", "training", "2026-07-04T14:00:00+09:00", "2026-07-04T17:00:00+09:00", "박지원", "public"),
            ],
        )

    article_count = connection.execute("SELECT COUNT(*) FROM news_articles").fetchone()[0]
    if article_count == 0:
        connection.executemany(
            """
            INSERT INTO news_articles
            (id, title, source, published_at, summary, url, keywords)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "news-001",
                    "지방행정 디지털 전환 지원 정책 확대",
                    "행정뉴스",
                    "2026-07-01T08:00:00+09:00",
                    "공공행정 업무 효율화를 위한 디지털 전환 지원 과제가 확대됩니다.",
                    "https://example.com/news/001",
                    "공공행정,디지털전환",
                ),
                (
                    "news-002",
                    "민원 서비스 품질 개선 우수사례 공유",
                    "정책브리핑",
                    "2026-07-01T08:10:00+09:00",
                    "지자체 민원 서비스 개선 사례와 상담 품질 관리 방안이 소개됐습니다.",
                    "https://example.com/news/002",
                    "민원,서비스",
                ),
            ],
        )


def verify_database() -> dict[str, str | bool]:
    checked_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as connection:
        connection.execute("INSERT INTO health_checks (checked_at) VALUES (?)", (checked_at,))
        connection.execute("SELECT COUNT(*) FROM health_checks").fetchone()

    return {
        "connected": True,
        "driver": "sqlite",
        "path": str(database_file()),
    }
