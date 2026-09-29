from datetime import datetime, timezone, timedelta


def test_create_task(auth_client):
    response = auth_client.post("/api/tasks", json={
        "title": "Read chapter 5",
        "priority": "high",
        "category": "academic",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Read chapter 5"
    assert data["priority"] == "high"
    assert data["is_completed"] == False


def test_create_task_with_course(auth_client, sample_course):
    response = auth_client.post("/api/tasks", json={
        "title": "Lab report",
        "course_id": sample_course["id"],
        "priority": "medium",
    })
    assert response.status_code == 201
    assert response.json()["course_id"] == sample_course["id"]


def test_create_task_invalid_course(auth_client):
    response = auth_client.post("/api/tasks", json={
        "title": "Test task",
        "course_id": "nonexistent-course-id",
    })
    assert response.status_code == 404


def test_list_tasks_hides_completed_by_default(auth_client):
    auth_client.post("/api/tasks", json={"title": "Active task"})
    resp = auth_client.post("/api/tasks", json={"title": "Completed task"})
    task_id = resp.json()["id"]
    auth_client.patch(f"/api/tasks/{task_id}", json={"status": "completed"})

    response = auth_client.get("/api/tasks")
    titles = [t["title"] for t in response.json()]
    assert "Active task" in titles
    assert "Completed task" not in titles


def test_list_tasks_include_completed(auth_client):
    auth_client.post("/api/tasks", json={"title": "Active task"})
    resp = auth_client.post("/api/tasks", json={"title": "Completed task"})
    task_id = resp.json()["id"]
    auth_client.patch(f"/api/tasks/{task_id}", json={"status": "completed"})

    response = auth_client.get("/api/tasks?include_completed=true")
    assert len(response.json()) == 2


def test_complete_task_sets_completed_at(auth_client):
    resp = auth_client.post("/api/tasks", json={"title": "Test task"})
    task_id = resp.json()["id"]

    response = auth_client.patch(f"/api/tasks/{task_id}", json={"status": "completed"})
    data = response.json()
    assert data["is_completed"] == True
    assert data["completed_at"] is not None
    assert data["status"] == "completed"


def test_overdue_task_detection(auth_client):
    past_deadline = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    auth_client.post("/api/tasks", json={
        "title": "Overdue task",
        "deadline": past_deadline,
        "priority": "high",
    })

    response = auth_client.get("/api/tasks/overdue")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == "overdue"


def test_delete_task(auth_client):
    resp = auth_client.post("/api/tasks", json={"title": "To delete"})
    task_id = resp.json()["id"]

    auth_client.delete(f"/api/tasks/{task_id}")
    response = auth_client.get(f"/api/tasks/{task_id}")
    assert response.status_code == 404


def test_task_data_isolation(auth_client, auth_client_b):
    resp = auth_client.post("/api/tasks", json={"title": "User A task"})
    task_id = resp.json()["id"]

    response = auth_client_b.get(f"/api/tasks/{task_id}")
    assert response.status_code == 404