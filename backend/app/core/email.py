"""
Email sending.

One function, used by every flow that needs to email a user (password
reset codes, future signup verification, etc.) - keeps SMTP connection
handling and error behavior in one place rather than duplicated per
call site.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def send_email(to_email: str, subject: str, body_text: str) -> bool:
    """Returns True if the email was sent, False if SMTP isn't
    configured (logs the message instead, so local dev and any
    environment without SMTP credentials set still work - just
    without exercising real delivery, and the caller can act on the
    boolean instead of silently pretending to send). Raises only on a
    genuine unexpected error - a missing config is not that."""
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD or not settings.SMTP_SENDER_EMAIL:
        print(f"[email] SMTP not configured - would have sent to {to_email}: {subject}\n{body_text}")
        return False

    msg = MIMEMultipart()
    msg["From"] = settings.SMTP_SENDER_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body_text, "plain"))

    if settings.SMTP_USE_TLS:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
    return True
