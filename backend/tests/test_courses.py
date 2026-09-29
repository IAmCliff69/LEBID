def test_create_course(auth_client):
    response = auth_client.post("/api/courses", json={
        "name": "Operating Systems",
        "code": "COE 354",
        "credit_hours": 3,
        "color": "#4F46E5",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Operating Systems"
    assert data["code"] == "COE 354"
    assert "id" in data


def test_create_course_invalid_color(auth_client):
    response = auth_client.post("/api/courses", json={
        "name": "Test Course",
        "color": "not-a-color",
    })
    assert response.status_code == 422


def test_list_courses(auth_client):
    auth_client.post("/api/courses", json={"name": "Course A"})
    auth_client.post("/api/courses", json={"name": "Course B"})
    response = auth_client.get("/api/courses")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_course(auth_client, sample_course):
    response = auth_client.get(f"/api/courses/{sample_course['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == sample_course["id"]


def test_get_course_not_found(auth_client):
    response = auth_client.get("/api/courses/nonexistent-id")
    assert response.status_code == 404


def test_update_course(auth_client, sample_course):
    response = auth_client.patch(f"/api/courses/{sample_course['id']}", json={
        "lecturer": "Prof. Mensah",
    })
    assert response.status_code == 200
    assert response.json()["lecturer"] == "Prof. Mensah"
    assert response.json()["name"] == sample_course["name"]


def test_delete_course(auth_client, sample_course):
    response = auth_client.delete(f"/api/courses/{sample_course['id']}")
    assert response.status_code == 200
    response = auth_client.get(f"/api/courses/{sample_course['id']}")
    assert response.status_code == 404


def test_course_data_isolation(auth_client, auth_client_b):
    # Create course as User A
    response = auth_client.post("/api/courses", json={"name": "User A Course"})
    course_id = response.json()["id"]

    # User B should not be able to access it
    response = auth_client_b.get(f"/api/courses/{course_id}")
    assert response.status_code == 404


def test_unauthenticated_course_access(client):
    response = client.get("/api/courses")
    assert response.status_code == 401