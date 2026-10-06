import uuid
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import logger
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.api.v1.router import api_router
from app.api.v1.endpoints import health, auth, documents, lab, health_summary, timeline, fhir, copilot
from app.db.base import Base
from app.db.session import engine
import app.models  # noqa: F401

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI-Powered Personal Health Copilot Backend REST API - Security Hardened",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# 1. Register OWASP Security Headers Middleware (Outer Layer)
app.add_middleware(SecurityHeadersMiddleware)

# 2. Register Tiered Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# 3. Secure CORS Configuration (Explicit origins, methods, headers, and preflight max-age)
origins = settings.CORS_ORIGINS
if not origins:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-Request-ID",
    ],
    expose_headers=[
        "Content-Disposition",
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
    ],
    max_age=600,
)


@app.on_event("startup")
def on_startup():
    # Enforce environment and secret validations
    settings.validate_production_security()
    # Initialize and verify database tables
    Base.metadata.create_all(bind=engine)
    logger.info("Security hardening verified. Database schema initialized.")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Retrieve correlation request ID
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.info(f"Incoming request [{req_id}]: {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(
            f"Completed request [{req_id}]: {request.method} {request.url.path} - Status: {response.status_code}"
        )
        return response
    except Exception as exc:
        logger.error(
            f"Unhandled exception on [{req_id}] {request.url.path}: {exc}",
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An internal server error occurred. Please try again later.",
                "request_id": req_id,
            },
        )


# Global Error Sanitization Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Sanitizes Pydantic validation errors so internal python types are not leaked."""
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    sanitized_errors = []
    for error in exc.errors():
        field_loc = " -> ".join(str(loc) for loc in error.get("loc", []))
        sanitized_errors.append(
            {
                "field": field_loc,
                "message": error.get("msg", "Invalid input value"),
            }
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Request validation failed. Please check input fields.",
            "errors": sanitized_errors,
            "request_id": req_id,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Standardized clean HTTP error response."""
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "request_id": req_id,
        },
        headers=exc.headers,
    )


# Direct endpoints for easy access and container probes
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(health.router, prefix="", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(lab.router, prefix="/api/lab", tags=["Laboratory"])
app.include_router(health_summary.router, prefix="/api/health-summary", tags=["Health Summary"])
app.include_router(timeline.router, prefix="/api/timeline", tags=["Timeline"])
app.include_router(fhir.router, prefix="/api/fhir", tags=["FHIR & ABDM"])
app.include_router(copilot.router, prefix="/api/copilot", tags=["Personal Health Copilot"])

# API v1 versioned routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "security": "hardened",
        "docs": "/docs",
        "health": "/api/health",
        "auth": {
            "register": "/api/auth/register",
            "login": "/api/auth/login",
            "me": "/api/auth/me",
        },
        "documents": {
            "upload": "/api/documents/upload",
            "list": "/api/documents",
        },
    }
