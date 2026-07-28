import datetime
import uuid
from decimal import Decimal

from pydantic import BaseModel


class TransactionPublic(BaseModel):
    id: uuid.UUID
    type: str
    status: str
    description: str
    payment_mode: str
    credit: Decimal
    debit: Decimal
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class CreateOrderRequest(BaseModel):
    amount: Decimal


class CreateOrderResponse(BaseModel):
    order_id: str
    amount_paise: int
    currency: str
    razorpay_key_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    description: str = ""
