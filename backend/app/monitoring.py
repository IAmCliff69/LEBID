import logging
from typing import Any

from app.config import settings

logger = logging.getLogger("lebid.monitoring")

_sentry_enabled = False

# Request details that must never leave our server
_PRIVATE_HEADERS = {"cookie", "authorization", "x-api-key"}


def scrub_event(event: dict[str, Any], hint: Any = None) -> dict[str, Any]:
    """
    Removes private details from an error report before it is sent anywhere:
    request bodies (passwords, API keys), cookies and login headers.
    """
    request = event.get("request")
    if isinstance(request, dict):
        request.pop("data", None)
        request.pop("cookies", None)
        request.pop("query_string", None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            for name in list(headers):
                if name.lower() in _PRIVATE_HEADERS:
                    headers[name] = "[removed]"
    return event


def init_monitoring() -> None:
    """
    Turns on Sentry error reporting, but ONLY if SENTRY_DSN is set.
    Without it nothing is sent anywhere.
    """
    global _sentry_enabled
    _sentry_enabled = False

    if not settings.sentry_dsn:
        logger.info("Error reporting is off (SENTRY_DSN is empty).")
        return

    try:
        import sentry_sdk
    except ImportError:
        logger.warning(
            "SENTRY_DSN is set but sentry-sdk is not installed. "
            'Run: pip install "sentry-sdk[fastapi]"'
        )
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        send_default_pii=False,          # no emails, IPs or cookies
        max_request_body_size="never",   # never send what a student typed
        include_local_variables=False,   # variables can hold passwords or keys
        traces_sample_rate=0.0,          # errors only (keeps the free tier enough)
        before_send=scrub_event,
    )
    _sentry_enabled = True
    logger.info("Error reporting is on.")


def is_sentry_enabled() -> bool:
    return _sentry_enabled


def report_exception(error: BaseException) -> None:
    """Sends an unexpected error to Sentry (does nothing when it is off)."""
    if not _sentry_enabled:
        return
    import sentry_sdk

    sentry_sdk.capture_exception(error)