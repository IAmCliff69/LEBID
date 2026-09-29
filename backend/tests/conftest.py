import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base
from app.dependencies import get_db

# Use a separate test database so tests never touch your real data
TEST_DATABASE_URL = "postgresql://postgres:postgres_65@localhost:5432/lebid_test"

test_engine = create_engine(TEST_DATABASE_URL)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    """Replaces the real database session with the test database session."""
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Override the database dependency so all tests use the test DB
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Creates all tables in the test database before tests run,
    and drops them all afterwards.
    Runs once per test session.
    """
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def clean_tables():
    """
    Clears all table data between each test so tests don't affect each other.
    Runs before every single test.
    """
    yield
    db = TestSessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client():
    """Provides a test client for making API requests."""
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture
def registered_user(client):
    """
    Registers a test user and returns their data.
    Does not log them in.
    """
    response = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "testpassword123",
    })
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def auth_client(client):
    """
    Registers and logs in a test user.
    Returns the client with the auth cookie set.
    """
    client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "testpassword123",
    })
    client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpassword123",
    })
    return client


@pytest.fixture
def auth_client_b(client):
    """
    Registers and logs in a second test user (User B).
    Used for data isolation tests.
    """
    # Need a separate client instance for User B
    client_b = TestClient(app, raise_server_exceptions=True)
    client_b.post("/api/auth/register", json={
        "full_name": "User B",
        "email": "userb@example.com",
        "password": "testpassword123",
    })
    client_b.post("/api/auth/login", json={
        "email": "userb@example.com",
        "password": "testpassword123",
    })
    return client_b


@pytest.fixture
def sample_course(auth_client):
    """Creates a sample course for the logged-in test user."""
    response = auth_client.post("/api/courses", json={
        "name": "Data Structures",
        "code": "COE 353",
        "credit_hours": 3,
        "color": "#4F46E5",
    })
    assert response.status_code == 201
    return response.json()