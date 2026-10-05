"""Tests that Gemini API keys are encrypted in the database."""
from unittest import mock

from sqlalchemy import text

from app.dependencies import get_db
from app.main import app
from app.models.user import User
from app.utils.encryption import decrypt_secret, encrypt_secret

SECRET_KEY = "AIzaSyD-this-is-a-fake-test-key-123456"


def _db():
    """Opens a session on the same test database the API uses."""
    return next(app.dependency_overrides[get_db]())


def _save_key(client):
    with mock.patch("app.routers.users.validate_gemini_api_key", return_value=True):
        response = client.post("/api/users/me/gemini-key", json={"api_key": SECRET_KEY})
    assert response.status_code == 200


def test_encrypt_then_decrypt_returns_original():
    token = encrypt_secret(SECRET_KEY)
    assert token != SECRET_KEY
    assert SECRET_KEY not in token
    assert decrypt_secret(token) == SECRET_KEY


def test_database_stores_only_ciphertext(auth_client):
    _save_key(auth_client)
    db = _db()
    try:
        stored = db.execute(text("SELECT gemini_api_key FROM users")).scalar()
        assert stored and stored != SECRET_KEY
        assert SECRET_KEY not in stored
        # The app itself still sees the real key through the model.
        assert db.query(User).first().gemini_api_key == SECRET_KEY
    finally:
        db.close()


def test_unreadable_stored_value_does_not_break_the_account(auth_client):
    _save_key(auth_client)
    db = _db()
    try:
        # Simulates an old plain-text value or a changed ENCRYPTION_KEY.
        db.execute(text("UPDATE users SET gemini_api_key = 'old-plain-text-key'"))
        db.commit()
    finally:
        db.close()

    me = auth_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["has_gemini_api_key"] is False