from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationSeverity


def notify(db: Session, user_id, title: str, message: str, severity: NotificationSeverity = NotificationSeverity.info) -> None:
    db.add(Notification(user_id=user_id, title=title, message=message, severity=severity))
    db.commit()
