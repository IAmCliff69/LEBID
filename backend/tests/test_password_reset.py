import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.auth_token import AuthToken
from app.models.user import User
from app.services.email_sender import sent_emails
from tests.conftest import TestSessionLocal

PASSWORD = "testpassword123"
NEW_PASSWORD = "brandnewpassword1"
GENERIC_ANSWER = "If an account exists for that email"


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
    sent_emails.clear()          # forget the welcome/verification email


def _login(client, email="test@example.com", password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _forgot(client, email="test@example.com"):
    return client.post("/api/auth/forgot-password", json={"email": email})


def _reset(client, token, password=NEW_PASSWORD):
    return client.post("/api/auth/reset-password", json={
        "token": token, "new_password": password,
    })


def _reset_token_from_email():
    message = next(m for m in sent_emails if "Reset" in m["subject"])
    match = re.search(r"/reset-password\?token=([A-Za-z0-9_\-]+)", message["text"])
    assert match, "no reset link in the email"
    return match.group(1)


def _request_reset_link(client, email="test@example.com"):
    sent_emails.clear()
    assert _forgot(client, email).status_code == 200
    return _reset_token_from_email()


# ─── Asking for a link ────────────────────────────────────────────────────────

def test_an_existing_account_gets_a_reset_email(client):
    _register(client)

    response = _forgot(client)

    assert response.status_code == 200
    assert GENERIC_ANSWER in response.json()["message"]
    assert len(sent_emails) == 1
    assert sent_emails[0]["to"] == "test@example.com"
    assert sent_emails[0]["subject"] == "Reset your Lebid password"
    assert f"{settings.frontend_url.rstrip('/')}/reset-password?token=" in sent_emails[0]["text"]


def test_an_unknown_email_gets_the_same_answer_and_no_email(client):
    _register(client)
    known = _forgot(client)
    sent_emails.clear()

    unknown = _forgot(client, "nobody@example.com")

    assert unknown.status_code == known.status_code == 200
    assert unknown.json() == known.json()
    assert sent_emails == []


def test_capital_letters_in_the_email_still_find_the_account(client):
    _register(client, "mixed@example.com")

    response = _forgot(client, "MIXED@example.com")

    assert response.status_code == 200
    assert len(sent_emails) == 1


def test_a_deactivated_account_gets_no_email(client):
    _register(client)
    db = TestSessionLocal()
    try:
        db.query(User).update({"is_active": False})
        db.commit()
    finally:
        db.close()

    response = _forgot(client)

    assert response.status_code == 200
    assert GENERIC_ANSWER in response.json()["message"]
    assert sent_emails == []


def test_a_newer_link_cancels_the_older_one(client):
    _register(client)
    old_token = _request_reset_link(client)
    new_token = _request_reset_link(client)

    assert _reset(client, old_token).status_code == 400
    assert _reset(client, new_token).status_code == 200


# ─── Using a link ─────────────────────────────────────────────────────────────

def test_the_link_sets_a_new_password(client):
    _register(client)
    token = _request_reset_link(client)

    response = _reset(client, token)

    assert response.status_code == 200
    assert _login(client, password=NEW_PASSWORD).status_code == 200
    assert _login(TestClient(app), password=PASSWORD).status_code == 401


def test_a_link_works_only_once(client):
    _register(client)
    token = _request_reset_link(client)

    assert _reset(client, token).status_code == 200
    second = _reset(client, token)
    assert second.status_code == 400
    assert "invalid or has expired" in second.json()["detail"]


def test_an_expired_link_is_refused(client):
    _register(client)
    token = _request_reset_link(client)

    db = TestSessionLocal()
    try:
        db.query(AuthToken).update(
            {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}
        )
        db.commit()
    finally:
        db.close()

    assert _reset(client, token).status_code == 400
    assert _login(client).status_code == 200      # the old password still works


def test_an_email_verification_link_cannot_reset_a_password(client):
    registered = client.post("/api/auth/register", json={
        "full_name": "Test User", "email": "test@example.com", "password": PASSWORD,
    })
    assert registered.status_code == 201
    message = sent_emails[0]
    verification_token = re.search(r"token=([A-Za-z0-9_\-]+)", message["text"]).group(1)

    assert _reset(client, verification_token).status_code == 400


def test_a_made_up_link_is_refused(client):
    assert _reset(client, "this-token-was-never-issued-by-lebid").status_code == 400


def test_the_new_password_must_follow_the_signup_rules(client):
    _register(client)
    token = _request_reset_link(client)

    assert _reset(client, token, password="short").status_code == 422
    assert _reset(client, token, password="a" * 73).status_code == 422

    # Refused passwords do not use up the link
    assert _reset(client, token).status_code == 200


def test_resetting_signs_out_every_other_device(client):
    _register(client)
    assert _login(client).status_code == 200
    phone = TestClient(app)
    assert _login(phone).status_code == 200
    assert phone.get("/api/auth/me").status_code == 200

    token = _request_reset_link(TestClient(app))
    assert _reset(TestClient(app), token).status_code == 200

    assert phone.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_resetting_does_not_log_anyone_in(client):
    _register(client)
    token = _request_reset_link(client)

    _reset(client, token)

    assert client.get("/api/auth/me").status_code == 401


def test_resetting_proves_the_email_and_marks_it_verified(client):
    _register(client)
    token = _request_reset_link(client)
    _reset(client, token)

    assert _login(client, password=NEW_PASSWORD).status_code == 200
    assert client.get("/api/auth/me").json()["email_verified"] is True


def test_resetting_unlocks_an_account_locked_by_wrong_passwords(client):
    _register(client)
    for _ in range(5):
        assert _login(client, password="wrong-password").status_code == 401
    assert _login(client, password=PASSWORD).status_code == 429   # locked

    token = _request_reset_link(client)
    assert _reset(client, token).status_code == 200

    assert _login(client, password=NEW_PASSWORD).status_code == 200


# ─── The "your password was changed" notice ───────────────────────────────────

def test_a_reset_sends_a_security_notice(client):
    _register(client)
    token = _request_reset_link(client)
    sent_emails.clear()

    _reset(client, token)

    assert len(sent_emails) == 1
    assert sent_emails[0]["subject"] == "Your Lebid password was changed"
    assert sent_emails[0]["to"] == "test@example.com"
    assert "/forgot-password" in sent_emails[0]["text"]


def test_changing_the_password_in_settings_sends_a_security_notice(client):
    _register(client)
    assert _login(client).status_code == 200
    sent_emails.clear()

    response = client.patch("/api/users/me/password", json={
        "current_password": PASSWORD, "new_password": NEW_PASSWORD,
    })

    assert response.status_code == 200
    assert len(sent_emails) == 1
    assert sent_emails[0]["subject"] == "Your Lebid password was changed"


# ─── Limits ───────────────────────────────────────────────────────────────────

def test_only_three_reset_emails_per_hour_per_address(client):
    _register(client)
    for _ in range(3):
        assert _forgot(client).status_code == 200

    response = _forgot(client)
    assert response.status_code == 429
    assert "password reset requests" in response.json()["detail"]


def test_the_limit_applies_to_unknown_emails_too(client):
    for _ in range(3):
        assert _forgot(client, "nobody@example.com").status_code == 200

    assert _forgot(client, "nobody@example.com").status_code == 429


def test_only_ten_reset_requests_per_hour_per_ip(client):
    for i in range(10):
        assert _forgot(client, f"person{i}@example.com").status_code == 200

    assert _forgot(client, "person-new@example.com").status_code == 429


def test_too_many_bad_reset_links_from_one_ip_are_blocked(client):
    for i in range(10):
        assert _reset(client, f"made-up-token-number-{i:04d}").status_code == 400

    assert _reset(client, "made-up-token-number-9999").status_code == 429