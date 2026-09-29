from datetime import datetime, timezone, timedelta


def test_generate_notifications_empty(auth_client):
    response = auth_client.post("/api/notifications/generate")
    assert response.status_code == 200
    assert response.json()["created_count"] == 0


def test_generate_notifications_for_upcoming_assignment(auth_client, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Urgent assignment",
        "deadline": deadline,
    })

    response = auth_client.post("/api/notifications/generate")
    assert response.json()["created_count"] >= 1

    notifs = auth_client.get("/api/notifications").json()
    types = [n["notification_type"] for n in notifs]
    assert "deadline_urgent" in types


def test_generate_notifications_no_duplicates(auth_client, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Test assignment",
        "deadline": deadline,
    })

    # Generate twice
    auth_client.post("/api/notifications/generate")
    response = auth_client.post("/api/notifications/generate")

    # Second generation should create 0 new notifications
    assert response.json()["created_count"] == 0


def test_mark_notification_as_read(auth_client, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Test assignment",
        "deadline": deadline,
    })
    auth_client.post("/api/notifications/generate")

    notifs = auth_client.get("/api/notifications").json()
    notif_id = notifs[0]["id"]

    response = auth_client.patch(f"/api/notifications/{notif_id}/read")
    assert response.json()["is_read"] == True


def test_mark_all_as_read(auth_client, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Test assignment",
        "deadline": deadline,
    })
    auth_client.post("/api/notifications/generate")

    auth_client.post("/api/notifications/read-all")

    response = auth_client.get("/api/notifications/unread-count")
    assert response.json()["unread_count"] == 0


def test_delete_notification(auth_client, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "Test assignment",
        "deadline": deadline,
    })
    auth_client.post("/api/notifications/generate")

    notifs = auth_client.get("/api/notifications").json()
    notif_id = notifs[0]["id"]

    auth_client.delete(f"/api/notifications/{notif_id}")
    response = auth_client.get("/api/notifications")
    ids = [n["id"] for n in response.json()]
    assert notif_id not in ids


def test_notification_data_isolation(auth_client, auth_client_b, sample_course):
    deadline = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    auth_client.post("/api/assignments", json={
        "course_id": sample_course["id"],
        "title": "User A assignment",
        "deadline": deadline,
    })
    auth_client.post("/api/notifications/generate")

    # User B should see no notifications
    response = auth_client_b.get("/api/notifications")
    assert len(response.json()) == 0