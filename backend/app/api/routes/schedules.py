from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db.sqlite import get_connection

router = APIRouter()

EVENT_TYPES = {"vacation", "work", "business_trip", "training", "remote", "etc"}


class SchedulePayload(BaseModel):
    title: str
    member_id: str
    event_type: str
    starts_at: str
    ends_at: str
    memo: str = ""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_event_payload(payload: SchedulePayload) -> None:
    if not payload.title.strip():
        raise HTTPException(status_code=422, detail="일정 제목을 입력하세요.")
    if payload.event_type not in EVENT_TYPES:
        raise HTTPException(status_code=422, detail="지원하지 않는 일정 유형입니다.")

    try:
        starts_at = datetime.fromisoformat(payload.starts_at.replace("Z", "+00:00"))
        ends_at = datetime.fromisoformat(payload.ends_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="일정 날짜 형식이 올바르지 않습니다.") from exc

    if starts_at >= ends_at:
        raise HTTPException(status_code=422, detail="종료일시는 시작일시보다 이후여야 합니다.")


def schedule_row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "member_id": row["member_id"],
        "member_name": row["member_name"],
        "member_role": row["member_role"],
        "member_department": row["member_department"],
        "title": row["title"],
        "event_type": row["event_type"],
        "starts_at": row["starts_at"],
        "ends_at": row["ends_at"],
        "memo": row["memo"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@router.get("")
def list_schedules(
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
) -> list[dict]:
    conditions: list[str] = []
    params: list[str] = []

    if from_date:
        conditions.append("e.ends_at >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("e.starts_at <= ?")
        params.append(to_date)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT
                e.id,
                e.member_id,
                m.name AS member_name,
                m.role AS member_role,
                m.department AS member_department,
                e.title,
                e.event_type,
                e.starts_at,
                e.ends_at,
                e.memo,
                e.created_at,
                e.updated_at
            FROM schedule_events e
            JOIN team_members m ON m.id = e.member_id
            {where_clause}
            ORDER BY e.starts_at, m.name
            """,
            params,
        ).fetchall()

    return [schedule_row_to_dict(row) for row in rows]


@router.post("", status_code=201)
def create_schedule(payload: SchedulePayload) -> dict:
    validate_event_payload(payload)
    event_id = f"evt-{uuid4().hex}"
    now = utc_now()

    with get_connection() as connection:
        member = connection.execute(
            "SELECT id FROM team_members WHERE id = ?",
            (payload.member_id,),
        ).fetchone()
        if member is None:
            raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")

        connection.execute(
            """
            INSERT INTO schedule_events
            (id, member_id, title, event_type, starts_at, ends_at, memo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                payload.member_id,
                payload.title.strip(),
                payload.event_type,
                payload.starts_at,
                payload.ends_at,
                payload.memo.strip(),
                now,
                now,
            ),
        )

    return get_schedule(event_id)


@router.get("/{event_id}")
def get_schedule(event_id: str) -> dict:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                e.id,
                e.member_id,
                m.name AS member_name,
                m.role AS member_role,
                m.department AS member_department,
                e.title,
                e.event_type,
                e.starts_at,
                e.ends_at,
                e.memo,
                e.created_at,
                e.updated_at
            FROM schedule_events e
            JOIN team_members m ON m.id = e.member_id
            WHERE e.id = ?
            """,
            (event_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
    return schedule_row_to_dict(row)


@router.patch("/{event_id}")
def update_schedule(event_id: str, payload: SchedulePayload) -> dict:
    validate_event_payload(payload)
    now = utc_now()

    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id FROM schedule_events WHERE id = ?",
            (event_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")

        member = connection.execute(
            "SELECT id FROM team_members WHERE id = ?",
            (payload.member_id,),
        ).fetchone()
        if member is None:
            raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")

        connection.execute(
            """
            UPDATE schedule_events
            SET member_id = ?,
                title = ?,
                event_type = ?,
                starts_at = ?,
                ends_at = ?,
                memo = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                payload.member_id,
                payload.title.strip(),
                payload.event_type,
                payload.starts_at,
                payload.ends_at,
                payload.memo.strip(),
                now,
                event_id,
            ),
        )

    return get_schedule(event_id)


@router.delete("/{event_id}", status_code=204)
def delete_schedule(event_id: str) -> None:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM schedule_events WHERE id = ?", (event_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
