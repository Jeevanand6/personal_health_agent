import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware injecting OWASP recommended security headers, cache controls,
    and unique request correlation IDs on every HTTP response.
    """

    async def dispatch(self, request: Request, call_next):
        # 1. Resolve or generate correlation request ID
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        # Attach request_id to request state for access in logging and error handlers
        request.state.request_id = request_id

        response: Response = await call_next(request)

        # 2. Attach correlation header
        response.headers["X-Request-ID"] = request_id

        # 3. OWASP Core Defense Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )

        # 4. Content Security Policy (strict self-grounded with preview allowances)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; "
            "frame-ancestors 'self'; "
            "object-src 'none'; "
            "base-uri 'self';"
        )

        # 5. HSTS (Strict-Transport-Security) for production / secure environments
        if not settings.DEBUG or settings.is_production():
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # 6. Anti-caching for sensitive clinical and authenticated endpoints
        path = request.url.path
        if (
            path.startswith("/api/auth")
            or path.startswith("/api/documents")
            or path.startswith("/api/fhir")
            or path.startswith("/api/health-summary")
            or path.startswith("/api/lab")
            or path.startswith("/api/timeline")
        ):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"

        return response
