import io

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.core.pdf_utils import PdfRenderError, render_pdf_pages


def _make_pdf(num_pages: int) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for i in range(num_pages):
        c.drawString(100, 750, f"Page {i + 1} content")
        c.showPage()
    c.save()
    return buf.getvalue()


def test_renders_one_page_per_pdf_page():
    pdf_bytes = _make_pdf(3)
    pages = render_pdf_pages(pdf_bytes)
    assert len(pages) == 3
    assert [p.page_number for p in pages] == [1, 2, 3]


def test_rendered_pages_are_valid_png():
    pdf_bytes = _make_pdf(1)
    pages = render_pdf_pages(pdf_bytes)
    assert pages[0].png_bytes[:8] == b"\x89PNG\r\n\x1a\n"
    assert pages[0].width > 0 and pages[0].height > 0


def test_higher_dpi_produces_larger_images():
    pdf_bytes = _make_pdf(1)
    low = render_pdf_pages(pdf_bytes, dpi=72)
    high = render_pdf_pages(pdf_bytes, dpi=300)
    assert high[0].width > low[0].width
    assert high[0].height > low[0].height


def test_rejects_non_pdf_bytes():
    with pytest.raises(PdfRenderError):
        render_pdf_pages(b"this is not a pdf file at all")


def test_rejects_pdf_exceeding_max_pages():
    pdf_bytes = _make_pdf(5)
    with pytest.raises(PdfRenderError, match="limit"):
        render_pdf_pages(pdf_bytes, max_pages=3)
