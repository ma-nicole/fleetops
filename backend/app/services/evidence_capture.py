"""Operational evidence capture — GPS validation, verification labels, and audit records."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Booking, EvidenceCaptureRecord, Trip, TripLocationUpdate, TripStatusUpdate, User
from app.services.geocoding import geocode_coordinates

CAPTURE_SOURCE_CAMERA = "camera"
CAPTURE_SOURCE_GALLERY = "gallery"
CAPTURE_SOURCE_LIVE = "live_capture"

LABEL_CAMERA_VERIFIED = "Camera Verified"
LABEL_GALLERY_REVIEW = "Uploaded from Gallery"
LABEL_LOCATION_FLAGGED = "Location Flagged for Review"

DEFAULT_LOCATION_THRESHOLD_KM = 5.0
EN_ROUTE_LOCATION_THRESHOLD_KM = 25.0


@dataclass
class EvidenceFormInput:
    capture_source: str | None
    device_captured_at: datetime | None
    latitude: float | None
    longitude: float | None
    gps_accuracy_m: float | None
    uploader_name: str | None


@dataclass
class EvidenceEvaluation:
    capture_source: str
    verification_label: str
    review_required: bool
    latitude: float | None
    longitude: float | None
    gps_accuracy_m: float | None
    device_captured_at: datetime | None
    expected_latitude: float | None
    expected_longitude: float | None
    distance_from_expected_km: float | None
    location_flagged: bool


def _parse_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _parse_datetime(raw: str | None) -> datetime | None:
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def parse_evidence_form(
    *,
    capture_source: str = "",
    evidence_device_captured_at: str = "",
    evidence_latitude: str = "",
    evidence_longitude: str = "",
    evidence_gps_accuracy_m: str = "",
    evidence_uploader_name: str = "",
) -> EvidenceFormInput:
    src = (capture_source or "").strip().lower() or None
    return EvidenceFormInput(
        capture_source=src,
        device_captured_at=_parse_datetime(evidence_device_captured_at),
        latitude=_parse_float(evidence_latitude),
        longitude=_parse_float(evidence_longitude),
        gps_accuracy_m=_parse_float(evidence_gps_accuracy_m),
        uploader_name=(evidence_uploader_name or "").strip() or None,
    )


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def expected_coords_for_context(
    db: Session,
    booking: Booking | None,
    *,
    milestone_context: str | None,
) -> tuple[float | None, float | None]:
    if not booking:
        return None, None
    ctx = (milestone_context or "").strip().lower()
    if ctx in {"picked_up", "for_pickup", "loading"}:
        address = booking.pickup_location
    elif ctx in {"dropped_off", "completed", "delivery_document", "delivery_signature"}:
        address = booking.dropoff_location
    elif ctx == "en_route":
        plat, plon, _ = geocode_coordinates(booking.pickup_location or "", settings)
        dlat, dlon, _ = geocode_coordinates(booking.dropoff_location or "", settings)
        if plat is not None and plon is not None and dlat is not None and dlon is not None:
            return (plat + dlat) / 2, (plon + dlon) / 2
        address = booking.pickup_location
    else:
        address = booking.dropoff_location or booking.pickup_location
    lat, lon, _ = geocode_coordinates(address or "", settings)
    return lat, lon


def evaluate_evidence(
    form: EvidenceFormInput,
    *,
    expected_lat: float | None,
    expected_lon: float | None,
    threshold_km: float = DEFAULT_LOCATION_THRESHOLD_KM,
) -> EvidenceEvaluation:
    source = (form.capture_source or CAPTURE_SOURCE_GALLERY).lower()
    if source not in {CAPTURE_SOURCE_CAMERA, CAPTURE_SOURCE_GALLERY, CAPTURE_SOURCE_LIVE}:
        source = CAPTURE_SOURCE_GALLERY

    gallery = source == CAPTURE_SOURCE_GALLERY
    review_required = gallery
    label = LABEL_GALLERY_REVIEW if gallery else LABEL_CAMERA_VERIFIED

    distance_km: float | None = None
    location_flagged = False
    lat, lon = form.latitude, form.longitude

    if lat is not None and lon is not None and expected_lat is not None and expected_lon is not None:
        distance_km = round(haversine_km(lat, lon, expected_lat, expected_lon), 3)
        if distance_km > threshold_km:
            location_flagged = True
            review_required = True
            label = LABEL_LOCATION_FLAGGED
    elif lat is None and source in {CAPTURE_SOURCE_CAMERA, CAPTURE_SOURCE_LIVE}:
        review_required = True
        label = LABEL_GALLERY_REVIEW if gallery else "Camera Verified (no GPS)"

    return EvidenceEvaluation(
        capture_source=source,
        verification_label=label,
        review_required=review_required,
        latitude=lat,
        longitude=lon,
        gps_accuracy_m=form.gps_accuracy_m,
        device_captured_at=form.device_captured_at,
        expected_latitude=expected_lat,
        expected_longitude=expected_lon,
        distance_from_expected_km=distance_km,
        location_flagged=location_flagged,
    )


def threshold_for_context(milestone_context: str | None) -> float:
    ctx = (milestone_context or "").strip().lower()
    if ctx == "en_route":
        return EN_ROUTE_LOCATION_THRESHOLD_KM
    return DEFAULT_LOCATION_THRESHOLD_KM


def evaluate_trip_evidence(
    db: Session,
    booking: Booking | None,
    form: EvidenceFormInput,
    *,
    milestone_context: str | None,
) -> EvidenceEvaluation:
    exp_lat, exp_lon = expected_coords_for_context(db, booking, milestone_context=milestone_context)
    return evaluate_evidence(
        form,
        expected_lat=exp_lat,
        expected_lon=exp_lon,
        threshold_km=threshold_for_context(milestone_context),
    )


def apply_evidence_to_status_update(row: TripStatusUpdate, ev: EvidenceEvaluation) -> None:
    row.latitude = ev.latitude
    row.longitude = ev.longitude
    row.evidence_capture_source = ev.capture_source
    row.evidence_verification_label = ev.verification_label
    row.evidence_review_required = ev.review_required
    row.evidence_device_captured_at = ev.device_captured_at


def apply_evidence_to_location_update(row: TripLocationUpdate, ev: EvidenceEvaluation) -> None:
    row.latitude = ev.latitude
    row.longitude = ev.longitude
    row.evidence_capture_source = ev.capture_source
    row.evidence_verification_label = ev.verification_label
    row.evidence_review_required = ev.review_required
    row.evidence_device_captured_at = ev.device_captured_at


def record_evidence_capture(
    db: Session,
    *,
    upload_path: str,
    context_type: str,
    trip: Trip | None,
    booking: Booking | None,
    user: User,
    ev: EvidenceEvaluation,
    milestone_context: str | None = None,
) -> EvidenceCaptureRecord:
    uploader_name = user.full_name or user.email
    row = EvidenceCaptureRecord(
        upload_path=upload_path,
        context_type=context_type,
        booking_id=booking.id if booking else (trip.booking_id if trip else None),
        trip_id=trip.id if trip else None,
        uploaded_by_id=user.id,
        uploaded_by_name=uploader_name,
        capture_source=ev.capture_source,
        verification_label=ev.verification_label,
        review_required=ev.review_required,
        device_captured_at=ev.device_captured_at,
        latitude=ev.latitude,
        longitude=ev.longitude,
        gps_accuracy_m=ev.gps_accuracy_m,
        expected_latitude=ev.expected_latitude,
        expected_longitude=ev.expected_longitude,
        distance_from_expected_km=ev.distance_from_expected_km,
        location_flagged=ev.location_flagged,
        milestone_context=milestone_context,
    )
    db.add(row)
    return row


def evidence_fields_dict(ev: EvidenceEvaluation) -> dict[str, Any]:
    return {
        "evidence_capture_source": ev.capture_source,
        "evidence_verification_label": ev.verification_label,
        "evidence_review_required": ev.review_required,
        "evidence_latitude": ev.latitude,
        "evidence_longitude": ev.longitude,
        "evidence_device_captured_at": ev.device_captured_at.isoformat() if ev.device_captured_at else None,
        "evidence_distance_km": ev.distance_from_expected_km,
        "evidence_location_flagged": ev.location_flagged,
    }
