from datetime import date, timedelta


def test_no_conflicts_empty_schedule(auth_client):
    tomorrow = str(date.today() + timedelta(days=1))
    response = auth_client.post("/api/conflicts/check", json={
        "check_date": tomorrow,
        "start_time": "09:00:00",
        "end_time": "11:00:00",
    })
    assert response.status_code == 200
    assert response.json()["has_conflicts"] == False
    assert response.json()["conflict_count"] == 0


def test_conflict_with_study_session(auth_client, sample_course):
    tomorrow = str(date.today() + timedelta(days=1))

    # Create a study session
    auth_client.post("/api/study-sessions", json={
        "course_id": sample_course["id"],
        "session_date": tomorrow,
        "start_time": "09:00:00",
        "end_time": "11:00:00",
        "venue": "Library",
    })

    # Check for conflict in overlapping slot
    response = auth_client.post("/api/conflicts/check", json={
        "check_date": tomorrow,
        "start_time": "10:00:00",
        "end_time": "12:00:00",
    })
    assert response.json()["has_conflicts"] == True
    assert response.json()["conflicts"][0]["conflict_type"] == "study_session"


def test_conflict_with_event(auth_client):
    tomorrow = str(date.today() + timedelta(days=1))

    auth_client.post("/api/events", json={
        "title": "Team Meeting",
        "event_date": tomorrow,
        "start_time": "14:00:00",
        "end_time": "15:00:00",
        "flexibility": "fixed",
    })

    response = auth_client.post("/api/conflicts/check", json={
        "check_date": tomorrow,
        "start_time": "14:30:00",
        "end_time": "15:30:00",
    })
    assert response.json()["has_conflicts"] == True
    assert response.json()["conflicts"][0]["conflict_type"] == "event"


def test_no_conflict_adjacent_times(auth_client, sample_course):
    tomorrow = str(date.today() + timedelta(days=1))

    auth_client.post("/api/study-sessions", json={
        "course_id": sample_course["id"],
        "session_date": tomorrow,
        "start_time": "09:00:00",
        "end_time": "11:00:00",
        "venue": "Library",
    })

    # Adjacent but not overlapping
    response = auth_client.post("/api/conflicts/check", json={
        "check_date": tomorrow,
        "start_time": "11:00:00",
        "end_time": "13:00:00",
    })
    assert response.json()["has_conflicts"] == False


def test_conflicts_scoped_to_user(auth_client, auth_client_b):
    tomorrow = str(date.today() + timedelta(days=1))

    # User B creates an event
    auth_client_b.post("/api/events", json={
        "title": "User B Event",
        "event_date": tomorrow,
        "start_time": "10:00:00",
        "end_time": "12:00:00",
        "flexibility": "fixed",
    })

    # User A checks same slot — should see no conflicts
    response = auth_client.post("/api/conflicts/check", json={
        "check_date": tomorrow,
        "start_time": "10:00:00",
        "end_time": "12:00:00",
    })
    assert response.json()["has_conflicts"] == False