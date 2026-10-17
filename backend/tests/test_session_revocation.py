from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from jose import jwt

from app.config import settings
from app.main import app

PASSWORD = "testpassword123"
NEW_PASSWORD = "brandnewpassword1"


def _register_and_login(client, email="test@example.com"):
    registered = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": email,
        "password": PASSWORD,
    })
    assert registered.status_code == 201
    login = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200
    return registered.json()["id"]


def _login_on_another_device(email="test@example.com"):
    other = TestClient(app)
    response = other.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    return other


def _change_password(client):
    return client.patch("/api/users/me/password", json={
        "current_password": PASSWORD,
        "new_password": NEW_PASSWORD,
    })


def test_changing_the_password_signs_out_the_other_devices(client):
    _register_and_login(client)
    phone = _login_on_another_device()
    assert phone.get("/api/auth/me").status_code == 200

    assert _change_password(client).status_code == 200

    # The phone's login was made before the change, so it no longer works
    stale = phone.get("/api/auth/me")
    assert stale.status_code == 401
    assert "log in again" in stale.json()["detail"]


def test_the_device_that_changed_the_password_stays_signed_in(client):
    _register_and_login(client)

    assert _change_password(client).status_code == 200

    assert client.get("/api/auth/me").status_code == 200


def test_logging_in_again_after_the_change_works(client):
    _register_and_login(client)
    phone = _login_on_another_device()
    _change_password(client)

    fresh = TestClient(app)
    login = fresh.post("/api/auth/login", json={
        "email": "test@example.com", "password": NEW_PASSWORD,
    })
    assert login.status_code == 200
    assert fresh.get("/api/auth/me").status_code == 200
    assert phone.get("/api/auth/me").status_code == 401


def test_logins_made_before_this_feature_still_work(client):
    user_id = _register_and_login(client)

    # A token like the ones issued before the version number existed
    old_style_token = jwt.encode(
        {
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    old_device = TestClient(app)
    old_device.cookies.set("access_token", old_style_token)

    assert old_device.get("/api/auth/me").status_code == 200

    # ...until the password is changed
    _change_password(client)
    assert old_device.get("/api/auth/me").status_code == 401


def test_another_students_login_is_not_affected(client):
    _register_and_login(client, "first@example.com")

    second = TestClient(app)
    _register_and_login(second, "second@example.com")

    _change_password(client)   # the first student changes their password

    assert second.get("/api/auth/me").status_code == 200