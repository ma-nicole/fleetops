from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.models.entities import User, UserRole
from app.schemas.auth import Token, UserCreate, UserRead


router = APIRouter(prefix="/auth", tags=["auth"])

MAX_LOGIN_ATTEMPTS = 5  # paper UAT: 5-try lockout
LOCKOUT_MINUTES = 15


@router.post("/register", response_model=UserRead)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Public self-registration. Always creates a customer account.

    Internal staff roles (driver, helper, dispatcher, manager, admin) must be
    created by an administrator through POST /admin/users.
    """
    if payload.role and payload.role != UserRole.CUSTOMER:
        raise HTTPException(
            status_code=403,
            detail=(
                "Only customer accounts can be self-registered. "
                "Staff accounts must be created by an administrator."
            ),
        )

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.CUSTOMER,
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email_key = (form_data.username or "").strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email_key).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.locked_until and user.locked_until > datetime.utcnow():
        delta = user.locked_until - datetime.utcnow()
        raise HTTPException(
            status_code=423,
            detail=f"Account locked. Try again in {int(delta.total_seconds() // 60) + 1} minutes",
        )

    if not verify_password(form_data.password, user.password_hash or ""):
        user.failed_login_count = (user.failed_login_count or 0) + 1
        if user.failed_login_count >= MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
            user.failed_login_count = 0
            db.commit()
            raise HTTPException(
                status_code=423,
                detail=f"Too many failed attempts. Account locked for {LOCKOUT_MINUTES} minutes.",
            )
        db.commit()
        remaining = MAX_LOGIN_ATTEMPTS - user.failed_login_count
        raise HTTPException(
            status_code=401,
            detail=f"Invalid credentials. {remaining} attempt(s) before lockout.",
        )

    user.failed_login_count = 0
    user.locked_until = None
    db.commit()

    token = create_access_token(subject=user.email, role=user.role.value)
    return Token(access_token=token, role=user.role.value)


@router.post("/logout")
def logout(user: User = Depends(get_current_user)):
    """Stateless JWT logout — clients should drop the token."""
    return {"message": "logged out", "user_id": user.id}


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user
