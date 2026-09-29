from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings


# The engine is the actual connection to PostgreSQL.
# pool_pre_ping=True checks that the connection is alive before using it.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)

# SessionLocal is a factory that creates individual database sessions.
# Each request gets its own session, which is closed when the request ends.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.
    Every model in app/models/ will inherit from this.
    """
    pass


def check_database_connection() -> bool:
    """
    Attempts a simple query to verify the database is reachable.
    Used by the /api/ping health check endpoint.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False