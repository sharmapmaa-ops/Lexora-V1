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

    model_config = {"from_attributes": True}
