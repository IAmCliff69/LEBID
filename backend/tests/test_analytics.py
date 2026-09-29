from datetime import datetime, timezone, timedelta, date


def test_workload_overview_empty(auth_client):
    response = auth_client.get("/api/analytics/workload")
    assert response.status_code == 200
    data = response.json()
    assert data["assignments_due_in_7_days"] == 0
    assert data["exams_in_14_days"] == 0
    assert data["missed_study_sessions"] == 0


def test_workload_counts_upcoming_assignments(auth_client, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Upcoming assignment",
        "deadline": deadline,
    })

    response = auth_client.get("/api/analytics/workload")
    assert response.json()["assignments_due_in_7_days"] == 1


def test_study_hours_empty(auth_client):
    response = auth_client.get("/api/analytics/study-hours")
    assert response.status_code == 200
    data = response.json()
    assert data["planned_hours"] == 0
    assert data["completed_hours"] == 0
    assert data["total_sessions"] == 0


def test_study_hours_counts_sessions(auth_client, sample_course):
    today = str(date.today())
    auth_client.post("/api/study-sessions", json={
        "course_id": sample_course["id"],
        "session_date": today,
        "start_time": "09:00:00",
        "end_time": "11:00:00",
        "venue": "Library",
    })

    response = auth_client.get("/api/analytics/study-hours?period=this_week")
    data = response.json()
    assert data["total_sessions"] == 1
    assert data["planned_hours"] == 2.0


def test_analytics_summary_structure(auth_client):
    response = auth_client.get("/api/analytics/summary")
    assert response.status_code == 200
    data = response.json()
    assert "study_hours" in data
    assert "course_distribution" in data
    assert "tasks" in data
    assert "assignments" in data
    assert "workload" in data


def test_weekly_review_structure(auth_client):
    response = auth_client.get("/api/analytics/weekly-review")
    assert response.status_code == 200
    data = response.json()
    assert "last_week" in data
    assert "this_week" in data
    assert "upcoming_workload" in data