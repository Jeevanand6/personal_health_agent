from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import logger
from app.api.v1.router import api_router
from app.api.v1.endpoints import health, auth

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI-Powered Personal Health Copilot Backend REST API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Configuration
origins = settings.CORS_ORIGINS
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(
            f"Completed request: {request.method} {request.url.path} - Status: {response.status_code}"
        )
        return response
    except Exception as exc:
        logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred."},
        )


# Direct endpoints for easy access and container probes
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(health.router, prefix="", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])

# API v1 versioned routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
        "auth": {
            "register": "/api/auth/register",
            "login": "/api/auth/login",
            "me": "/api/auth/me",
        },
    }
