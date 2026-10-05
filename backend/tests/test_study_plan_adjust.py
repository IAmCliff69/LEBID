import json
from unittest import mock

from app.dependencies import get_db
from app.main import app
from app.models.timetable_import import TimetableImport

PREFS = {
    "study_times": ["afternoon"],
    "study_days": [0, 1],
    "session_length_minutes": 120,
    "break_preference": "short",
}

# A class on Monday 08:00-10:00
CLASS = {
    "course_name": "Data Structures",
    "course_code": "COE 353",
    "day_of_week": 0,
    "start_time": "08:00",
    "end_time": "10:00",
    "venue": "LT1",
    "class_type": "lecture",
}

SESSION = {
    "day_of_week": 0,
    "start_time": "12:00",
    "end_time": "13:00",
    "duration_minutes": 60,
    "course_name": "Data Structures",
    "course_code": "COE 353",
    "topic": "Revise linked lists",
}
SESSION_2 = {**SESSION, "day_of_week": 2, "topic": "Practise stacks"}


def _db():
    return next(app.dependency_overrides[get_db]())


def _add_key(client):
    with mock.patch("app.routers.users.validate_gemini_api_key", return_value=True):
        response = client.post("/api/users/me/gemini-key", json={"api_key": "A" * 30})
    assert response.status_code == 200


def _save_prefs(client):
    response = client.put("/api/users/me/study-preferences", json=PREFS)
    assert response.status_code == 200


def _make_import(client):
    user_id = client.get("/api/auth/me").json()["id"]
    db = _db()
    try:
        item = TimetableImport(
            user_id=user_id,
            original_filename="timetable.png",
            status="extracted",
            extracted_data=json.dumps({"entries": [CLASS]}),
        )
        db.add(item)
        db.commit()
        return item.id
    finally:
        db.close()


def _ready(client):
    _add_key(client)
    _save_prefs(client)
    return _make_import(client)


def _reply(message, operations):
    return json.dumps({"message": message, "operations": operations})


def _adjust(client, import_id, sessions, reply, instruction="please change it"):
    with mock.patch(
        "app.services.study_plan_adjuster.generate_text", return_value=reply
    ):
        return client.post(
            "/api/study-plan/adjust",
            json={
                "import_id": import_id,
                "instruction": instruction,
                "sessions": sessions,
            },
        )


def _times(response):
    return [
        (s["day_of_week"], s["start_time"], s["end_time"], s["duration_minutes"])
        for s in response.json()["sessions"]
    ]


def test_update_moves_a_session(auth_client):
    import_id = _ready(auth_client)
    reply = _reply("Moved it.", [
        {"op": "update", "id": "s1", "day_of_week": 1,
         "start_time": "14:00", "end_time": "15:30"},
    ])
    response = _adjust(auth_client, import_id, [SESSION], reply)

    assert response.status_code == 200, response.text
    assert _times(response) == [(1, "14:00", "15:30", 90)]
    assert len(response.json()["changes"]) == 1
    assert response.json()["warnings"] == []


def test_a_change_that_hits_a_class_is_refused(auth_client):
    import_id = _ready(auth_client)
    reply = _reply("Moved it.", [
        {"op": "update", "id": "s1", "start_time": "09:00", "end_time": "10:00"},
    ])
    response = _adjust(auth_client, import_id, [SESSION], reply)

    assert response.status_code == 200
    # the session stays exactly where it was
    assert _times(response) == [(0, "12:00", "13:00", 60)]
    assert response.json()["changes"] == []
    assert len(response.json()["warnings"]) == 1
    assert "class" in response.json()["warnings"][0]
    assert response.json()["message"].startswith("I wasn't able")


def test_remove_a_session(auth_client):
    import_id = _ready(auth_client)
    reply = _reply("Removed it.", [{"op": "remove", "id": "s2"}])
    response = _adjust(auth_client, import_id, [SESSION, SESSION_2], reply)

    assert response.status_code == 200
    assert _times(response) == [(0, "12:00", "13:00", 60)]
    assert len(response.json()["changes"]) == 1


def test_add_a_session(auth_client):
    import_id = _ready(auth_client)
    reply = _reply("Added one.", [
        {"op": "add", "day_of_week": 1, "start_time": "10:00",
         "end_time": "11:00", "course_key": "c1", "topic": "Past questions"},
    ])
    response = _adjust(auth_client, import_id, [SESSION], reply)

    assert response.status_code == 200
    assert _times(response) == [(0, "12:00", "13:00", 60), (1, "10:00", "11:00", 60)]
    assert response.json()["sessions"][1]["topic"] == "Past questions"


def test_unknown_ids_and_courses_are_ignored(auth_client):
    import_id = _ready(auth_client)
    reply = _reply("Done.", [
        {"op": "update", "id": "s9", "day_of_week": 1},
        {"op": "add", "day_of_week": 1, "start_time": "10:00",
         "end_time": "11:00", "course_key": "c9", "topic": "x"},
    ])
    response = _adjust(auth_client, import_id, [SESSION], reply)

    assert response.status_code == 200
    assert _times(response) == [(0, "12:00", "13:00", 60)]
    assert len(response.json()["warnings"]) == 2


def test_no_operations_returns_the_ai_question(auth_client):
    import_id = _ready(auth_client)
    reply = _reply("Which day do you mean?", [])
    response = _adjust(auth_client, import_id, [SESSION], reply)

    assert response.status_code == 200
    assert response.json()["message"] == "Which day do you mean?"
    assert response.json()["changes"] == []
    assert response.json()["warnings"] == []
    assert _times(response) == [(0, "12:00", "13:00", 60)]


def test_unreadable_ai_reply_gives_a_clear_error(auth_client):
    import_id = _ready(auth_client)
    response = _adjust(auth_client, import_id, [SESSION], "this is not json")
    assert response.status_code == 502


def test_requires_a_gemini_key(auth_client):
    _save_prefs(auth_client)
    response = auth_client.post(
        "/api/study-plan/adjust",
        json={"instruction": "hi", "sessions": [SESSION]},
    )
    assert response.status_code == 400
    assert "Gemini" in response.json()["detail"]


def test_empty_instruction_is_rejected(auth_client):
    import_id = _ready(auth_client)
    response = _adjust(auth_client, import_id, [SESSION], _reply("x", []), instruction="")
    assert response.status_code == 422


def test_cannot_use_another_students_import(auth_client, auth_client_b):
    import_id = _make_import(auth_client)
    _add_key(auth_client_b)
    _save_prefs(auth_client_b)

    response = _adjust(auth_client_b, import_id, [SESSION], _reply("x", []))
    assert response.status_code == 404