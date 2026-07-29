"""
Billing business logic: plan switches and wallet top-ups.

The single most important rule encoded here, because it was a real bug
in the old project: **switching to a plan only ever charges the wallet
when it is an actual upgrade** (target monthly price higher than the
current plan's). A downgrade is always free. The old codebase charged
`plan.monthlyPrice` unconditionally on any switch, so moving from
Professional down to Standard silently deducted money - this module is
the fix, and it is the *only* place plan-switch charging logic exists.
"""
import datetime
import hmac
import hashlib
from decimal import Decimal

import razorpay
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.plan import Plan
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import PlanStatus, User
from app.services.notification_service import notify


def get_wallet_balance(db: Session, user_id) -> Decimal:
    rows = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.status == TransactionStatus.success,
    ).all()
    return sum((r.credit - r.debit for r in rows), Decimal("0.00"))


def switch_plan(db: Session, user: User, target_plan_id: str) -> User:
    target_plan = db.get(Plan, target_plan_id)
    if target_plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That plan does not exist.")

    current_plan = db.get(Plan, user.plan_id)
    is_downgrade = target_plan.monthly_price < current_plan.monthly_price

    if target_plan.monthly_price > 0 and not is_downgrade:
        balance = get_wallet_balance(db, user.id)
        if balance < target_plan.monthly_price:
            shortfall = target_plan.monthly_price - balance
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"Upgrading to {target_plan.name} costs {target_plan.currency} "
                f"{target_plan.monthly_price}/month, but your wallet only has "
                f"{current_plan.currency} {balance}. Add at least {shortfall} to your "
                f"wallet balance and try again.",
            )
        db.add(Transaction(
            user_id=user.id,
            type=TransactionType.plan_subscription,
            status=TransactionStatus.success,
            description=f"{target_plan.name} plan - monthly subscription",
            debit=target_plan.monthly_price,
        ))

    user.plan_id = target_plan.id
    user.plan_status = PlanStatus.active
    user.plan_started_at = datetime.date.today()
    user.plan_ends_at = datetime.date.today() + datetime.timedelta(days=30)
    db.commit()
    db.refresh(user)
    notify(
        db, user.id,
        f"Plan changed to {target_plan.name}",
        f"You are now on the {target_plan.name} plan ({target_plan.currency} {target_plan.monthly_price}/month).",
    )
    return user


def _razorpay_client() -> razorpay.Client:
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Razorpay is not configured on this server.",
        )
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def create_wallet_topup_order(amount: Decimal) -> dict:
    if amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Amount must be greater than zero.")
    client = _razorpay_client()
    amount_paise = int(amount * 100)
    order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "payment_capture": 1,
    })
    return {
        "order_id": order["id"],
        "amount_paise": amount_paise,
        "currency": "INR",
        "razorpay_key_id": settings.RAZORPAY_KEY_ID,
    }


def verify_and_credit_wallet(
    db: Session, user: User, order_id: str, payment_id: str, signature: str, description: str,
) -> Transaction:
    body = f"{order_id}|{payment_id}".encode()
    expected_signature = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment signature verification failed.")

    client = _razorpay_client()
    payment = client.payment.fetch(payment_id)
    amount = Decimal(payment["amount"]) / 100

    txn = Transaction(
        user_id=user.id,
        type=TransactionType.wallet_topup,
        status=TransactionStatus.success,
        description=description or "Wallet top-up",
        payment_mode="Razorpay",
        credit=amount,
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn
