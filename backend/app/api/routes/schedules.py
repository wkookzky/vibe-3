from fastapi import APIRouter

from app.db.sqlite import get_connection

router = APIRouter()


@router.get("")
def list_schedules() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, event_type, starts_at, ends_at, owner_name, visibility
            FROM schedule_events
            ORDER BY starts_at
            """
        ).fetchall()

    return [dict(row) for row in rows]
