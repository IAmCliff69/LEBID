from pydantic import BaseModel


class NotificationPreferencesRequest(BaseModel):
    """The notification switches the student chose."""
    deadline_reminders: bool
    exam_reminders: bool
    missed_session_alerts: bool


class NotificationPreferencesResponse(BaseModel):
    """The student's notification switches."""
    deadline_reminders: bool
    exam_reminders: bool
    missed_session_alerts: bool

    model_config = {"from_attributes": True}