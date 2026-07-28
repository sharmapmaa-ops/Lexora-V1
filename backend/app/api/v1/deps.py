"""
Shared request dependencies.

Every route that needs a DB session or the current authenticated user
depends on functions from this module - never on app.core.database or
app.core.security directly. That keeps "how do I get a session" /
"how do I know who's logged in" answerable in exactly one place.
"""
from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import TokenError, decode_token
from app.models.user import User, UserRole

_bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except TokenError as err:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(err)) from err

    user = db.get(User, payload["sub"])
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists.")
    if user.is_locked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been locked.")
    return user


def require_roles(*roles: UserRole):
    """Usage: `Depends(require_roles(UserRole.admin, UserRole.developer))`.
    A plain function (not a class) so route signatures stay readable -
    `current_user: User = Depends(require_roles(UserRole.admin))`."""

    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"This action requires one of: {', '.join(r.value for r in roles)}.",
            )
        return user

    return _check
