import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = "Public Admin SuperApp API"
    app_env: str = os.getenv("APP_ENV", "local")
    database_path: Path = Path(os.getenv("DATABASE_PATH", "data/app.db"))
    cors_origins: list[str] = field(default_factory=list)
    cors_origin_regex: str = ""

    def __post_init__(self) -> None:
        origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,https://wkookzky.github.io",
        )
        origin_regex = os.getenv("CORS_ORIGIN_REGEX", r"^https://([a-z0-9-]+\.)?github\.io$")
        object.__setattr__(self, "cors_origins", [origin.strip() for origin in origins.split(",") if origin.strip()])
        object.__setattr__(self, "cors_origin_regex", origin_regex)


settings = Settings()
