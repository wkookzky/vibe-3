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
    connection.execute("PRAGMA foreign_keys = ON")
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
        ensure_schedule_schema(connection)
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


def ensure_schedule_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS team_members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            department TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    table_info = connection.execute("PRAGMA table_info(schedule_events)").fetchall()
    existing_columns = {row["name"] for row in table_info}

    if not existing_columns:
        create_schedule_events_table(connection)
        return

    if "member_id" in existing_columns:
        return

    connection.execute("ALTER TABLE schedule_events RENAME TO schedule_events_legacy")
    create_schedule_events_table(connection)
    now = datetime.now(timezone.utc).isoformat()

    legacy_rows = connection.execute(
        """
        SELECT id, title, event_type, starts_at, ends_at, owner_name
        FROM schedule_events_legacy
        ORDER BY starts_at
        """
    ).fetchall()

    member_ids_by_name: dict[str, str] = {}
    for row in legacy_rows:
        owner_name = row["owner_name"]
        member_id = member_ids_by_name.get(owner_name)
        if member_id is None:
            member_id = f"member-{len(member_ids_by_name) + 1:03d}"
            member_ids_by_name[owner_name] = member_id
            connection.execute(
                """
                INSERT INTO team_members (id, name, role, department, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (member_id, owner_name, "팀원", "행정지원팀", now, now),
            )

        connection.execute(
            """
            INSERT INTO schedule_events
            (id, member_id, title, event_type, starts_at, ends_at, memo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                member_id,
                row["title"],
                row["event_type"],
                row["starts_at"],
                row["ends_at"],
                "",
                now,
                now,
            ),
        )

    connection.execute("DROP TABLE schedule_events_legacy")


def create_schedule_events_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS schedule_events (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL,
            title TEXT NOT NULL,
            event_type TEXT NOT NULL,
            starts_at TEXT NOT NULL,
            ends_at TEXT NOT NULL,
            memo TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (member_id) REFERENCES team_members(id)
        )
        """
    )


def seed_data(connection: sqlite3.Connection) -> None:
    now = datetime.now(timezone.utc).isoformat()
    member_count = connection.execute("SELECT COUNT(*) FROM team_members").fetchone()[0]
    if member_count == 0:
        connection.executemany(
            """
            INSERT INTO team_members (id, name, role, department, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                ("member-001", "김행정", "주무관", "행정지원팀", now, now),
                ("member-002", "이민원", "민원담당", "민원서비스팀", now, now),
                ("member-003", "박지원", "팀장", "행정지원팀", now, now),
            ],
        )

    event_count = connection.execute("SELECT COUNT(*) FROM schedule_events").fetchone()[0]
    if event_count == 0:
        connection.executemany(
            """
            INSERT INTO schedule_events
            (id, member_id, title, event_type, starts_at, ends_at, memo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "evt-001",
                    "member-001",
                    "연가",
                    "vacation",
                    "2026-07-02T09:00:00+09:00",
                    "2026-07-02T18:00:00+09:00",
                    "오전 민원 창구 대체 필요",
                    now,
                    now,
                ),
                (
                    "evt-002",
                    "member-002",
                    "구청 협의 출장",
                    "business_trip",
                    "2026-07-03T10:00:00+09:00",
                    "2026-07-03T16:00:00+09:00",
                    "복지 연계 민원 협의",
                    now,
                    now,
                ),
                (
                    "evt-003",
                    "member-003",
                    "민원 응대 교육",
                    "training",
                    "2026-07-04T14:00:00+09:00",
                    "2026-07-04T17:00:00+09:00",
                    "신규 응대 매뉴얼 교육",
                    now,
                    now,
                ),
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
