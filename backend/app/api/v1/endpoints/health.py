from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db
from app.schemas.health import HealthResponse
from app.core.logging import logger

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint that verifies API and PostgreSQL database connectivity."""
    db_status = "disconnected"
    try:
        # Ping PostgreSQL database
        db.execute(text("SELECT 1"))
        db_status = "connected"
        return {"status": "healthy", "database": db_status}
    except Exception as exc:
        logger.error(f"Health check database query failed: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "database": db_status},
        )
