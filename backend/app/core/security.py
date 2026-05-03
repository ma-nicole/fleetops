from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models.entities import User, UserRole

try:
    from clerk_sdk import Clerk
    CLERK_AVAILABLE = True
except ImportError:
    CLERK_AVAILABLE = False


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
http_bearer = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or not hashed_password.strip():
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (UnknownHashError, ValueError, TypeError):
        # Truncated DB value, plain-text legacy row, or non-bcrypt hash — treat as mismatch
        return False


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def verify_clerk_token(token: str) -> dict | None:
    """Verify Clerk JWT token and return user data."""
    if not CLERK_AVAILABLE or not settings.clerk_api_key:
        return None

    try:
        clerk = Clerk(api_key=settings.clerk_api_key)
        # Decode and verify token with Clerk
        user = clerk.decode_token(token)
        return user
    except Exception:
        return None


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Get current user from JWT token (local auth)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        email: str | None = payload.get("sub")
    except JWTError as exc:
        raise credentials_exception from exc

    if email is None:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_user_clerk(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db)
) -> User:
    """Get current user from Clerk JWT token."""
    token = credentials.credentials
    clerk_user = verify_clerk_token(token)

    if not clerk_user:
        raise HTTPException(status_code=401, detail="Invalid Clerk token")

    clerk_user_id = clerk_user.get("sub") or clerk_user.get("user_id")
    user = db.query(User).filter(User.clerk_id == clerk_user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found in database")

    return user


def get_current_user_auth(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(lambda: None)
) -> User:
    """Route to appropriate auth method based on configuration."""
    if settings.use_clerk_auth and credentials:
        return get_current_user_clerk(credentials, db)

    # Fall back to OAuth2 for local development
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    return get_current_user(token, db)


def require_roles(*allowed_roles: UserRole):
    def role_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return user

    return role_dependency

