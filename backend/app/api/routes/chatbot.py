from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
def chatbot_status() -> dict:
    return {
        "module": "chatbot",
        "status": "scaffolded",
        "features": ["manual-upload", "rag-search", "response-draft"],
    }
