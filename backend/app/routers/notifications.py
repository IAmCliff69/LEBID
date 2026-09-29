from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.notification import NotificationResponse, GenerateNotificationsResponse
from app.services.notifications import generate_notifications

router = APIRouter()


@router.post("/generate", response_model=GenerateNotificationsResponse)
def generate(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Scans the student's data and generates notifications for
    anything that needs attention.

    Call this endpoint to refresh notifications based on the
    current state of the student's schedule. It avoids creating
    duplicates — calling it multiple times is safe.
    """
    count = generate_notifications(current_user.id, db)
    return GenerateNotificationsResponse(
        created_count=count,
        message=(
            f"Generated {count} new notification{'s' if count != 1 else ''}."
            if count > 0
            else "No new notifications to generate."
        ),
    )


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
):
    """
    Returns the current user's notifications.

    Filters:
    - unread_only: only return unread notifications
    - limit: maximum number to return (default 50)
    """
    query = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
    )

    if unread_only:
        query = query.filter(Notification.is_read == False)

    notifications = (
        query
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return notifications


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the count of unread notifications.
    Used by the frontend to show a notification badge.
    """
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .count()
    )
    return {"unread_count": count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks a single notification as read."""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/read-all", response_model=MessageResponse)
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks all notifications as read."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}


@router.delete("/{notification_id}", response_model=MessageResponse)
def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a single notification."""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted."}


@router.delete("", response_model=MessageResponse)
def clear_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes all notifications for the current user."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
    ).delete()
    db.commit()
    return {"message": "All notifications cleared."}