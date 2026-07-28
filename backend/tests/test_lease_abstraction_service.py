import io
from decimal import Decimal

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.core.llm import LlmClient
from app.models.processing_job import JobStatus
from app.services.billing_service import get_wallet_balance
from app.services.processing.lease_abstraction_service import LeaseAbstractionService
from tests.conftest import give_balance


def _make_pdf(num_pages: int) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for i in range(num_pages):
        c.drawString(100, 750, f"Lease page {i + 1}")
        c.showPage()
    c.save()
    return buf.getvalue()


class TwoStageFakeLlm(LlmClient):
    """Returns different canned responses for the vision stage (OCR)
    vs. the text stage (field extraction) - needed because
    LeaseAbstractionService genuinely calls both in sequence and a
    single-response fake (like FakeLlmClient) can't distinguish them."""

    def __init__(self, extraction_json: str):
        self.extraction_json = extraction_json
        self.image_call_count = 0
        self.text_call_count = 0
        self.last_text_prompt: str | None = None

    async def complete_with_image(self, system_prompt, user_prompt, image_png) -> str:
        self.image_call_count += 1
        return f"OCR text from {user_prompt}"

    async def complete(self, system_prompt, user_prompt) -> str:
        self.text_call_count += 1
        self.last_text_prompt = user_prompt
        return self.extraction_json


class FailingAtOcrStage(LlmClient):
    async def complete_with_image(self, system_prompt, user_prompt, image_png) -> str:
        raise RuntimeError("Vision model unavailable")

    async def complete(self, system_prompt, user_prompt) -> str:
        raise AssertionError("Should never reach the extraction stage if OCR failed")


class FailingAtExtractionStage(LlmClient):
    async def complete_with_image(self, system_prompt, user_prompt, image_png) -> str:
        return "some ocr text"

    async def complete(self, system_prompt, user_prompt) -> str:
        raise RuntimeError("Extraction model unavailable")


@pytest.mark.asyncio
async def test_lease_abstraction_rejects_when_wallet_insufficient(db, test_user):
    pdf_bytes = _make_pdf(2)
    service = LeaseAbstractionService(TwoStageFakeLlm('{"landlord_name": "Acme"}'))
    with pytest.raises(Exception) as exc_info:
        await service.process_upload(db, test_user, "lease.pdf", pdf_bytes)
    assert "402" in str(exc_info.value) or "wallet" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_lease_abstraction_bills_flat_per_document_not_per_page(db, test_user):
    give_balance(db, test_user, Decimal("2000"))
    pdf_bytes = _make_pdf(4)  # 4 pages - if billed per-page like OCR, this would be 4x
    fake_llm = TwoStageFakeLlm('{"landlord_name": "Acme Corp", "base_rent": "5000"}')

    service = LeaseAbstractionService(fake_llm)
    job = await service.process_upload(db, test_user, "lease.pdf", pdf_bytes)

    assert job.status == JobStatus.completed
    assert job.page_count == 4
    # Free plan's lease_abstraction rate is a flat 800/document -
    # regardless of the 4 pages, not 4x anything.
    assert job.billed_amount == Decimal("800.00")
    assert fake_llm.image_call_count == 4  # one OCR call per page...
    assert fake_llm.text_call_count == 1   # ...but exactly one extraction call for the whole document

    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("1200.00")


@pytest.mark.asyncio
async def test_lease_abstraction_extraction_stage_receives_combined_ocr_text(db, test_user):
    give_balance(db, test_user, Decimal("2000"))
    pdf_bytes = _make_pdf(2)
    fake_llm = TwoStageFakeLlm('{"landlord_name": "Acme"}')

    service = LeaseAbstractionService(fake_llm)
    await service.process_upload(db, test_user, "lease.pdf", pdf_bytes)

    # The extraction stage's prompt should contain both pages' OCR output.
    assert "page 1" in fake_llm.last_text_prompt.lower()
    assert "page 2" in fake_llm.last_text_prompt.lower()


@pytest.mark.asyncio
async def test_lease_abstraction_stores_extracted_fields(db, test_user):
    give_balance(db, test_user, Decimal("2000"))
    pdf_bytes = _make_pdf(1)
    fake_llm = TwoStageFakeLlm('{"landlord_name": "Acme Corp", "tenant_name": "Beta LLC"}')

    service = LeaseAbstractionService(fake_llm)
    job = await service.process_upload(db, test_user, "lease.pdf", pdf_bytes)

    assert job.result_metadata["extracted"]["landlord_name"] == "Acme Corp"
    assert job.result_metadata["extracted"]["tenant_name"] == "Beta LLC"


@pytest.mark.asyncio
async def test_lease_abstraction_ocr_failure_charges_nothing(db, test_user):
    give_balance(db, test_user, Decimal("2000"))
    pdf_bytes = _make_pdf(1)
    service = LeaseAbstractionService(FailingAtOcrStage())

    job = await service.process_upload(db, test_user, "lease.pdf", pdf_bytes)

    assert job.status == JobStatus.failed
    assert "Vision model unavailable" in job.error_message
    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("2000.00")


@pytest.mark.asyncio
async def test_lease_abstraction_extraction_failure_charges_nothing(db, test_user):
    give_balance(db, test_user, Decimal("2000"))
    pdf_bytes = _make_pdf(1)
    service = LeaseAbstractionService(FailingAtExtractionStage())

    job = await service.process_upload(db, test_user, "lease.pdf", pdf_bytes)

    assert job.status == JobStatus.failed
    assert "Extraction model unavailable" in job.error_message
    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("2000.00")
