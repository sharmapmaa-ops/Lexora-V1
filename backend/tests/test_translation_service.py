import pytest
from decimal import Decimal

from app.models.processing_job import JobStatus
from app.services.billing_service import get_wallet_balance
from app.services.processing.translation_service import TranslationService
from tests.conftest import FailingLlmClient, FakeLlmClient, give_balance


@pytest.mark.asyncio
async def test_translation_rejects_when_wallet_insufficient(db, test_user):
    service = TranslationService(FakeLlmClient())
    with pytest.raises(Exception) as exc_info:
        await service.process_upload(db, test_user, "doc.txt", b"Hello world", "Spanish")
    assert "402" in str(exc_info.value) or "wallet" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_translation_succeeds_and_bills_wallet(db, test_user):
    give_balance(db, test_user, Decimal("1000"))
    fake_llm = FakeLlmClient(response="Hola mundo")

    service = TranslationService(fake_llm)
    job = await service.process_upload(db, test_user, "doc.txt", b"Hello world", "Spanish")

    assert job.status == JobStatus.completed
    assert job.result_metadata["translated_text"] == "Hola mundo"
    assert job.billed_amount == Decimal("400.00")  # Free plan's translation rate

    # Wallet was actually debited, not just billed_amount recorded on the job.
    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("600.00")

    # The LLM was actually invoked with the right instructions - proves
    # the service wired the prompt correctly, not just that it didn't crash.
    assert "Spanish" in fake_llm.last_user_prompt
    assert "Hello world" in fake_llm.last_user_prompt


@pytest.mark.asyncio
async def test_translation_failure_does_not_charge_wallet(db, test_user):
    give_balance(db, test_user, Decimal("1000"))
    service = TranslationService(FailingLlmClient())

    job = await service.process_upload(db, test_user, "doc.txt", b"Hello world", "Spanish")

    assert job.status == JobStatus.failed
    assert "Simulated LLM provider outage" in job.error_message
    assert job.billed_amount == Decimal("0.00")

    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("1000.00")  # unchanged - a failed job never charges
