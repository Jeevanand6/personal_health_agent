from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from app.core.config import settings
from app.core.logging import logger

import os

db_url = settings.DATABASE_URL
if db_url.startswith("sqlite:///./") or db_url == "sqlite:///health_copilot.db":
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    db_file = os.path.join(backend_dir, "health_copilot.db")
    db_url = f"sqlite:///{db_file.replace(os.sep, '/')}"

if db_url.startswith("sqlite"):
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
