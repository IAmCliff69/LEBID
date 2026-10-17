import json
import logging

from app.config import settings
from app.logging_config import JsonFormatter
from app.main import app
from app import monitoring


def test_every_response_has_a_request_id(client):
    first = client.get("/health")
    second = client.get("/health")

    assert first.headers["X-Request-ID"]
    assert second.headers["X-Request-ID"]
    assert first.headers["X-Request-ID"] != second.headers["X-Request-ID"]


def test_an_unexpected_error_becomes_a_clear_500(client, caplog):
    def boom():
        raise RuntimeError("secret internal detail")

    app.add_api_route("/api/_boom", boom, methods=["GET"])
    try:
        with caplog.at_level(logging.ERROR):
            response = client.get("/api/_boom")
    finally:
        app.router.routes.pop()

    assert response.status_code == 500
    # The student sees a helpful message and a code, never the real error
    assert "secret internal detail" not in response.text
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    # But the error itself is in the server log
    assert any("unhandled error" in record.getMessage() for record in caplog.records)


def test_json_log_lines_include_extra_fields_and_the_request_id():
    record = logging.LogRecord(
        "lebid.test", logging.WARNING, __file__, 1, "hello %s", ("world",), None
    )
    record.request_id = "abc123"
    record.status = 429

    line = json.loads(JsonFormatter().format(record))

    assert line["message"] == "hello world"
    assert line["level"] == "WARNING"
    assert line["request_id"] == "abc123"
    assert line["status"] == 429


def test_error_reports_never_contain_private_request_data():
    event = {
        "request": {
            "data": {"password": "hunter2"},
            "cookies": {"access_token": "abc"},
            "query_string": "token=xyz",
            "headers": {"Cookie": "access_token=abc", "Accept": "*/*"},
        }
    }

    cleaned = monitoring.scrub_event(event)

    assert "data" not in cleaned["request"]
    assert "cookies" not in cleaned["request"]
    assert "query_string" not in cleaned["request"]
    assert cleaned["request"]["headers"]["Cookie"] == "[removed]"
    assert cleaned["request"]["headers"]["Accept"] == "*/*"


def test_error_reporting_stays_off_without_a_dsn(monkeypatch):
    monkeypatch.setattr(settings, "sentry_dsn", "")
    monitoring.init_monitoring()
    assert monitoring.is_sentry_enabled() is False