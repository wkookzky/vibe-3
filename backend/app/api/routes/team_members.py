from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.sqlite import get_connection

router = APIRouter()


class TeamMemberPayload(BaseModel):
    name: str
    role: str
    department: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_member_payload(payload: TeamMemberPayload) -> tuple[str, str, str]:
    name = payload.name.strip()
    role = payload.role.strip()
    department = payload.department.strip()

    if not name:
        raise HTTPException(status_code=422, detail="팀원 이름을 입력하세요.")
    if not role:
        raise HTTPException(status_code=422, detail="직책을 입력하세요.")
    if not department:
        raise HTTPException(status_code=422, detail="부서를 입력하세요.")

    return name, role, department


@router.get("")
def list_team_members() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, name, role, department, created_at, updated_at
            FROM team_members
            ORDER BY department, name
            """
        ).fetchall()

    return [dict(row) for row in rows]


@router.post("", status_code=201)
def create_team_member(payload: TeamMemberPayload) -> dict:
    name, role, department = validate_member_payload(payload)
    member_id = f"member-{uuid4().hex}"
    now = utc_now()

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO team_members (id, name, role, department, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (member_id, name, role, department, now, now),
        )

    return get_team_member(member_id)


@router.get("/{member_id}")
def get_team_member(member_id: str) -> dict:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, name, role, department, created_at, updated_at
            FROM team_members
            WHERE id = ?
            """,
            (member_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")
    return dict(row)


@router.patch("/{member_id}")
def update_team_member(member_id: str, payload: TeamMemberPayload) -> dict:
    name, role, department = validate_member_payload(payload)
    now = utc_now()

    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE team_members
            SET name = ?, role = ?, department = ?, updated_at = ?
            WHERE id = ?
            """,
            (name, role, department, now, member_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")

    return get_team_member(member_id)


@router.delete("/{member_id}", status_code=204)
def delete_team_member(member_id: str) -> None:
    with get_connection() as connection:
        event_count = connection.execute(
            "SELECT COUNT(*) FROM schedule_events WHERE member_id = ?",
            (member_id,),
        ).fetchone()[0]
        if event_count > 0:
            raise HTTPException(status_code=409, detail="일정이 있는 팀원은 삭제할 수 없습니다.")

        cursor = connection.execute("DELETE FROM team_members WHERE id = ?", (member_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")
