import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.models.support import SupportTicket, SupportTicketMessage
from app.models.user import User, UserRole
from app.schemas.support import (
    SupportTicketCreate,
    SupportTicketMessageCreate,
    SupportTicketPublic,
)

router = APIRouter(prefix="/support", tags=["support"])


@router.get("", response_model=list[SupportTicketPublic])
def list_tickets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(SupportTicket)
    if current_user.role not in (UserRole.admin, UserRole.developer):
        query = query.filter(SupportTicket.user_id == current_user.id)
    return query.order_by(desc(SupportTicket.created_at)).all()


@router.post("", response_model=SupportTicketPublic, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: SupportTicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = SupportTicket(
        user_id=current_user.id,
        subject=payload.subject,
        related_transaction_id=payload.related_transaction_id,
    )
    ticket.messages.append(SupportTicketMessage(author_id=current_user.id, body=payload.message))
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/messages", response_model=SupportTicketPublic)
def reply_to_ticket(
    ticket_id: uuid.UUID,
    payload: SupportTicketMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found.")
    if ticket.user_id != current_user.id and current_user.role not in (UserRole.admin, UserRole.developer):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot reply to this ticket.")
    ticket.messages.append(SupportTicketMessage(author_id=current_user.id, body=payload.body))
    db.commit()
    db.refresh(ticket)
    return ticket
