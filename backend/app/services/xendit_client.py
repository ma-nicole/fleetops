"""Minimal Xendit HTTP client for online booking payments."""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import settings

XENDIT_API_BASE = "https://api.xendit.co"


class XenditError(Exception):
    def __init__(self, message: str, status_code: int | None = None, error_code: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


def xendit_configured() -> bool:
    return bool((settings.xendit_secret_key or "").strip())


def _auth() -> tuple[str, str]:
    key = (settings.xendit_secret_key or "").strip()
    if not key:
        raise XenditError("Xendit secret key is not configured.")
    return key, ""


def _request(method: str, path: str, *, data: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{XENDIT_API_BASE}{path}"
    form: dict[str, Any] = {}
    if data:
        for key, value in data.items():
            if value is None:
                continue
            if isinstance(value, dict):
                form[key] = json.dumps(value)
            else:
                form[key] = value

    with httpx.Client(timeout=30.0) as client:
        response = client.request(method, url, data=form or None, auth=_auth())

    try:
        body = response.json()
    except ValueError:
        body = {"message": response.text}

    if response.status_code >= 400:
        message = body.get("message") or body.get("error_code") or "Xendit request failed"
        raise XenditError(str(message), status_code=response.status_code, error_code=body.get("error_code"))

    if not isinstance(body, dict):
        raise XenditError("Unexpected Xendit response format.")
    return body


def _json_request(method: str, path: str, *, json_data: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{XENDIT_API_BASE}{path}"
    payload = {key: value for key, value in (json_data or {}).items() if value is not None}

    with httpx.Client(timeout=30.0) as client:
        response = client.request(method, url, json=payload or None, auth=_auth())

    try:
        body = response.json()
    except ValueError:
        body = {"message": response.text}

    if response.status_code >= 400:
        message = body.get("message") or body.get("error_code") or "Xendit request failed"
        raise XenditError(str(message), status_code=response.status_code, error_code=body.get("error_code"))

    if not isinstance(body, dict):
        raise XenditError("Unexpected Xendit response format.")
    return body


def create_dynamic_qr_code(
    *,
    external_id: str,
    amount: float,
    callback_url: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return _json_request(
        "POST",
        "/qr_codes",
        json_data={
            "external_id": external_id,
            "type": "DYNAMIC",
            "callback_url": callback_url,
            "amount": round(float(amount), 2),
            "metadata": metadata,
        },
    )


def create_invoice(
    *,
    external_id: str,
    amount: float,
    description: str,
    payer_email: str | None,
    invoice_duration: int,
    success_redirect_url: str | None,
    failure_redirect_url: str | None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return _json_request(
        "POST",
        "/v2/invoices",
        json_data={
            "external_id": external_id,
            "amount": round(float(amount), 2),
            "currency": "PHP",
            "description": description,
            "payer_email": payer_email,
            "invoice_duration": invoice_duration,
            "success_redirect_url": success_redirect_url,
            "failure_redirect_url": failure_redirect_url,
            "metadata": metadata,
        },
    )


def get_qr_code_by_external_id(external_id: str) -> dict[str, Any]:
    return _request("GET", f"/qr_codes/{external_id}")


def get_invoice(invoice_id: str) -> dict[str, Any]:
    return _request("GET", f"/v2/invoices/{invoice_id}")


def simulate_qr_payment(*, external_id: str, amount: float) -> dict[str, Any]:
    """Sandbox-only helper to complete a dynamic QR payment."""
    return _json_request(
        "POST",
        f"/qr_codes/{external_id}/payments/simulate",
        json_data={"amount": round(float(amount), 2)},
    )
