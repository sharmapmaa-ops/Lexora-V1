import pytest
from decimal import Decimal

from app.models.processing_job import JobStatus
from app.services.billing_service import get_wallet_balance
from app.services.processing.data_extraction_service import DataExtractionService
from tests.conftest import FailingLlmClient, FakeLlmClient, give_balance


@pytest.mark.asyncio
async def test_extraction_rejects_when_wallet_insufficient(db, test_user):
    service = DataExtractionService(FakeLlmClient())
    with pytest.raises(Exception) as exc_info:
        await service.process_upload(db, test_user, "invoice.txt", b"Invoice #123, Total: $500", ["invoice_number", "total"])
    assert "402" in str(exc_info.value) or "wallet" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_extraction_succeeds_and_bills_wallet(db, test_user):
    give_balance(db, test_user, Decimal("1000"))
    fake_llm = FakeLlmClient(response='{"invoice_number": "123", "total": "$500"}')

    service = DataExtractionService(fake_llm)
    job = await service.process_upload(
        db, test_user, "invoice.txt", b"Invoice #123, Total: $500", ["invoice_number", "total"],
    )

    assert job.status == JobStatus.completed
    assert job.result_metadata["extracted"] == {"invoice_number": "123", "total": "$500"}
    assert job.billed_amount == Decimal("400.00")

    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("600.00")


@pytest.mark.asyncio
async def test_extraction_strips_markdown_code_fences(db, test_user):
    give_balance(db, test_user, Decimal("1000"))
    fake_llm = FakeLlmClient(response='```json\n{"invoice_number": "123"}\n```')

    service = DataExtractionService(fake_llm)
    job = await service.process_upload(db, test_user, "invoice.txt", b"Invoice #123", ["invoice_number"])

    assert job.status == JobStatus.completed
    assert job.result_metadata["extracted"] == {"invoice_number": "123"}


@pytest.mark.asyncio
async def test_extraction_handles_malformed_json_without_charging(db, test_user):
    give_balance(db, test_user, Decimal("1000"))
    fake_llm = FakeLlmClient(response="Sorry, I can't do that.")  # not JSON at all

    service = DataExtractionService(fake_llm)
    job = await service.process_upload(db, test_user, "invoice.txt", b"Invoice #123", ["invoice_number"])

    assert job.status == JobStatus.failed
    assert "did not return valid JSON" in job.error_message
    assert job.billed_amount == Decimal("0.00")

    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("1000.00")  # unchanged


@pytest.mark.asyncio
async def test_extraction_failure_does_not_charge_wallet(db, test_user):
    give_balance(db, test_user, Decimal("1000"))
    service = DataExtractionService(FailingLlmClient())

    job = await service.process_upload(db, test_user, "invoice.txt", b"Invoice #123", ["invoice_number"])

    assert job.status == JobStatus.failed
    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("1000.00")
