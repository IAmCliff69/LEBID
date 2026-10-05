import json

from app.dependencies import get_db
from app.main import app
from app.models.course import Course
from app.models.timetable import TimetableEntry
from app.models.timetable_import import TimetableImport

ENTRY = {
    "course_name": "Data Structures",
    "course_code": "COE 353",
    "day_of_week": 0,
    "start_time": "08:00",
    "end_time": "10:00",
    "venue": "LT1",
    "lecturer": None,
    "class_type": "lecture",
}
ENTRY_2 = {
    "course_name": "Databases",
    "course_code": "COE 368",
    "day_of_week": 2,
    "start_time": "14:00",
    "end_time": "16:00",
    "venue": "Lab 3",
    "lecturer": None,
    "class_type": "lab",
}


def _db():
    return next(app.dependency_overrides[get_db]())


def _user_id(client):
    return client.get("/api/auth/me").json()["id"]


def _make_import(client, status="extracted"):
    db = _db()
    try:
        item = TimetableImport(
            user_id=_user_id(client),
            original_filename="timetable.png",
            status=status,
            extracted_data=json.dumps({"entries": [ENTRY, ENTRY_2]}),
        )
        db.add(item)
        db.commit()
        return item.id
    finally:
        db.close()


def _confirm(client, import_id, entries):
    return client.post(
        f"/api/timetable-import/confirm/{import_id}", json={"entries": entries}
    )


def _counts(client):
    user_id = _user_id(client)
    db = _db()
    try:
        return (
            db.query(Course).filter(Course.user_id == user_id).count(),
            db.query(TimetableEntry).filter(TimetableEntry.user_id == user_id).count(),
        )
    finally:
        db.close()


# --- confirming without any courses ------------------------------------------

def test_courses_are_created_from_the_extracted_names(auth_client):
    import_id = _make_import(auth_client)
    response = _confirm(auth_client, import_id, [ENTRY, ENTRY_2])

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["saved_count"] == 2
    assert body["courses_created"] == 2
    assert body["duplicates_skipped"] == 0
    assert _counts(auth_client) == (2, 2)


def test_two_classes_of_one_course_create_one_course(auth_client):
    import_id = _make_import(auth_client)
    friday = {**ENTRY, "day_of_week": 4}
    response = _confirm(auth_client, import_id, [ENTRY, friday])

    assert response.status_code == 200
    assert response.json()["saved_count"] == 2
    assert response.json()["courses_created"] == 1
    assert _counts(auth_client) == (1, 2)


def test_an_existing_course_is_reused_ignoring_capitals(auth_client):
    db = _db()
    try:
        db.add(Course(user_id=_user_id(auth_client), code="coe 353", name="Data Structures"))
        db.commit()
    finally:
        db.close()

    import_id = _make_import(auth_client)
    response = _confirm(auth_client, import_id, [ENTRY])

    assert response.status_code == 200
    assert response.json()["courses_created"] == 0
    assert _counts(auth_client) == (1, 1)


def test_choosing_an_existing_course_by_id_still_works(auth_client):
    db = _db()
    try:
        course = Course(user_id=_user_id(auth_client), code="COE 353", name="Data Structures")
        db.add(course)
        db.commit()
        course_id = course.id
    finally:
        db.close()

    import_id = _make_import(auth_client)
    entry = {**ENTRY, "course_id": course_id, "course_name": None, "course_code": None}
    response = _confirm(auth_client, import_id, [entry])

    assert response.status_code == 200
    assert response.json()["courses_created"] == 0
    assert _counts(auth_client) == (1, 1)


# --- things that must be refused ---------------------------------------------

def test_an_entry_without_any_course_is_rejected(auth_client):
    import_id = _make_import(auth_client)
    entry = {**ENTRY, "course_name": "   ", "course_code": None}
    assert _confirm(auth_client, import_id, [entry]).status_code == 422
    assert _counts(auth_client) == (0, 0)


def test_unknown_course_id_saves_nothing(auth_client):
    import_id = _make_import(auth_client)
    entry = {**ENTRY, "course_id": "does-not-exist"}
    assert _confirm(auth_client, import_id, [ENTRY_2, entry]).status_code == 404
    # the first (valid) entry was not kept either
    assert _counts(auth_client) == (0, 0)


def test_a_bad_time_saves_nothing(auth_client):
    import_id = _make_import(auth_client)
    bad = {**ENTRY, "start_time": "11:00", "end_time": "09:00"}
    assert _confirm(auth_client, import_id, [ENTRY_2, bad]).status_code == 400
    assert _counts(auth_client) == (0, 0)


def test_an_import_can_only_be_confirmed_once(auth_client):
    import_id = _make_import(auth_client)
    assert _confirm(auth_client, import_id, [ENTRY]).status_code == 200
    assert _confirm(auth_client, import_id, [ENTRY]).status_code == 400


def test_cannot_confirm_another_students_import(auth_client, auth_client_b):
    import_id = _make_import(auth_client)
    assert _confirm(auth_client_b, import_id, [ENTRY]).status_code == 404


# --- duplicates ---------------------------------------------------------------

def test_a_class_already_in_the_timetable_is_skipped(auth_client):
    first = _make_import(auth_client)
    assert _confirm(auth_client, first, [ENTRY]).status_code == 200

    second = _make_import(auth_client)
    response = _confirm(auth_client, second, [ENTRY, ENTRY_2])

    assert response.status_code == 200
    assert response.json()["saved_count"] == 1
    assert response.json()["duplicates_skipped"] == 1
    assert response.json()["courses_created"] == 1
    assert _counts(auth_client) == (2, 2)


# --- resuming an unfinished upload ------------------------------------------

def test_pending_upload_is_returned_and_then_discarded(auth_client):
    assert auth_client.get("/api/timetable-import/pending").json() is None

    import_id = _make_import(auth_client)
    pending = auth_client.get("/api/timetable-import/pending").json()
    assert pending["import_id"] == import_id
    assert len(pending["extracted_entries"]) == 2
    assert pending["original_filename"] == "timetable.png"

    assert auth_client.post(f"/api/timetable-import/discard/{import_id}").status_code == 200
    assert auth_client.get("/api/timetable-import/pending").json() is None


def test_a_confirmed_upload_is_no_longer_pending(auth_client):
    import_id = _make_import(auth_client)
    _confirm(auth_client, import_id, [ENTRY])
    assert auth_client.get("/api/timetable-import/pending").json() is None


def test_pending_uploads_are_private(auth_client, auth_client_b):
    import_id = _make_import(auth_client)
    assert auth_client_b.get("/api/timetable-import/pending").json() is None
    assert auth_client_b.post(f"/api/timetable-import/discard/{import_id}").status_code == 404