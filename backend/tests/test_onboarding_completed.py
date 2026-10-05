import json
from unittest import mock

from app.dependencies import get_db
from app.main import app
from app.models.timetable_import import TimetableImport

COMPLETE = "/api/users/me/complete-onboarding"

CLASS = {
    "course_name": "Data Structures",
    "course_code": "COE 353",
    "day_of_week": 0,
    "start_time": "08:00",
    "end_time": "10:00",
    "venue": "LT1",
    "lecturer": None,
    "class_type": "lecture",
}


def _db():
    return next(app.dependency_overrides[get_db]())


def _me(client):
    return client.get("/api/auth/me").json()


def _add_key(client):
    with mock.patch("app.routers.users.validate_gemini_api_key", return_value=True):
        response = client.post("/api/users/me/gemini-key", json={"api_key": "A" * 30})
    assert response.status_code == 200


def _add_academic_info(client):
    response = client.patch(
        "/api/users/me",
        json={
            "university": "KNUST",
            "programme": "Computer Engineering",
            "level": "Year 3",
            "semester": "First Semester",
        },
    )
    assert response.status_code == 200


def test_new_students_have_not_finished_onboarding(auth_client):
    assert _me(auth_client)["onboarding_completed"] is False


def test_cannot_finish_before_the_earlier_steps(auth_client):
    assert auth_client.post(COMPLETE).status_code == 400

    _add_key(auth_client)
    assert auth_client.post(COMPLETE).status_code == 400  # academic info still missing
    assert _me(auth_client)["onboarding_completed"] is False


def test_finishing_works_and_can_be_repeated(auth_client):
    _add_key(auth_client)
    _add_academic_info(auth_client)

    first = auth_client.post(COMPLETE)
    assert first.status_code == 200
    assert first.json()["onboarding_completed"] is True
    assert _me(auth_client)["onboarding_completed"] is True

    assert auth_client.post(COMPLETE).status_code == 200


def test_activating_a_plan_finishes_onboarding(auth_client):
    user_id = _me(auth_client)["id"]
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
        import_id = item.id
    finally:
        db.close()

    session = {
        "day_of_week": 0, "start_time": "12:00", "end_time": "13:00",
        "duration_minutes": 60, "course_name": "Data Structures",
        "course_code": "COE 353", "topic": "Revise", "venue": "Library",
    }
    response = auth_client.post(
        "/api/study-plan/activate",
        json={"import_id": import_id, "sessions": [session], "weeks": 1},
    )
    assert response.status_code == 200, response.text
    assert _me(auth_client)["onboarding_completed"] is True


def test_the_flag_belongs_to_one_student(auth_client, auth_client_b):
    _add_key(auth_client)
    _add_academic_info(auth_client)
    assert auth_client.post(COMPLETE).status_code == 200

    assert _me(auth_client_b)["onboarding_completed"] is False


def test_requires_login(client):
    assert client.post(COMPLETE).status_code in (401, 403)