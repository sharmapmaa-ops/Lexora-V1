import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.models.support import SupportTicket, SupportTicketMessage, TicketStatus
from app.models.user import User, UserRole
from app.schemas.support import (
    SupportTicketCreate,
    SupportTicketMessageCreate,
    SupportTicketPublic,
    SupportTicketStatusUpdate,
)

router = APIRouter(prefix="/support", tags=["support"])


def _is_staff(user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.developer)


def _to_public(ticket: SupportTicket, viewer: User) -> SupportTicketPublic:
    """Attaches requester name/email so staff viewing the shared queue
    can see who raised each ticket - a regular user only ever sees
    their own tickets anyway, so this is never someone else's identity
    leaking to a non-staff viewer."""
    public = SupportTicketPublic.model_validate(ticket)
    if _is_staff(viewer) and ticket.user is not None:
        public.requester_name = ticket.user.full_name
        public.requester_email = ticket.user.email
    return public


@router.get("", response_model=list[SupportTicketPublic])
def list_tickets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(SupportTicket)
    if not _is_staff(current_user):
        query = query.filter(SupportTicket.user_id == current_user.id)
    tickets = query.order_by(desc(SupportTicket.created_at)).all()
    return [_to_public(t, current_user) for t in tickets]


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
    return _to_public(ticket, current_user)


def _get_ticket_for_viewer(db: Session, current_user: User, ticket_id: uuid.UUID) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found.")
    if ticket.user_id != current_user.id and not _is_staff(current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot access this ticket.")
    return ticket


@router.post("/{ticket_id}/messages", response_model=SupportTicketPublic)
def reply_to_ticket(
    ticket_id: uuid.UUID,
    payload: SupportTicketMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_for_viewer(db, current_user, ticket_id)
    ticket.messages.append(SupportTicketMessage(author_id=current_user.id, body=payload.body))
    # A staff reply on an open ticket moves it forward automatically -
    # matches the old project's flow where responding was itself the
    # signal that someone was now looking into it.
    if _is_staff(current_user) and ticket.status == TicketStatus.open:
        ticket.status = TicketStatus.in_progress
    db.commit()
    db.refresh(ticket)
    return _to_public(ticket, current_user)


@router.patch("/{ticket_id}/status", response_model=SupportTicketPublic)
def update_ticket_status(
    ticket_id: uuid.UUID,
    payload: SupportTicketStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _is_staff(current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only staff can change a ticket's status.")
    ticket = _get_ticket_for_viewer(db, current_user, ticket_id)
    try:
        ticket.status = TicketStatus(payload.status)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{payload.status}' is not a valid status.")
    db.commit()
    db.refresh(ticket)
    return _to_public(ticket, current_user)
