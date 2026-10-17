from fastapi.testclient import TestClient

from app.main import app
from app.models.auth_event import AuthEvent
from tests.conftest import TestSessionLocal

PASSWORD = "testpassword123"


def _register(client, email="test@example.com"):
    return client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": email,
        "password": PASSWORD,
    })


def _login(client, email="test@example.com", password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _events(event_type=None):
    db = TestSessionLocal()
    try:
        query = db.query(AuthEvent)
        if event_type:
            query = query.filter(AuthEvent.event_type == event_type)
        return query.all()
    finally:
        db.close()


# ─── Login ────────────────────────────────────────────────────────────────────

def test_five_wrong_passwords_lock_the_email(client):
    _register(client)

    for _ in range(5):
        assert _login(client, password="wrong-password").status_code == 401

    # Even the CORRECT password is refused while the lock lasts
    response = _login(client)
    assert response.status_code == 429
    assert "Too many failed login attempts" in response.json()["detail"]
    assert "minute" in response.json()["detail"]
    assert int(response.headers["Retry-After"]) > 0


def test_the_lock_message_does_not_reveal_whether_the_email_exists(client):
    _register(client)

    for _ in range(5):
        _login(client, email="nobody@example.com", password="whatever123")
        _login(client, password="wrong-password")

    real = _login(client, password="wrong-password")
    fake = _login(client, email="nobody@example.com", password="whatever123")

    assert real.status_code == fake.status_code == 429
    assert real.json()["detail"] == fake.json()["detail"]


def test_a_good_login_clears_the_failed_attempts(client):
    _register(client)

    for _ in range(4):
        assert _login(client, password="wrong-password").status_code == 401
    assert _login(client).status_code == 200

    # The count started again, so four more mistakes are still allowed
    for _ in range(4):
        assert _login(client, password="wrong-password").status_code == 401
    assert _login(client).status_code == 200


def test_capital_letters_do_not_give_fresh_attempts(client):
    _register(client)

    for _ in range(3):
        _login(client, email="Test@Example.com", password="wrong-password")
    for _ in range(2):
        _login(client, email="test@example.com", password="wrong-password")

    assert _login(client).status_code == 429


def test_too_many_failures_from_one_ip_block_every_email(client):
    for i in range(20):
        assert _login(client, email=f"user{i}@example.com", password="x12345678").status_code == 401

    response = _login(client, email="someone-new@example.com", password="x12345678")
    assert response.status_code == 429


def test_blocked_attempts_are_not_counted_as_new_failures(client):
    _register(client)
    for _ in range(5):
        _login(client, password="wrong-password")
    for _ in range(3):
        assert _login(client).status_code == 429

    assert len(_events("login_failed")) == 5


# ─── The log ──────────────────────────────────────────────────────────────────

def test_events_are_written_to_the_log(client):
    _register(client)
    _login(client, password="wrong-password")
    _login(client)

    types = sorted(event.event_type for event in _events())
    assert types == [
        "login_failed",
        "login_success",
        "register_success",
        "verification_sent",
    ]

    failed = _events("login_failed")[0]
    assert failed.email == "test@example.com"
    assert failed.ip_address                    # the caller's address is kept
    assert failed.user_id                       # it matched a real account


def test_a_failed_login_for_an_unknown_email_has_no_account_link(client):
    _login(client, email="nobody@example.com", password="whatever123")
    failed = _events("login_failed")[0]
    assert failed.user_id is None


# ─── Registration ─────────────────────────────────────────────────────────────

def test_too_many_sign_ups_from_one_ip_are_refused(client):
    for i in range(5):
        assert _register(client, email=f"student{i}@example.com").status_code == 201

    response = _register(client, email="student6@example.com")
    assert response.status_code == 429
    assert "sign-up" in response.json()["detail"]


def test_probing_for_existing_emails_is_limited_too(client):
    assert _register(client).status_code == 201
    for _ in range(4):
        assert _register(client).status_code == 400   # already exists

    assert _register(client).status_code == 429


def test_a_password_over_72_bytes_is_refused(client):
    response = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "long@example.com",
        "password": "a" * 73,
    })
    assert response.status_code == 422


# ─── Changing a password ──────────────────────────────────────────────────────

def test_five_wrong_current_passwords_lock_password_changes(auth_client):
    body = {"current_password": "wrong-password", "new_password": "brandnewpassword1"}
    for _ in range(5):
        assert auth_client.patch("/api/users/me/password", json=body).status_code == 400

    response = auth_client.patch("/api/users/me/password", json={
        "current_password": PASSWORD,
        "new_password": "brandnewpassword1",
    })
    assert response.status_code == 429
    assert "incorrect password attempts" in response.json()["detail"]


def test_changing_the_password_still_works_normally(auth_client):
    response = auth_client.patch("/api/users/me/password", json={
        "current_password": PASSWORD,
        "new_password": "brandnewpassword1",
    })
    assert response.status_code == 200
    assert len(_events("password_change_success")) == 1

    other = TestClient(app)
    assert _login(other, password="brandnewpassword1").status_code == 200