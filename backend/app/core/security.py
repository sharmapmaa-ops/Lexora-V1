"""
Password hashing + JWT issuing/verification.

Nothing else in the app should call jwt.encode/decode or a hashing
function directly - route through here so there is exactly one place
that knows the signing algorithm, the claim shape, and the hashing
scheme. Rotating the secret or hash algorithm later means touching one
file, not grepping the whole codebase.

Password hashing uses the `bcrypt` library directly rather than
`passlib`: passlib has been effectively unmaintained since 2020 and its
bcrypt backend actively breaks on bcrypt>=4.1 (it probes
`bcrypt.__about__.__version__`, which the bcrypt maintainers removed).
`bcrypt` itself is small, current, and is what passlib wraps anyway -
there's no real benefit to the extra layer here.
"""
import datetime
import uuid
from typing import Literal

import bcrypt
import jwt

from app.core.config import settings

# bcrypt has a hard 72-byte input limit; encode explicitly so we can
# truncate deliberately (and identically on hash + verify) instead of
# letting a long password silently behave differently across calls.
_BCRYPT_MAX_BYTES = 72


def _prepare(plain: str) -> bytes:
    return plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(plain: str) -> str:
    hashed = bcrypt.hashpw(_prepare(plain), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prepare(plain), hashed.encode("utf-8"))
    except ValueError:
        # Malformed/legacy hash in the DB - treat as "does not match"
        # rather than raising 500s out of a login attempt.
        return False


TokenType = Literal["access", "refresh"]


def create_token(user_id: str, role: str, token_type: TokenType) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    if token_type == "access":
        expires_delta = datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    else:
        expires_delta = datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
        "sub": user_id,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),  # unique per token - lets us blacklist a specific token if ever needed
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


class TokenError(Exception):
    pass


def decode_token(token: str, expected_type: TokenType = "access") -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as err:
        raise TokenError("Token has expired.") from err
    except jwt.InvalidTokenError as err:
        raise TokenError("Token is invalid.") from err

    if payload.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token.")
    return payload
