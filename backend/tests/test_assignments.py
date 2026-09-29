from datetime import datetime, timezone, timedelta


def test_create_assignment(auth_client, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    response = auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Lab Report",
        "deadline": deadline,
        "estimated_hours": 3,
        "priority": "high",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Lab Report"
    assert data["is_completed"] == False


def test_create_assignment_requires_course(auth_client):
    deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    response = auth_client.post("/api/assignments", json={
        "course_id": "nonexistent-id",
        "title": "Test",
        "deadline": deadline,
    })
    assert response.status_code == 404


def test_upcoming_assignments(auth_client, sample_course):
    soon = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    far = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()

    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Soon assignment",
        "deadline": soon,
    })
    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Far assignment",
        "deadline": far,
    })

    response = auth_client.get("/api/assignments/upcoming?days=7")
    titles = [a["title"] for a in response.json()]
    assert "Soon assignment" in titles
    assert "Far assignment" not in titles


def test_overdue_assignments(auth_client, sample_course):
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Overdue assignment",
        "deadline": past,
    })

    response = auth_client.get("/api/assignments/overdue")
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == "overdue"


def test_complete_assignment(auth_client, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    resp = auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Test assignment",
        "deadline": deadline,
    })
    assignment_id = resp.json()["id"]

    response = auth_client.patch(f"/api/assignments/{assignment_id}", json={
        "status": "completed",
    })
    assert response.json()["is_completed"] == True
    assert response.json()["completed_at"] is not None


def test_assignment_data_isolation(auth_client, auth_client_b, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    resp = auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "User A assignment",
        "deadline": deadline,
    })
    assignment_id = resp.json()["id"]

    response = auth_client_b.get(f"/api/assignments/{assignment_id}")
    assert response.status_code == 404