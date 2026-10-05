import json
from datetime import datetime, timezone

from app.dependencies import get_db
from app.main import app
from app.models.course import Course
from app.models.study_session import StudySession
from app.models.timetable import TimetableEntry
from app.models.timetable_import import TimetableImport

# Two weekly classes
CLASSES = [
    {
        "course_name": "Data Structures", "course_code": "COE 353",
        "day_of_week": 0, "start_time": "08:00", "end_time": "10:00",
        "venue": "LT1", "lecturer": "Dr. Mensah", "class_type": "lecture",
    },
    {
        "course_name": "Databases", "course_code": "COE 368",
        "day_of_week": 2, "start_time": "14:00", "end_time": "16:00",
        "venue": "Lab 3", "lecturer": None, "class_type": "lab",
    },
]


def _db():
    return next(app.dependency_overrides[get_db]())


def _user_id(client):
    return client.get("/api/auth/me").json()["id"]


def _make_import(client):
    db = _db()
    try:
        item = TimetableImport(
            user_id=_user_id(client),
            original_filename="timetable.png",
            status="extracted",
            extracted_data=json.dumps({"entries": CLASSES}),
        )
        db.add(item)
        db.commit()
        return item.id
    finally:
        db.close()


def _session(**changes):
    return {
        "day_of_week": 0, "start_time": "12:00", "end_time": "13:00",
        "duration_minutes": 60, "course_name": "Data Structures",
        "course_code": "COE 353", "topic": "Revise linked lists",
        "venue": "Library", **changes,
    }


WEDNESDAY_SESSION = _session(
    day_of_week=2, start_time="10:00", end_time="11:30", duration_minutes=90,
    course_name="Databases", course_code="COE 368",
    topic="Normalisation", venue="Hostel Room",
)


def _activate(client, import_id, sessions, weeks=2):
    return client.post(
        "/api/study-plan/activate",
        json={"import_id": import_id, "sessions": sessions, "weeks": weeks},
    )


def _counts(client):
    user_id = _user_id(client)
    db = _db()
    try:
        return {
            "courses": db.query(Course).filter(Course.user_id == user_id).count(),
            "entries": db.query(TimetableEntry).filter(TimetableEntry.user_id == user_id).count(),
            "sessions": db.query(StudySession).filter(StudySession.user_id == user_id).count(),
        }
    finally:
        db.close()


def test_activation_saves_everything(auth_client):
    import_id = _make_import(auth_client)
    response = _activate(auth_client, import_id, [_session(), WEDNESDAY_SESSION], weeks=2)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["courses_created"] == 2
    assert body["courses_reused"] == 0
    assert body["timetable_entries_saved"] == 2
    assert body["study_sessions_created"] == 4  # 2 sessions x 2 weeks
    assert _counts(auth_client) == {"courses": 2, "entries": 2, "sessions": 4}

    user_id = _user_id(auth_client)
    today = datetime.now(timezone.utc).date()
    db = _db()
    try:
        sessions = db.query(StudySession).filter(StudySession.user_id == user_id).all()
        assert {s.venue for s in sessions} == {"Library", "Hostel Room"}
        assert all(s.status == "planned" and s.is_ai_generated for s in sessions)
        assert all(s.session_date >= today for s in sessions)
        # Monday sessions really fall on Mondays
        monday_sessions = [s for s in sessions if s.venue == "Library"]
        assert len(monday_sessions) == 2
        assert all(s.session_date.weekday() == 0 for s in monday_sessions)

        entry = (
            db.query(TimetableEntry)
            .filter(TimetableEntry.user_id == user_id, TimetableEntry.day_of_week == 0)
            .first()
        )
        assert entry.venue == "LT1" and entry.lecturer == "Dr. Mensah"

        item = db.query(TimetableImport).filter(TimetableImport.id == import_id).first()
        assert item.status == "confirmed"
    finally:
        db.close()


def test_activating_twice_is_refused(auth_client):
    import_id = _make_import(auth_client)
    assert _activate(auth_client, import_id, [_session()]).status_code == 200

    second = _activate(auth_client, import_id, [_session()])
    assert second.status_code == 409
    # nothing was added a second time
    assert _counts(auth_client)["sessions"] == 2


def test_existing_courses_are_reused(auth_client):
    import_id = _make_import(auth_client)
    db = _db()
    try:
        db.add(Course(user_id=_user_id(auth_client), code="COE 353", name="Data Structures"))
        db.commit()
    finally:
        db.close()

    body = _activate(auth_client, import_id, [_session()]).json()
    assert body["courses_reused"] == 1
    assert body["courses_created"] == 1
    assert _counts(auth_client)["courses"] == 2


def test_a_blank_venue_saves_nothing(auth_client):
    import_id = _make_import(auth_client)
    response = _activate(auth_client, import_id, [_session(venue="   ")])

    assert response.status_code == 400
    assert "venue" in response.json()["detail"]
    assert _counts(auth_client) == {"courses": 0, "entries": 0, "sessions": 0}


def test_a_session_on_top_of_a_class_saves_nothing(auth_client):
    import_id = _make_import(auth_client)
    clash = _session(start_time="09:00", end_time="10:00")
    response = _activate(auth_client, import_id, [clash])

    assert response.status_code == 400
    assert "class" in response.json()["detail"]
    assert _counts(auth_client) == {"courses": 0, "entries": 0, "sessions": 0}


def test_overlapping_sessions_save_nothing(auth_client):
    import_id = _make_import(auth_client)
    first = _session()
    second = _session(start_time="12:30", end_time="13:30", venue="Library")
    response = _activate(auth_client, import_id, [first, second])

    assert response.status_code == 400
    assert "overlaps" in response.json()["detail"]
    assert _counts(auth_client)["sessions"] == 0


def test_a_course_outside_the_timetable_is_refused(auth_client):
    import_id = _make_import(auth_client)
    stranger = _session(course_name="Pottery", course_code="ART 101")
    response = _activate(auth_client, import_id, [stranger])

    assert response.status_code == 400
    assert "not in your timetable" in response.json()["detail"]


def test_bad_requests_are_rejected(auth_client):
    import_id = _make_import(auth_client)
    assert _activate(auth_client, import_id, []).status_code == 422
    assert _activate(auth_client, import_id, [_session()], weeks=21).status_code == 422
    assert _activate(auth_client, import_id, [_session()], weeks=0).status_code == 422


def test_unknown_import_is_not_found(auth_client):
    assert _activate(auth_client, "does-not-exist", [_session()]).status_code == 404


def test_cannot_activate_another_students_import(auth_client, auth_client_b):
    import_id = _make_import(auth_client)
    response = _activate(auth_client_b, import_id, [_session()])
    assert response.status_code == 404
    assert _counts(auth_client_b) == {"courses": 0, "entries": 0, "sessions": 0}