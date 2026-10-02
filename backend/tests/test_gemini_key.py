"""Per-user Gemini key tests. Google is mocked, so no real key or network is needed."""
import json
from unittest import mock

import app.services.gemini as gemini_service

VALID_KEY = "A" * 30
OTHER_KEY = "B" * 30


class _FakeResponse:
    def __init__(self, text):
        self.text = text


class _FakeModels:
    def __init__(self, key, log):
        self.key, self.log = key, log

    def generate_content(self, *, model, contents, config=None):
        self.log.append(self.key)
        return _FakeResponse(json.dumps({
            "message": "ok", "recommendations": [], "insights": [],
            "entries": [{"course_name": "Maths", "day_of_week": 0,
                         "start_time": "08:00", "end_time": "10:00"}],
            "extraction_notes": None,
        }))

    def list(self):
        return iter([object()])


def _fake_client_factory(log):
    class _FakeClient:
        def __init__(self, api_key):
            self.models = _FakeModels(api_key, log)
    return _FakeClient


def test_new_user_has_no_key(auth_client):
    assert auth_client.get("/api/auth/me").json()["has_gemini_api_key"] is False


def test_chat_and_upload_require_a_key(auth_client):
    r = auth_client.post("/api/ai/chat", json={"message": "hi"})
    assert r.status_code == 400 and "Gemini API key" in r.json()["detail"]
    r = auth_client.post("/api/timetable-import/upload",
                         files={"file": ("t.png", b"fakebytes", "image/png")})
    assert r.status_code == 400 and "Gemini API key" in r.json()["detail"]


def test_invalid_key_rejected_and_not_saved(auth_client):
    with mock.patch("app.routers.users.validate_gemini_api_key", return_value=False):
        r = auth_client.post("/api/users/me/gemini-key", json={"api_key": VALID_KEY})
    assert r.status_code == 400
    assert auth_client.get("/api/auth/me").json()["has_gemini_api_key"] is False


def test_key_saved_never_returned_and_used_by_chat_and_upload(auth_client):
    log = []
    with mock.patch.object(gemini_service.genai, "Client", _fake_client_factory(log)):
        r = auth_client.post("/api/users/me/gemini-key", json={"api_key": VALID_KEY})
        assert r.status_code == 200 and r.json()["has_gemini_api_key"] is True

        me = auth_client.get("/api/auth/me")
        assert me.json()["has_gemini_api_key"] is True
        assert VALID_KEY not in me.text and "gemini_api_key\":" not in me.text.replace("has_gemini_api_key", "")

        assert auth_client.post("/api/ai/chat", json={"message": "hi"}).status_code == 200
        up = auth_client.post("/api/timetable-import/upload",
                              files={"file": ("t.png", b"fakebytes", "image/png")})
        assert up.status_code == 200, up.text
        assert up.json()["extracted_entries"][0]["course_name"] == "Maths"
    assert set(log) == {VALID_KEY}


def test_two_users_never_share_a_key(auth_client, auth_client_b):
    log = []
    with mock.patch.object(gemini_service.genai, "Client", _fake_client_factory(log)):
        auth_client.post("/api/users/me/gemini-key", json={"api_key": VALID_KEY})
        auth_client_b.post("/api/users/me/gemini-key", json={"api_key": OTHER_KEY})
        auth_client.post("/api/ai/chat", json={"message": "a"})
        auth_client_b.post("/api/ai/chat", json={"message": "b"})
        auth_client.post("/api/ai/chat", json={"message": "a2"})
    assert [k for k in log if k not in (VALID_KEY, OTHER_KEY)] == []
    assert log[-3:] == [VALID_KEY, OTHER_KEY, VALID_KEY]