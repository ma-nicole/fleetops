import base64
import hashlib
import hmac
import json
from secrets import compare_digest
from time import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models.entities import User, UserRole
from app.schemas.auth import UserRead


router = APIRouter(prefix="/clerk", tags=["clerk"])


@router.post("/webhook")
async def clerk_webhook(
    request: Request,
    svix_id: str | None = Header(default=None, alias="svix-id"),
    svix_timestamp: str | None = Header(default=None, alias="svix-timestamp"),
    svix_signature: str | None = Header(default=None, alias="svix-signature"),
    db: Session = Depends(get_db),
):
    """
    Clerk webhook handler for user creation/update/deletion events.
    Validates webhook signature and syncs user data with database.
    """
    if not settings.clerk_webhook_secret:
        raise HTTPException(status_code=503, detail="Clerk webhook secret is not configured.")
    if not svix_id or not svix_timestamp or not svix_signature:
        raise HTTPException(status_code=401, detail="Missing webhook signature headers.")
    try:
        ts = int(svix_timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid webhook timestamp.") from exc
    if abs(int(time()) - ts) > 300:
        raise HTTPException(status_code=401, detail="Webhook timestamp is outside allowed window.")

    raw_body = await request.body()
    payload_to_sign = f"{svix_id}.{svix_timestamp}.{raw_body.decode('utf-8')}".encode("utf-8")
    secret = settings.clerk_webhook_secret.strip()
    if secret.startswith("whsec_"):
        secret = secret[6:]
    try:
        secret_bytes = base64.b64decode(secret)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Invalid Clerk webhook secret format.") from exc

    expected = base64.b64encode(
        hmac.new(secret_bytes, payload_to_sign, hashlib.sha256).digest()
    ).decode("utf-8")
    signatures = [part.strip() for part in svix_signature.split(" ")]
    valid = any(
        sig.startswith("v1,") and compare_digest(sig[3:], expected)
        for sig in signatures
    )
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    try:
        request_body = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload JSON.") from exc

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
