from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.core.security import TokenError, create_token, decode_token
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenPair, UserPublic
from app.services.auth_service import authenticate, issue_tokens, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    user = register_user(db, payload)
    return user


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate(db, payload)
    return issue_tokens(user)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except TokenError as err:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(err)) from err

    user = db.get(User, claims["sub"])
    if user is None or user.is_locked:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is no longer accessible.")
    return TokenPair(
        access_token=create_token(str(user.id), user.role.value, "access"),
        refresh_token=payload.refresh_token,
    )


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)):
    return current_user
