from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.core.email import send_email
from app.core.security import TokenError, create_token, decode_token, hash_password
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenPair,
    UserPublic,
)
from app.services.auth_service import authenticate, issue_tokens, register_user
from app.services.otp_service import generate_otp, verify_otp

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


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    # Always return the same response whether or not the email exists -
    # confirming/denying account existence here would let an attacker
    # enumerate registered emails.
    if user is not None:
        code = generate_otp(db, user.id, "password_reset")
        send_email(
            user.email,
            "Reset your Lexora password",
            f"Your password reset code is: {code}\n\nThis code expires in 10 minutes. "
            "If you didn't request this, you can safely ignore this email.",
        )
    return {"message": "If an account with that email exists, a reset code has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None:
        # Same generic error as an incorrect code - never confirms
        # whether the email exists.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect code.")
    verify_otp(db, user.id, "password_reset", payload.code)
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password has been reset. You can now log in with your new password."}
