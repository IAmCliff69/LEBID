from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    """Notification data returned to the client."""
    id: str
    user_id: str
    notification_type: str
    title: str
    message: str
    is_read: bool
    linked_item_type: str | None
    linked_item_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateNotificationsResponse(BaseModel):
    """Response after generating notifications."""
    created_count: int
    message: str