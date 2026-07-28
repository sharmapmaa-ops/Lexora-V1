"""
OTP generation and verification.

Both password-reset codes and mobile-verification codes are "a 6-digit
code, valid for a few minutes, single-use" - the same primitive, so
they share one implementation (and one table, `EmailVerificationToken`)
distinguished only by `purpose`, rather than two near-identical code
paths.
"""
import datetime
import hashlib
import secrets

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import EmailVerificationToken

OTP_TTL_MINUTES = 10


def _hash_code(code: str) -> str:
    # A 6-digit numeric code has far less entropy than a password - a
    # plain SHA-256 hash (no per-user salt needed beyond the row itself
    # being scoped to one user_id+purpose) is enough to avoid storing
    # it in plaintext, without the deliberately-slow cost of bcrypt
    # being necessary for something this short-lived and single-use.
    return hashlib.sha256(code.encode()).hexdigest()


def generate_otp(db: Session, user_id, purpose: str) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.datetime.now(datetime.timezone.utc)
    db.add(EmailVerificationToken(
        user_id=user_id,
        purpose=purpose,
        code_hash=_hash_code(code),
        expires_at=now + datetime.timedelta(minutes=OTP_TTL_MINUTES),
        created_at=now,
    ))
    db.commit()
    return code


def verify_otp(db: Session, user_id, purpose: str, code: str) -> None:
    """Raises HTTPException on any failure - wrong code, expired,
    already used, or none exists. Marks the token consumed on success."""
    token = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.purpose == purpose,
            EmailVerificationToken.consumed_at.is_(None),
        )
        .order_by(EmailVerificationToken.created_at.desc())
        .first()
    )
    if token is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No pending verification code - request a new one.")

    now = datetime.datetime.now(datetime.timezone.utc)
    if token.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This code has expired - request a new one.")
    if not secrets.compare_digest(token.code_hash, _hash_code(code)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect code.")

    token.consumed_at = now
    db.commit()
