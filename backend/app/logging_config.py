import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone

from app.config import settings

# The id of the request being handled. Every log line written while a
# request runs carries it, so one request's lines can be found together.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

# The normal fields every log record has. Anything else was added with
# `extra={...}` and is written out as its own field in JSON logs.
_STANDARD_FIELDS = set(
    logging.LogRecord("", 0, "", 0, "", (), None).__dict__
) | {"message", "asctime", "request_id"}


class RequestIdFilter(logging.Filter):
    """Adds the current request id to every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line. Easy for hosting dashboards to search."""

    def format(self, record: logging.LogRecord) -> str:
        data = {
            "time": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        for key, value in record.__dict__.items():
            if key not in _STANDARD_FIELDS and not key.startswith("_"):
                data[key] = value
        if record.exc_info:
            data["exception"] = self.formatException(record.exc_info)
        return json.dumps(data, default=str)


def setup_logging() -> None:
    """
    Sets up logging for the whole app. Called once when the app starts.

    LOG_LEVEL  = DEBUG, INFO, WARNING... (default INFO)
    LOG_FORMAT = "text" (easy to read, for development) or "json" (production)
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())

    if settings.log_format.lower() == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"
            )
        )

    root = logging.getLogger()
    root.handlers = [handler]   # replace, so a reload never doubles the lines
    root.setLevel(settings.log_level.upper())