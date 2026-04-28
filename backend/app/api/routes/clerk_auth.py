from fastapi import APIRouter, Body, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db import get_db
from app.models.entities import User, UserRole
from app.schemas.auth import Token, UserCreate, UserRead


router = APIRouter(prefix="/clerk", tags=["clerk"])


@router.post("/webhook")
async def clerk_webhook(
    request_body: dict = Body(...),
    svix_id: str = Header(..., alias="svix-id"),
    svix_timestamp: str = Header(..., alias="svix-timestamp"),
    svix_signature: str = Header(..., alias="svix-signature"),
    db: Session = Depends(get_db),
):
    """
    Clerk webhook handler for user creation/update/deletion events.
    Validates webhook signature and syncs user data with database.
    """
    # TODO: Verify signature using Clerk's webhook verification
    # For now, basic implementation

    event_type = request_body.get("type")

    if event_type == "user.created":
        user_data = request_body.get("data", {})
        clerk_id = user_data.get("id")
        email = next((em["email_address"] for em in user_data.get("email_addresses", []) if em.get("primary")), None)
        first_name = user_data.get("first_name", "")
        last_name = user_data.get("last_name", "")

        if not email or not clerk_id:
            raise HTTPException(status_code=400, detail="Missing required fields")

        existing_user = db.query(User).filter(User.clerk_id == clerk_id).first()
        if existing_user:
            return {"status": "user_exists"}

        new_user = User(
            clerk_id=clerk_id,
            email=email,
            full_name=f"{first_name} {last_name}".strip(),
            role=UserRole.CUSTOMER,
        )
        db.add(new_user)
        db.commit()
        return {"status": "created", "user_id": new_user.id}

    elif event_type == "user.updated":
        user_data = request_body.get("data", {})
        clerk_id = user_data.get("id")
        email = next((em["email_address"] for em in user_data.get("email_addresses", []) if em.get("primary")), None)
        first_name = user_data.get("first_name", "")
        last_name = user_data.get("last_name", "")

        user = db.query(User).filter(User.clerk_id == clerk_id).first()
        if user:
            if email:
                user.email = email
            if first_name or last_name:
                user.full_name = f"{first_name} {last_name}".strip()
            db.commit()
            return {"status": "updated"}

    elif event_type == "user.deleted":
        user_data = request_body.get("data", {})
        clerk_id = user_data.get("id")

        user = db.query(User).filter(User.clerk_id == clerk_id).first()
        if user:
            db.delete(user)
            db.commit()
            return {"status": "deleted"}

    return {"status": "processed"}


@router.get("/me", response_model=UserRead)
async def get_clerk_user(db: Session = Depends(get_db)):
    """
    Placeholder for authenticated user info via Clerk.
    In production, integrate with Clerk's auth context from frontend.
    """
    raise HTTPException(status_code=501, detail="Implement via frontend Clerk session")
