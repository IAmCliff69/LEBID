from types import SimpleNamespace
from unittest import mock

import pytest
from google.genai import errors

import app.services.gemini as gemini_service
from app.services.gemini import GeminiUnreachableError, validate_gemini_api_key


class _Models:
    def __init__(self, error=None):
        self.error = error

    def list(self):
        if self.error:
            raise self.error
        return iter([object()])


def _fake_google(error=None):
    """Replaces Google's client so no real request is made."""
    return mock.patch.object(
        gemini_service.genai,
        "Client",
        lambda api_key: SimpleNamespace(models=_Models(error)),
    )


def _client_error(code, message):
    return errors.ClientError(code, {"error": {"message": message, "status": "X"}})


# --- the check itself ----------------------------------------------------------

def test_a_working_key_is_valid():
    with _fake_google():
        assert validate_gemini_api_key("A" * 30) is True


def test_a_key_google_rejects_is_not_valid():
    with _fake_google(_client_error(400, "API key not valid")):
        assert validate_gemini_api_key("A" * 30) is False


def test_a_key_that_hit_its_quota_is_still_a_valid_key():
    with _fake_google(_client_error(429, "Quota exceeded")):
        assert validate_gemini_api_key("A" * 30) is True


def test_a_network_problem_is_not_called_a_wrong_key():
    with _fake_google(ConnectionError("no route to host")):
        with pytest.raises(GeminiUnreachableError):
            validate_gemini_api_key("A" * 30)


# --- what the student sees -------------------------------------------------------

def test_rejected_key_gives_a_clear_400_and_is_not_saved(auth_client):
    with mock.patch("app.routers.users.validate_gemini_api_key", return_value=False):
        response = auth_client.post("/api/users/me/gemini-key", json={"api_key": "A" * 30})

    assert response.status_code == 400
    assert "did not accept" in response.json()["detail"]
    assert auth_client.get("/api/auth/me").json()["has_gemini_api_key"] is False


def test_unreachable_google_gives_a_503_not_a_wrong_key_message(auth_client):
    with mock.patch(
        "app.routers.users.validate_gemini_api_key",
        side_effect=GeminiUnreachableError(),
    ):
        response = auth_client.post("/api/users/me/gemini-key", json={"api_key": "A" * 30})

    assert response.status_code == 503
    assert "couldn't reach Google" in response.json()["detail"]
    assert auth_client.get("/api/auth/me").json()["has_gemini_api_key"] is False