import json
from types import SimpleNamespace
from unittest import mock

from app.dependencies import get_db
from app.main import app
from app.models.timetable_import import TimetableImport
from app.services.study_planner import ClassBlock, find_free_windows

PREFS = {
    "study_times": ["afternoon"],
    "study_days": [0, 1],
    "session_length_minutes": 60,
    "break_preference": "short",
}

MONDAY_MORNING_CLASS = {
    "course_name": "Data Structures",
    "course_code": "COE 353",
    "day_of_week": 0,
    "start_time": "08:00",
    "end_time": "10:00",
    "venue": "LT1",
    "class_type": "lecture",
}


def _db():
    """Opens a session on the same test database the API uses."""
    return next(app.dependency_overrides[get_db]())


def _add_key(client):
    with mock.patch("app.routers.users.validate_gemini_api_key", return_value=True):
        response = client.post("/api/users/me/gemini-key", json={"api_key": "A" * 30})
    assert response.status_code == 200


def _save_prefs(client, **changes):
    response = client.put("/api/users/me/study-preferences", json={**PREFS, **changes})
    assert response.status_code == 200


def _make_import(client, entries):
    user_id = client.get("/api/auth/me").json()["id"]
    db = _db()
    try:
        item = TimetableImport(
            user_id=user_id,
            original_filename="timetable.png",
            status="extracted",
            extracted_data=json.dumps({"entries": entries}),
        )
        db.add(item)
        db.commit()
        return item.id
    finally:
        db.close()


def _ai_reply(sessions):
    return json.dumps({"summary": "A light plan.", "sessions": sessions})


# --- free window calculation (no AI involved) --------------------------------

def _prefs(**changes):
    values = {
        "study_times": ["afternoon"],
        "study_days": [0],
        "session_length_minutes": 60,
        "break_preference": "short",
        **changes,
    }
    return SimpleNamespace(**values)


def _class_block(start_min, end_min, day=0):
    return ClassBlock(
        day_of_week=day, start_min=start_min, end_min=end_min,
        course_name="X", course_code=None, class_type="lecture", venue=None,
    )


def _spans(windows):
    return [(w.start_min, w.end_min) for w in windows]


def test_free_window_without_classes():
    # afternoon = 12:00 - 17:00
    assert _spans(find_free_windows([], _prefs())) == [(720, 1020)]


def test_windows_keep_a_gap_around_classes():
    # class 13:00-14:00 with a 10 minute gap -> 12:00-12:45 and 14:15-17:00
    windows = find_free_windows([_class_block(13 * 60, 14 * 60)], _prefs())
    assert _spans(windows) == [(720, 765), (855, 1020)]


def test_morning_and_afternoon_join_into_one_window():
    windows = find_free_windows([], _prefs(study_times=["morning", "afternoon"]))
    assert _spans(windows) == [(420, 1020)]


def test_morning_and_evening_stay_separate():
    windows = find_free_windows([], _prefs(study_times=["morning", "evening"]))
    assert _spans(windows) == [(420, 720), (1020, 1320)]


def test_windows_only_on_preferred_days():
    windows = find_free_windows([], _prefs(study_days=[2]))
    assert windows and all(w.window_id.startswith("2-") for w in windows)


def test_too_short_gaps_are_ignored():
    # class 12:30-16:45 leaves only tiny gaps, so no window at all
    windows = find_free_windows([_class_block(12 * 60 + 30, 16 * 60 + 45)], _prefs())
    assert windows == []


# --- the endpoint ------------------------------------------------------------

def test_generate_requires_a_gemini_key(auth_client):
    _save_prefs(auth_client)
    response = auth_client.post("/api/study-plan/generate", json={})
    assert response.status_code == 400
    assert "Gemini" in response.json()["detail"]


def test_generate_requires_study_preferences(auth_client):
    _add_key(auth_client)
    response = auth_client.post("/api/study-plan/generate", json={})
    assert response.status_code == 400
    assert "preferences" in response.json()["detail"].lower()


def test_generate_keeps_only_valid_choices(auth_client):
    _add_key(auth_client)
    _save_prefs(auth_client)
    import_id = _make_import(auth_client, [MONDAY_MORNING_CLASS])

    reply = _ai_reply([
        # valid
        {"window_id": "0-12:00", "start": "12:00", "duration_minutes": 60,
         "course_key": "c1", "topic": "Revise linked lists"},
        # too long: shortened to the student's 60 minute maximum
        {"window_id": "1-12:00", "start": "13:00", "duration_minutes": 180,
         "course_key": "c1", "topic": "Practise stacks"},
        # overlaps the first session in the same window: dropped
        {"window_id": "0-12:00", "start": "12:30", "duration_minutes": 60,
         "course_key": "c1", "topic": "Overlap"},
        # window that does not exist: dropped
        {"window_id": "0-03:00", "start": "03:00", "duration_minutes": 60,
         "course_key": "c1", "topic": "Not a real window"},
        # course that does not exist: dropped
        {"window_id": "0-12:00", "start": "14:00", "duration_minutes": 60,
         "course_key": "c9", "topic": "Not a real course"},
    ])
    with mock.patch("app.services.study_planner.generate_text", return_value=reply):
        response = auth_client.post(
            "/api/study-plan/generate", json={"import_id": import_id}
        )

    assert response.status_code == 200, response.text
    plan = response.json()
    assert [(s["day_of_week"], s["start_time"], s["duration_minutes"]) for s in plan["sessions"]] == [
        (0, "12:00", 60),
        (1, "13:00", 60),
    ]
    assert len(plan["classes"]) == 1
    assert plan["warnings"] == []


def test_generate_fails_clearly_when_the_ai_plan_is_unusable(auth_client):
    _add_key(auth_client)
    _save_prefs(auth_client)
    import_id = _make_import(auth_client, [MONDAY_MORNING_CLASS])

    reply = _ai_reply([
        {"window_id": "0-03:00", "start": "03:00", "duration_minutes": 60,
         "course_key": "c1", "topic": "Nope"}
    ])
    with mock.patch("app.services.study_planner.generate_text", return_value=reply):
        response = auth_client.post(
            "/api/study-plan/generate", json={"import_id": import_id}
        )

    assert response.status_code == 502


def test_generate_reports_when_there_is_no_free_time(auth_client):
    _add_key(auth_client)
    _save_prefs(auth_client, study_times=["evening"], study_days=[0])
    busy_evening = {**MONDAY_MORNING_CLASS, "start_time": "17:00", "end_time": "22:00"}
    import_id = _make_import(auth_client, [busy_evening])

    response = auth_client.post("/api/study-plan/generate", json={"import_id": import_id})
    assert response.status_code == 400
    assert "free time" in response.json()["detail"]


def test_generate_rejects_another_students_import(auth_client, auth_client_b):
    import_id = _make_import(auth_client, [MONDAY_MORNING_CLASS])
    _add_key(auth_client_b)
    _save_prefs(auth_client_b)

    response = auth_client_b.post(
        "/api/study-plan/generate", json={"import_id": import_id}
    )
    assert response.status_code == 404