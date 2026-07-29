import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationPublic

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationPublic])
def list_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(desc(Notification.created_at)).all()


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .count()
    )
    return {"count": count}


def _get_owned_notification(db: Session, current_user: User, notification_id: uuid.UUID) -> Notification:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")
    return notification


@router.post("/{notification_id}/read", response_model=NotificationPublic)
def mark_read(notification_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notification = _get_owned_notification(db, current_user, notification_id)
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/{notification_id}/unread", response_model=NotificationPublic)
def mark_unread(notification_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notification = _get_owned_notification(db, current_user, notification_id)
    notification.is_read = False
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/mark-all-read")
def mark_all_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read.is_(False)
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(notification_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notification = _get_owned_notification(db, current_user, notification_id)
    db.delete(notification)
    db.commit()
