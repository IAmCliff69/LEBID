import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.auth_token import AuthToken
from app.services.email_sender import sent_emails
from tests.conftest import TestSessionLocal

PASSWORD = "testpassword123"


@pytest.fixture(autouse=True)
def memory_email(monkeypatch):
    """Emails are kept in a list instead of being printed."""
    monkeypatch.setattr(settings, "email_backend", "memory")
    sent_emails.clear()
    yield sent_emails
    sent_emails.clear()


def _register(client, email="test@example.com"):
    response = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": email,
        "password": PASSWORD,
    })
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email="test@example.com"):
    response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text


def _token_in(message):
    match = re.search(r"token=([A-Za-z0-9_\-]+)", message["text"])
    assert match, "no verification link in the email"
    return match.group(1)


def _verify(client, token):
    return client.post("/api/auth/verify-email", json={"token": token})


def test_registering_sends_a_verification_email(client):
    _register(client)

    assert len(sent_emails) == 1
    message = sent_emails[0]
    assert message["to"] == "test@example.com"
    assert "Verify" in message["subject"]
    assert f"{settings.frontend_url.rstrip('/')}/verify-email?token=" in message["text"]


def test_new_accounts_start_unverified(client):
    registered = _register(client)
    assert registered["email_verified"] is False

    _login(client)
    assert client.get("/api/auth/me").json()["email_verified"] is False


def test_the_link_verifies_the_email(client):
    _register(client)
    _login(client)

    response = _verify(client, _token_in(sent_emails[0]))

    assert response.status_code == 200
    assert client.get("/api/auth/me").json()["email_verified"] is True


def test_the_link_works_without_being_logged_in(client):
    _register(client)
    token = _token_in(sent_emails[0])

    other_device = TestClient(app)
    assert _verify(other_device, token).status_code == 200


def test_a_link_works_only_once(client):
    _register(client)
    token = _token_in(sent_emails[0])

    assert _verify(client, token).status_code == 200
    second = _verify(client, token)
    assert second.status_code == 400
    assert "invalid or has expired" in second.json()["detail"]


def test_an_expired_link_is_refused(client):
    _register(client)
    token = _token_in(sent_emails[0])

    db = TestSessionLocal()
    try:
        db.query(AuthToken).update(
            {"expires_at": datetime.now(timezone.utc) - timedelta(hours=1)}
        )
        db.commit()
    finally:
        db.close()

    assert _verify(client, token).status_code == 400


def test_a_made_up_link_is_refused(client):
    assert _verify(client, "this-token-was-never-issued-by-lebid").status_code == 400


def test_the_secret_is_never_stored(client):
    _register(client)
    token = _token_in(sent_emails[0])

    db = TestSessionLocal()
    try:
        rows = db.query(AuthToken).all()
    finally:
        db.close()

    assert len(rows) == 1
    assert rows[0].token_hash != token
    assert token not in rows[0].token_hash
    assert len(rows[0].token_hash) == 64


def test_resending_makes_the_old_link_stop_working(client):
    _register(client)
    _login(client)
    old_token = _token_in(sent_emails[0])

    assert client.post("/api/auth/resend-verification").status_code == 200
    assert len(sent_emails) == 2
    new_token = _token_in(sent_emails[1])

    assert _verify(client, old_token).status_code == 400
    assert _verify(client, new_token).status_code == 200


def test_resending_needs_a_login(client):
    assert client.post("/api/auth/resend-verification").status_code == 401


def test_resending_to_a_verified_account_sends_nothing(client):
    _register(client)
    _login(client)
    _verify(client, _token_in(sent_emails[0]))
    before = len(sent_emails)

    response = client.post("/api/auth/resend-verification")

    assert response.status_code == 200
    assert "already verified" in response.json()["message"]
    assert len(sent_emails) == before


def test_too_many_verification_emails_are_refused(client):
    _register(client)          # email number 1
    _login(client)

    for _ in range(3):         # emails 2, 3 and 4
        assert client.post("/api/auth/resend-verification").status_code == 200

    response = client.post("/api/auth/resend-verification")
    assert response.status_code == 429
    assert "verification email requests" in response.json()["detail"]


def test_too_many_bad_links_from_one_ip_are_blocked(client):
    for i in range(10):
        assert _verify(client, f"made-up-token-number-{i:04d}").status_code == 400

    assert _verify(client, "made-up-token-number-9999").status_code == 429


def test_a_problem_sending_the_email_does_not_stop_registration(client, monkeypatch):
    monkeypatch.setattr(settings, "email_backend", "no-such-backend")

    _register(client)    # still 201, the error is only logged

    assert sent_emails == []