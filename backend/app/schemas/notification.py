import datetime
import uuid

from pydantic import BaseModel


class NotificationPublic(BaseModel):
    id: uuid.UUID
    title: str
    message: str
    severity: str
    is_read: bool
    created_at: datetime.datetime

    model_config = {"from_attributes": True}
