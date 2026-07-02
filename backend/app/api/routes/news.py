from datetime import date
from math import ceil

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db.sqlite import get_connection
from app.services.news_collector import collect_policy_news_for_date

router = APIRouter()


class NewsCollectPayload(BaseModel):
    target_date: date


def news_row_to_dict(row) -> dict:
    return {
        **dict(row),
        "keywords": row["keywords"].split(",") if row["keywords"] else [],
        "has_image": bool(row["has_image"]),
    }


@router.get("")
def list_news(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    published_date: date | None = Query(default=None),
) -> dict:
    offset = (page - 1) * page_size
    conditions: list[str] = []
    params: list[str | int] = []

    if published_date is not None:
        conditions.append("substr(published_at, 1, 10) = ?")
        params.append(published_date.isoformat())

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_connection() as connection:
        total = connection.execute(f"SELECT COUNT(*) FROM news_articles {where_clause}", params).fetchone()[0]
        rows = connection.execute(
            f"""
            SELECT id, title, source, published_at, summary, url, keywords,
                   image_url, category, has_image, collected_at
            FROM news_articles
            {where_clause}
            ORDER BY published_at DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            [*params, page_size, offset],
        ).fetchall()

    total_pages = ceil(total / page_size) if total else 1
    return {
        "items": [news_row_to_dict(row) for row in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


@router.post("/collect")
def collect_news(payload: NewsCollectPayload) -> dict:
    try:
        result = collect_policy_news_for_date(payload.target_date, trigger_type="manual")
    except Exception as exc:
        raise HTTPException(status_code=502, detail="뉴스 수집 중 외부 사이트 요청에 실패했습니다.") from exc

    return {
        "target_date": result.target_date,
        "inserted": result.inserted,
        "updated": result.updated,
        "total": result.total,
        "failed": result.failed,
        "status": result.status,
    }
