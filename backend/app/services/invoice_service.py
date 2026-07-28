"""
Payment History > Download invoice PDF: company logo, client details,
every transaction date/time-wise, running totals.
"""
import io
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.company import CompanyProfile
from app.models.transaction import Transaction
from app.models.user import User


def build_invoice_pdf(
    company: CompanyProfile | None, user: User, transactions: Iterable[Transaction]
) -> bytes:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("InvoiceTitle", parent=styles["Heading1"], fontSize=20, spaceAfter=2)
    sub_style = ParagraphStyle("InvoiceSub", parent=styles["Normal"], textColor=colors.HexColor("#555555"))
    label_style = ParagraphStyle("InvoiceLabel", parent=styles["Normal"], fontSize=10, leading=14)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=0.6 * inch, bottomMargin=0.6 * inch, leftMargin=0.6 * inch, rightMargin=0.6 * inch,
    )
    story = []

    company_name = company.name if company else "Lexora"
    header_left = Paragraph(company_name, title_style)
    if company and company.logo_url:
        try:
            header_left = Image(company.logo_url, width=1.3 * inch, height=1.3 * inch, kind="proportional")
        except Exception:  # noqa: BLE001 - fall back to text if the logo can't be loaded
            pass

    header_table = Table(
        [[header_left, Paragraph("INVOICE", ParagraphStyle("Right", parent=title_style, alignment=TA_RIGHT))]],
        colWidths=[3.5 * inch, 3.3 * inch],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story += [header_table, Spacer(1, 4), Paragraph(company_name, sub_style), Spacer(1, 18)]

    story += [
        Paragraph(f"<b>Bill To:</b> {user.full_name}", label_style),
        Paragraph(f"<b>Mobile:</b> {user.mobile or '-'}", label_style),
        Paragraph(f"<b>Email:</b> {user.email}", label_style),
        Spacer(1, 18),
    ]

    rows = [["Date & Time", "Type", "Description", "Credit", "Debit", "Status"]]
    total_credit = total_debit = 0
    for t in sorted(transactions, key=lambda t: t.created_at):
        total_credit += t.credit
        total_debit += t.debit
        rows.append([
            t.created_at.strftime("%Y-%m-%d %H:%M"),
            t.type.value.replace("_", " ").title(),
            Paragraph(t.description, label_style),
            f"{t.credit:,.2f}" if t.credit else "",
            f"{t.debit:,.2f}" if t.debit else "",
            t.status.value.title(),
        ])
    if len(rows) == 1:
        rows.append(["No transactions yet.", "", "", "", "", ""])

    table = Table(rows, colWidths=[1.2 * inch, 1.0 * inch, 2.0 * inch, 0.8 * inch, 0.8 * inch, 0.9 * inch], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0b1330")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7fb")]),
        ("ALIGN", (3, 0), (4, -1), "RIGHT"),
    ]))
    story += [table, Spacer(1, 14), Paragraph(
        f"<b>Total Credit:</b> {total_credit:,.2f} &nbsp;&nbsp; "
        f"<b>Total Debit:</b> {total_debit:,.2f} &nbsp;&nbsp; "
        f"<b>Net Balance:</b> {(total_credit - total_debit):,.2f}",
        label_style,
    )]

    doc.build(story)
    return buf.getvalue()
