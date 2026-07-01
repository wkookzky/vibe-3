import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = "공공직군 행정업무 슈퍼앱 API"
    app_env: str = os.getenv("APP_ENV", "local")
    database_path: Path = Path(os.getenv("DATABASE_PATH", "data/app.db"))
    cors_origins: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")
        object.__setattr__(self, "cors_origins", [origin.strip() for origin in origins.split(",")])


settings = Settings()
