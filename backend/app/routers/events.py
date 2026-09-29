from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.event import Event
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.event import CreateEventRequest, UpdateEventRequest, EventResponse

router = APIRouter()


def get_event_or_404(event_id: str, user_id: str, db: Session) -> Event:
    """Fetches an event by ID and verifies it belongs to the current user."""
    event = (
        db.query(Event)
        .filter(Event.id == event_id, Event.user_id == user_id)
        .first()
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        )
    return event


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: CreateEventRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new event for the current user."""
    event = Event(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        event_date=payload.event_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location=payload.location,
        flexibility=payload.flexibility,
        is_recurring=payload.is_recurring,
        notes=payload.notes,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("", response_model=list[EventResponse])
def list_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    flexibility: str | None = Query(default=None),
    upcoming_only: bool = Query(default=False),
):
    """
    Returns all events for the current user.

    Filters:
    - flexibility: fixed, flexible, or protected
    - upcoming_only: only return events from today onwards
    """
    query = db.query(Event).filter(Event.user_id == current_user.id)

    if flexibility:
        query = query.filter(Event.flexibility == flexibility)

    if upcoming_only:
        query = query.filter(Event.event_date >= date.today())

    events = query.order_by(Event.event_date.asc()).all()
    return events


@router.get("/upcoming", response_model=list[EventResponse])
def get_upcoming_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(default=7, ge=1, le=90),
):
    """
    Returns events scheduled within the next N days.
    Default is 7 days. Maximum is 90 days.

    Used by the dashboard to show what is coming up soon,
    and by the scheduling system to avoid placing study
    sessions during these times.
    """
    today = date.today()
    cutoff = today + timedelta(days=days)

    events = (
        db.query(Event)
        .filter(
            Event.user_id == current_user.id,
            Event.event_date >= today,
            Event.event_date <= cutoff,
        )
        .order_by(Event.event_date.asc(), Event.start_time.asc())
        .all()
    )
    return events


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns a single event by ID."""
    return get_event_or_404(event_id, current_user.id, db)


@router.patch("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: str,
    payload: UpdateEventRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates an event. Only provided fields are changed."""
    event = get_event_or_404(event_id, current_user.id, db)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    for field, value in updates.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", response_model=MessageResponse)
def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes an event permanently."""
    event = get_event_or_404(event_id, current_user.id, db)
    db.delete(event)
    db.commit()
    return {"message": f"Event '{event.title}' has been deleted."}