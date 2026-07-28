import io
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.models.company import CompanyProfile
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.schemas.transaction import (
    CreateOrderRequest,
    CreateOrderResponse,
    TransactionPublic,
    VerifyPaymentRequest,
)
from app.services.billing_service import (
    create_wallet_topup_order,
    get_wallet_balance,
    verify_and_credit_wallet,
)
from app.services.invoice_service import build_invoice_pdf

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/balance")
def balance(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total_credit = sum((t.credit for t in current_user.transactions), Decimal("0.00"))
    total_debit = sum((t.debit for t in current_user.transactions), Decimal("0.00"))
    return {
        "total_credit": total_credit,
        "total_debit": total_debit,
        "current_balance": total_credit - total_debit,
    }


@router.get("/history", response_model=list[TransactionPublic])
def history(
    user_id: uuid.UUID | None = Query(default=None, description="Admin/Developer only - view another user's history"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if current_user.role in (UserRole.admin, UserRole.developer) and user_id is not None:
        query = query.filter(Transaction.user_id == user_id)
    else:
        query = query.filter(Transaction.user_id == current_user.id)
    return query.order_by(desc(Transaction.created_at)).all()


@router.post("/create-order", response_model=CreateOrderResponse)
def create_order(payload: CreateOrderRequest, current_user: User = Depends(get_current_user)):
    return create_wallet_topup_order(payload.amount)


@router.post("/verify-payment", response_model=TransactionPublic)
def verify_payment(
    payload: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return verify_and_credit_wallet(
        db, current_user,
        payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature,
        payload.description,
    )


@router.get("/invoice.pdf")
def invoice_pdf(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = db.get(CompanyProfile, 1)
    pdf_bytes = build_invoice_pdf(company, current_user, current_user.transactions)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="invoice-{current_user.id}.pdf"'},
    )
