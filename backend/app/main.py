from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import check_database_connection
from app.routers import auth, users, courses, timetable, timetable_import, tasks, assignments, exams, events, study_sessions, conflicts, ai, analytics, notifications

app = FastAPI(
    title="Lebid API",
    description="Backend API for Lebid — Intelligent Student Academic Planning",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS middleware
# ---------------------------------------------------------------------------

origins = [origin.strip() for origin in settings.cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(timetable.router, prefix="/api/timetable", tags=["timetable"])
app.include_router(timetable_import.router, prefix="/api/timetable-import", tags=["timetable-import"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["assignments"])
app.include_router(exams.router, prefix="/api/exams", tags=["exams"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(study_sessions.router, prefix="/api/study-sessions", tags=["study-sessions"])
app.include_router(conflicts.router, prefix="/api/conflicts", tags=["conflicts"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])

# ---------------------------------------------------------------------------
# Health check endpoints
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "service": "Lebid API",
        "version": "0.1.0",
        "environment": settings.app_env,
    }


@app.get("/api/ping", tags=["health"])
def ping():
    db_ok = check_database_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "db_connected": db_ok,
    }