"""
PDF -> page images.

The one piece of infrastructure OCR and lease abstraction both need
that BAI2/translation/data-extraction didn't: turning a PDF into a
list of page images so each page can go to a vision-capable LLM call.
Uses PyMuPDF (fitz) rather than pdf2image/poppler - it's a pure Python
wheel with no system-level `poppler-utils` dependency to install
alongside it, which matters for keeping the Docker image simple.
"""
from __future__ import annotations

import dataclasses

import fitz  # PyMuPDF


class PdfRenderError(Exception):
    pass


@dataclasses.dataclass
class RenderedPage:
    page_number: int  # 1-indexed, matches how a human would refer to "page 3"
    png_bytes: bytes
    width: int
    height: int


def render_pdf_pages(pdf_bytes: bytes, dpi: int = 150, max_pages: int = 50) -> list[RenderedPage]:
    """Render every page of a PDF to a PNG image.

    `dpi=150` is the usual sweet spot for vision-model OCR accuracy vs.
    request payload size - high enough to read normal body text
    reliably, without ballooning image size the way 300+ DPI would.

    `max_pages` guards against a user uploading a huge PDF and
    generating an enormous, expensive request - 50 pages is generous
    for the lease/OCR documents this is aimed at; callers that need to
    process something larger should paginate explicitly rather than
    raising this silently.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as err:  # noqa: BLE001 - PyMuPDF raises its own exception types
        raise PdfRenderError(f"Could not open file as a PDF: {err}") from err

    if doc.page_count == 0:
        doc.close()
        raise PdfRenderError("This PDF has no pages.")
    if doc.page_count > max_pages:
        page_count = doc.page_count  # capture before closing - doc.page_count is unreadable after close()
        doc.close()
        raise PdfRenderError(
            f"This PDF has {page_count} pages; the limit for a single upload is {max_pages}."
        )

    zoom = dpi / 72  # PDF's native unit is 72 DPI
    matrix = fitz.Matrix(zoom, zoom)

    pages: list[RenderedPage] = []
    for index in range(doc.page_count):
        page = doc.load_page(index)
        pixmap = page.get_pixmap(matrix=matrix)
        pages.append(RenderedPage(
            page_number=index + 1,
            png_bytes=pixmap.tobytes("png"),
            width=pixmap.width,
            height=pixmap.height,
        ))
    doc.close()
    return pages
