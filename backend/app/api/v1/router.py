from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, documents, lab, health_summary, timeline, fhir

api_router = APIRouter()
api_router.include_router(health.router, prefix="", tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(lab.router, prefix="/lab", tags=["Laboratory"])
api_router.include_router(health_summary.router, prefix="/health-summary", tags=["Health Summary"])
api_router.include_router(timeline.router, prefix="/timeline", tags=["Timeline"])
api_router.include_router(fhir.router, prefix="/fhir", tags=["FHIR & ABDM"])
