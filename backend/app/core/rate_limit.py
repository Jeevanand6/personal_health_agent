import time
import threading
from typing import Dict, List, Optional, Tuple
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
from app.core.logging import logger


class InMemoryRateLimiter:
    """
    Sliding-window in-memory rate limiter per client IP.
    Thread-safe and supports multiple rate tiers with automatic eviction.
    """

    def __init__(self):
        self._lock = threading.Lock()
        # Storage: { (ip, tier): [timestamp1, timestamp2, ...] }
        self._requests: Dict[Tuple[str, str], List[float]] = {}
        self._last_cleanup = time.time()

    def _cleanup_old_records(self, now: float) -> None:
        """Evicts expired request records older than 120 seconds to prevent unbounded memory growth."""
        if now - self._last_cleanup < 60:
            return
        self._last_cleanup = now
        stale_cutoff = now - 120
        keys_to_remove = []
        for key, timestamps in self._requests.items():
            valid_ts = [ts for ts in timestamps if ts > stale_cutoff]
            if not valid_ts:
                keys_to_remove.append(key)
            else:
                self._requests[key] = valid_ts
        for k in keys_to_remove:
            self._requests.pop(k, None)

    def check_rate_limit(
        self,
        client_ip: str,
        tier: str,
        max_requests: int,
        window_seconds: int = 60,
    ) -> Tuple[bool, int, int]:
        """
        Evaluates whether a request is within the allowable limit.
        Returns: (is_allowed, remaining_requests, reset_seconds)
        """
        now = time.time()
        window_start = now - window_seconds
        key = (client_ip, tier)

        with self._lock:
            self._cleanup_old_records(now)

            timestamps = self._requests.get(key, [])
            valid_timestamps = [ts for ts in timestamps if ts > window_start]

            if len(valid_timestamps) >= max_requests:
                # Rate limit exceeded
                oldest_in_window = valid_timestamps[0]
                reset_seconds = max(1, int(oldest_in_window + window_seconds - now))
                self._requests[key] = valid_timestamps
                return False, 0, reset_seconds

            valid_timestamps.append(now)
            self._requests[key] = valid_timestamps
            remaining = max(0, max_requests - len(valid_timestamps))
            return True, remaining, window_seconds

    def reset(self) -> None:
        """Clears all rate limit records (useful for test runs)."""
        with self._lock:
            self._requests.clear()


rate_limiter = InMemoryRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extracts the client IP address from headers (handling proxies) or direct connection."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    client = request.client
    return client.host if client else "127.0.0.1"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware applying tiered rate limits based on path prefix and client IP.
    """

    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        path = request.url.path

        # Exempt paths
        if path in ["/", "/docs", "/redoc", "/openapi.json", "/api/health", "/health"]:
            return await call_next(request)

        client_ip = get_client_ip(request)

        # 1. Auth tier (strictest to prevent brute-force attacks)
        if path.startswith("/api/auth/login") or path.startswith("/api/auth/register"):
            tier = "auth"
            max_limit = settings.AUTH_RATE_LIMIT_PER_MINUTE
        # 2. Upload / AI processing tier (expensive compute endpoints)
        elif (
            path.startswith("/api/documents/upload")
            or "/ocr" in path
            or "/extract" in path
            or "/interpret" in path
            or path.startswith("/api/health-summary/generate")
        ):
            tier = "compute"
            max_limit = settings.UPLOAD_RATE_LIMIT_PER_MINUTE
        # 3. General API tier
        else:
            tier = "general"
            max_limit = settings.RATE_LIMIT_PER_MINUTE

        is_allowed, remaining, reset_secs = rate_limiter.check_rate_limit(
            client_ip=client_ip,
            tier=tier,
            max_requests=max_limit,
            window_seconds=60,
        )

        if not is_allowed:
            logger.warning(
                f"Rate limit exceeded for IP {client_ip} on tier '{tier}' (path: {path})"
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded. Too many requests. Please wait before retrying.",
                    "retry_after_seconds": reset_secs,
                },
                headers={
                    "Retry-After": str(reset_secs),
                    "X-RateLimit-Limit": str(max_limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_secs),
                },
            )

        response: Response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_secs)
        return response
