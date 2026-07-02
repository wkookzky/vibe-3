from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chatbot, excel, health, news, schedules, team_members
from app.core.config import settings
from app.db.sqlite import initialize_database
from app.services.news_scheduler import shutdown_news_scheduler, start_news_scheduler

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(team_members.router, prefix="/api/team-members", tags=["team-members"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["schedules"])
app.include_router(excel.router, prefix="/api/excel", tags=["excel"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["chatbot"])
app.include_router(news.router, prefix="/api/news", tags=["news"])


@app.on_event("startup")
def on_startup() -> None:
    initialize_database()
    start_news_scheduler()


@app.on_event("shutdown")
def on_shutdown() -> None:
    shutdown_news_scheduler()
