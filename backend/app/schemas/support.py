import datetime
import uuid

from pydantic import BaseModel


class SupportTicketMessageCreate(BaseModel):
    body: str


class SupportTicketCreate(BaseModel):
    subject: str
    message: str
    related_transaction_id: uuid.UUID | None = None


class SupportTicketMessagePublic(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    body: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class SupportTicketPublic(BaseModel):
    id: uuid.UUID
    subject: str
    status: str
    created_at: datetime.datetime
    messages: list[SupportTicketMessagePublic]
    # Populated by the route (not a real relationship field) so admins
    # can see who raised each ticket without a second request per row.
    requester_name: str | None = None
    requester_email: str | None = None

    model_config = {"from_attributes": True}


class SupportTicketStatusUpdate(BaseModel):
    status: str
