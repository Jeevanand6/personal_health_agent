from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json
import os
import re

DEFAULT_DEV_SECRET = "dev-secret-key-health-copilot-2026-super-secure"


class Settings(BaseSettings):
    APP_NAME: str = "AI-Powered Personal Health Copilot"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Security
    SECRET_KEY: str = DEFAULT_DEV_SECRET
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 120
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10
    UPLOAD_RATE_LIMIT_PER_MINUTE: int = 30

    # Database: defaults to SQLite for local standalone run; overridden by environment / Docker to PostgreSQL
    DATABASE_URL: str = "sqlite:///./health_copilot.db"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or len(v.strip()) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long for cryptographic security.")
        return v.strip()

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        valid_schemes = ("sqlite:///", "postgresql://", "postgresql+psycopg2://")
        if not any(v.startswith(scheme) for scheme in valid_schemes):
            raise ValueError(
                f"DATABASE_URL scheme is not supported. Must start with one of: {valid_schemes}"
            )
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        default_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ]
        parsed: List[str] = []
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                except Exception:
                    parsed = default_origins
            else:
                parsed = [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            parsed = v
        else:
            parsed = default_origins

        # Never permit wildcard '*' when credentials are required (browser CORS standard)
        cleaned = [origin.rstrip("/") for origin in parsed if origin and origin != "*"]
        return cleaned if cleaned else default_origins

    # Storage
    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_DIR: str = "./storage_data"
    MAX_UPLOAD_SIZE_BYTES: int = 15728640  # 15 MB

    @field_validator("MAX_UPLOAD_SIZE_BYTES")
    @classmethod
    def validate_max_upload_size(cls, v: int) -> int:
        if v < 1048576 or v > 52428800:
            raise ValueError("MAX_UPLOAD_SIZE_BYTES must be between 1 MB (1048576) and 50 MB (52428800).")
        return v

    # AI & LLM Provider Configuration
    AI_PROVIDER: str = "auto"
    GEMINI_API_KEY: Union[str, None] = None
    GEMINI_MODEL: str = "gemini-3.8-flash"
    OPENAI_API_KEY: Union[str, None] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_BASE_URL: Union[str, None] = None

    # Medical Prescription OCR & Extraction Configuration
    # Options: "auto", "huggingface_endpoint", "huggingface_local", "gemini_vision", "hybrid_ocr_llm"
    PRESCRIPTION_OCR_BACKEND: str = "auto"
    HUGGINGFACE_API_KEY: Union[str, None] = None
    HF_PRESCRIPTION_MODEL_ID: str = "KushagraWadhwa/medical-prescription-ocr-india"
    HF_PRESCRIPTION_ENDPOINT_URL: Union[str, None] = None
    PRESCRIPTION_CONFIDENCE_THRESHOLD: float = 0.70

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )

    def is_production(self) -> bool:
        return self.APP_ENV.lower() in ("production", "prod") or not self.DEBUG

    def validate_production_security(self) -> None:
        """Enforces strict security checks if running in production."""
        if self.is_production():
            if self.SECRET_KEY == DEFAULT_DEV_SECRET or "dev-secret" in self.SECRET_KEY.lower():
                raise RuntimeError(
                    "FATAL SECURITY VIOLATION: Default or development SECRET_KEY detected in production environment! "
                    "Generate a cryptographically secure random secret key (e.g. `openssl rand -hex 32`)."
                )
            if any("localhost" in origin or "127.0.0.1" in origin for origin in self.CORS_ORIGINS):
                # Warning in production for localhost CORS
                pass


settings = Settings()
