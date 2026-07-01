from fastapi import APIRouter

from app.db.sqlite import get_connection

router = APIRouter()


@router.get("")
def list_news() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, source, published_at, summary, url, keywords
            FROM news_articles
            ORDER BY published_at DESC
            """
        ).fetchall()

    return [
        {
            **dict(row),
            "keywords": row["keywords"].split(",") if row["keywords"] else [],
        }
        for row in rows
    ]
