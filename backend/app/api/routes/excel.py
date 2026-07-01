from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
def excel_status() -> dict:
    return {
        "module": "excel",
        "status": "scaffolded",
        "features": ["preview", "split", "merge", "job-status"],
    }
