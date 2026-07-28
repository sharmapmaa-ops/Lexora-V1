import io
from decimal import Decimal

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.models.processing_job import JobStatus
from app.services.billing_service import get_wallet_balance
from app.services.processing.ocr_service import OcrService
from tests.conftest import FailingLlmClient, FakeLlmClient, give_balance


def _make_pdf(num_pages: int) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for i in range(num_pages):
        c.drawString(100, 750, f"Page {i + 1} content")
        c.showPage()
    c.save()
    return buf.getvalue()


@pytest.mark.asyncio
async def test_ocr_rejects_when_wallet_insufficient_for_all_pages(db, test_user):
    pdf_bytes = _make_pdf(3)
    service = OcrService(FakeLlmClient())
    with pytest.raises(Exception) as exc_info:
        await service.process_upload(db, test_user, "scan.pdf", pdf_bytes)
    assert "402" in str(exc_info.value) or "wallet" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_ocr_bills_per_page_not_flat_rate(db, test_user):
    give_balance(db, test_user, Decimal("5000"))
    pdf_bytes = _make_pdf(3)
    fake_llm = FakeLlmClient(response="transcribed text")

    service = OcrService(fake_llm)
    job = await service.process_upload(db, test_user, "scan.pdf", pdf_bytes)

    assert job.status == JobStatus.completed
    assert job.page_count == 3
    # Free plan's OCR rate is 400/page (same rate as translation) - 3
    # pages should bill 3x that, not a flat one-page charge.
    assert job.billed_amount == Decimal("1200.00")
    assert fake_llm.image_call_count == 3  # one vision call per page, not one for the whole doc

    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("3800.00")


@pytest.mark.asyncio
async def test_ocr_stores_per_page_text_in_order(db, test_user):
    give_balance(db, test_user, Decimal("5000"))
    pdf_bytes = _make_pdf(2)

    class SequentialFakeLlm(FakeLlmClient):
        async def complete_with_image(self, system_prompt, user_prompt, image_png):
            self.image_call_count += 1
            return f"text for {user_prompt}"

    service = OcrService(SequentialFakeLlm())
    job = await service.process_upload(db, test_user, "scan.pdf", pdf_bytes)

    pages = job.result_metadata["pages"]
    assert pages[0]["page_number"] == 1
    assert pages[1]["page_number"] == 2
    assert "page 1" in pages[0]["text"]
    assert "page 2" in pages[1]["text"]


@pytest.mark.asyncio
async def test_ocr_rejects_non_pdf_upload(db, test_user):
    service = OcrService(FakeLlmClient())
    with pytest.raises(Exception) as exc_info:
        await service.process_upload(db, test_user, "not-a-pdf.txt", b"just some text")
    assert "400" in str(exc_info.value) or "PDF" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ocr_failure_does_not_charge_wallet(db, test_user):
    give_balance(db, test_user, Decimal("5000"))
    pdf_bytes = _make_pdf(2)
    service = OcrService(FailingLlmClient())

    job = await service.process_upload(db, test_user, "scan.pdf", pdf_bytes)

    assert job.status == JobStatus.failed
    balance = get_wallet_balance(db, test_user.id)
    assert balance == Decimal("5000.00")
