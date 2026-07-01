from datetime import datetime, timezone

from fastapi import APIRouter

from app.db.sqlite import verify_database

router = APIRouter()


@router.get("/health")
def health_check() -> dict:
    return {
        "api": {
            "status": "ok",
            "service": "admin-superapp-backend",
        },
        "database": verify_database(),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
