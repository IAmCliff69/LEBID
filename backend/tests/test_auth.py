def test_register_success(client):
    response = client.post("/api/auth/register", json={
        "full_name": "Darryl Test",
        "email": "darryl@test.com",
        "password": "securepassword123",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "darryl@test.com"
    assert data["full_name"] == "Darryl Test"
    assert "hashed_password" not in data
    assert "password" not in data


def test_register_duplicate_email(client):
    client.post("/api/auth/register", json={
        "full_name": "User One",
        "email": "same@test.com",
        "password": "password123",
    })
    response = client.post("/api/auth/register", json={
        "full_name": "User Two",
        "email": "same@test.com",
        "password": "password456",
    })
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_register_short_password(client):
    response = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "test@test.com",
        "password": "short",
    })
    assert response.status_code == 422


def test_login_success(client):
    client.post("/api/auth/register", json={
        "full_name": "Login Test",
        "email": "login@test.com",
        "password": "password123",
    })
    response = client.post("/api/auth/login", json={
        "email": "login@test.com",
        "password": "password123",
    })
    assert response.status_code == 200
    assert "access_token" in client.cookies


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={
        "full_name": "Login Test",
        "email": "login2@test.com",
        "password": "correctpassword",
    })
    response = client.post("/api/auth/login", json={
        "email": "login2@test.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


def test_login_nonexistent_email(client):
    response = client.post("/api/auth/login", json={
        "email": "nobody@test.com",
        "password": "password123",
    })
    assert response.status_code == 401


def test_get_me_authenticated(auth_client):
    response = auth_client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "hashed_password" not in data


def test_get_me_unauthenticated(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_logout(auth_client):
    response = auth_client.post("/api/auth/logout")
    assert response.status_code == 200
    # After logout, /me should return 401
    response = auth_client.get("/api/auth/me")
    assert response.status_code == 401