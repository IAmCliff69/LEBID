import logging
import time
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.logging_config import request_id_var
from app.monitoring import report_exception

logger = logging.getLogger("lebid.request")

# A request slower than this (in milliseconds) is logged as a warning
SLOW_REQUEST_MS = 2000


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    For every request:
    - gives it a short id (sent back in the X-Request-ID header),
    - times it,
    - logs the ones worth looking at: server errors, "too many requests"
      answers and slow requests,
    - turns a crash into a clean error answer that does not leak details.

    It never logs what a student typed, and never logs the query string.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = uuid.uuid4().hex[:12]
        token = request_id_var.set(request_id)
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception as error:
            duration_ms = round((time.perf_counter() - started) * 1000)
            logger.exception(
                "unhandled error",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                },
            )
            report_exception(error)
            response = JSONResponse(
                status_code=500,
                content={
                    "detail": (
                        "Something went wrong on our side. Please try again. "
                        f"If it keeps happening, mention this code: {request_id}"
                    ),
                    "request_id": request_id,
                },
            )
        else:
            duration_ms = round((time.perf_counter() - started) * 1000)
            details = {
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            }
            if response.status_code >= 500:
                logger.error("server error", extra=details)
            elif response.status_code == 429:
                logger.warning("too many requests", extra=details)
            elif duration_ms > SLOW_REQUEST_MS:
                logger.warning("slow request", extra=details)

        response.headers["X-Request-ID"] = request_id
        request_id_var.reset(token)
        return response