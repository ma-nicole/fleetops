import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import CustomerSavedSite, User, UserRole

router = APIRouter(prefix="/customer", tags=["customer"])

_SITE_ADDRESS_HINT = re.compile(
    r"\b(brgy|barangay|district|village|street|st\.?|road|rd\.?|highway|hwy|avenue|ave|boulevard|blvd|sitio|purok|subd"
    r"|subdivision|industrial|zone|city|province|philippines|metro|ncr|region|calabarzon)\b",
    re.IGNORECASE,
)
_CUSTOMER_SITE_ADDRESS_MIN_CHARS = 42
_CUSTOMER_SITE_ADDRESS_MIN_WORDS = 6


def _validate_saved_site_address(address: str) -> str | None:
    """Return human-readable error, or None if OK."""
    t = address.strip()
    if not t:
        return "Site address is required."
    if len(t) < _CUSTOMER_SITE_ADDRESS_MIN_CHARS:
        return (
            f"Use a complete address (at least {_CUSTOMER_SITE_ADDRESS_MIN_CHARS} characters): "
            "building/street, district or village, city or municipality, province, "
            "and zip code or Philippines."
        )
    words = [w for w in t.split() if w]
    if len(words) < _CUSTOMER_SITE_ADDRESS_MIN_WORDS:
        return (
            f"Include more address parts (at least {_CUSTOMER_SITE_ADDRESS_MIN_WORDS} words), "
            "for example street, district, city, and province."
        )
    has_digit = any(ch.isdigit() for ch in t)
    has_comma = "," in t
    has_hint = bool(_SITE_ADDRESS_HINT.search(t))
    if not (has_digit or has_comma or has_hint):
        return (
            "Add a street line, use commas between parts, or include district, "
            "city, province (or Philippines)."
        )
    return None


def _compose_structured_address(
    street: str,
    barangay: str,
    city_municipality: str,
    province: str,
    postal_code: str,
) -> str:
    last = f"{province.strip()} {postal_code.strip()}".strip()
    return (
        f"{street.strip()}, {barangay.strip()}, {city_municipality.strip()}, "
        f"{last}, Philippines"
    )


def _normalize_saved_site_create(
    payload: "SavedSiteCreate",
) -> tuple[str, tuple[str | None, str | None, str | None, str | None, str | None]]:
    """
    Returns (full_address, (street, barangay, city_municipality, province, postal_code)).
    Either send `address` alone (legacy / migration) OR all structured fields.
    """
    addr = (payload.address or "").strip()
    st = (payload.street or "").strip() or None
    bg = (payload.barangay or "").strip() or None
    cm = (payload.city_municipality or "").strip() or None
    pv = (payload.province or "").strip() or None
    zc = (payload.postal_code or "").strip() or None

    has_structured = bool(st and bg and cm and pv and zc)
    legacy = bool(addr)

    if legacy and has_structured:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Send either a single full address OR structured street/barangay fields, not both.",
        )

    if legacy:
        err = _validate_saved_site_address(addr)
        if err:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
        return addr, (None, None, None, None, None)

    if not has_structured:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Fill in street, district or village, city or municipality, province, and zip code.",
        )

    if len(st) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Street needs at least 5 characters (building no. / street name).",
        )
    if len(bg) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="District or village segment is too short.",
        )
    if len(cm) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="City / municipality needs at least 3 characters.",
        )
    if len(pv) < 3:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Province is too short.")
    if len(zc) < 4 or not any(ch.isdigit() for ch in zc):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Zip code must be at least 4 characters and include digits.",
        )

    full = _compose_structured_address(st, bg, cm, pv, zc)
    err = _validate_saved_site_address(full)
    if err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    return full, (st, bg, cm, pv, zc)


class SavedSiteCreate(BaseModel):
    """Create with structured fields, or `address` only for legacy import."""

    label: str | None = Field(None, max_length=255)
    street: str | None = Field(None, max_length=2000)
    barangay: str | None = Field(None, max_length=500)
    city_municipality: str | None = Field(None, max_length=500)
    province: str | None = Field(None, max_length=500)
    postal_code: str | None = Field(None, max_length=64)
    address: str | None = Field(None, max_length=4000)

    @field_validator(
        "street",
        "barangay",
        "city_municipality",
        "province",
        "postal_code",
        "address",
        mode="before",
    )
    @classmethod
    def strip_addr_parts(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v

    @field_validator("label", mode="before")
    @classmethod
    def strip_label(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v


class SavedSiteRead(BaseModel):
    id: int
    address: str
    label: str | None
    street: str | None = None
    barangay: str | None = None
    city_municipality: str | None = None
    province: str | None = None
    postal_code: str | None = None

    model_config = {"from_attributes": True}


@router.get("/sites", response_model=list[SavedSiteRead])
def list_customer_sites(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    rows = (
        db.query(CustomerSavedSite)
        .filter(CustomerSavedSite.customer_id == user.id)
        .order_by(CustomerSavedSite.id.asc())
        .all()
    )
    return rows


@router.post("/sites", response_model=SavedSiteRead)
def create_customer_site(
    payload: SavedSiteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    full, parts = _normalize_saved_site_create(payload)
    st, bg, cm, pv, zc = parts
    row = CustomerSavedSite(
        customer_id=user.id,
        address=full,
        label=payload.label,
        street=st,
        barangay=bg,
        city_municipality=cm,
        province=pv,
        postal_code=zc,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/sites/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer_site(
    site_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    row = (
        db.query(CustomerSavedSite)
        .filter(CustomerSavedSite.id == site_id, CustomerSavedSite.customer_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Site not found")
    db.delete(row)
    db.commit()
    return None
