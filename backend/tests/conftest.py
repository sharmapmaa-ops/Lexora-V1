import uuid
from decimal import Decimal

import pytest
from sqlalchemy.orm import sessionmaker

from app.core.database import engine
from app.core.llm import LlmClient
from app.core.security import hash_password
from app.models.plan import Plan, PlanServicePricing, ServiceCode
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User, UserRole, UserStatus


@pytest.fixture()
def db():
    """Real Postgres session wrapped in a transaction that's rolled back
    after the test - genuine SQL runs, nothing persists between tests."""
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def free_plan(db):
    plan = db.get(Plan, "free")
    if plan is None:
        plan = Plan(id="free", name="Free", icon="\U0001F193", monthly_price=Decimal("0"))
        db.add(plan)
        db.flush()
    if not any(p.service_code == ServiceCode.translation for p in plan.service_pricing):
        db.add(PlanServicePricing(
            plan_id=plan.id, service_code=ServiceCode.translation, unit="page", price=Decimal("400"),
        ))
        db.flush()
    return plan


@pytest.fixture()
def test_user(db, free_plan):
    user = User(
        email=f"pytest-{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TestPass123"),
        first_name="Pytest",
        last_name="User",
        role=UserRole.user,
        status=UserStatus.active,
        plan_id=free_plan.id,
    )
    db.add(user)
    db.flush()
    return user


def give_balance(db, user, amount: Decimal):
    db.add(Transaction(
        user_id=user.id,
        type=TransactionType.wallet_topup,
        status=TransactionStatus.success,
        description="Test top-up",
        credit=amount,
    ))
    db.flush()


class FakeLlmClient(LlmClient):
    """Returns a fixed, recognizable response instead of calling any
    real API - lets pipeline tests verify billing/storage/job-status
    behavior without needing OPENROUTER_API_KEY/OPENAI_API_KEY."""

    def __init__(self, response: str = "FAKE TRANSLATED TEXT"):
        self.response = response
        self.last_system_prompt: str | None = None
        self.last_user_prompt: str | None = None
        self.image_call_count = 0

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        self.last_system_prompt = system_prompt
        self.last_user_prompt = user_prompt
        return self.response

    async def complete_with_image(self, system_prompt: str, user_prompt: str, image_png: bytes) -> str:
        self.last_system_prompt = system_prompt
        self.last_user_prompt = user_prompt
        self.image_call_count += 1
        return self.response


class FailingLlmClient(LlmClient):
    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        raise RuntimeError("Simulated LLM provider outage")

    async def complete_with_image(self, system_prompt: str, user_prompt: str, image_png: bytes) -> str:
        raise RuntimeError("Simulated LLM provider outage")
