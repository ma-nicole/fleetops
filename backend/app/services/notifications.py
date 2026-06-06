import html
import logging

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email_notification(to_email: str, subject: str, html_body: str) -> bool:
    """Send email notification via Resend"""
    if not settings.resend_api_key:
        logger.info("Email delivery skipped: RESEND_API_KEY is not configured.")
        return False

    try:
        resend.api_key = settings.resend_api_key
        response = resend.Emails.send(
            {
                "from": settings.email_from,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            }
        )
        return bool(response.get("id"))
    except Exception:
        logger.exception("Email delivery failed via provider.")
        return False


def notify_fleetops_customer_feedback(
    *,
    customer_email: str,
    customer_name: str,
    booking_id: int | None,
    category: str,
    rating: int,
    message: str | None,
) -> bool:
    """Email FleetOps inbox when a customer submits feedback (requires FEEDBACK_INBOX_EMAIL + RESEND_API_KEY for real delivery)."""
    to = (settings.feedback_inbox_email or "").strip()
    if not to:
        logger.warning(
            "Feedback inbox email is not configured; feedback is saved but not forwarded."
        )
        return False

    scope = f"Booking #{booking_id}" if booking_id is not None else "General (no booking)"
    subject = f"[FleetOpt] Customer feedback — {scope}"
    safe_msg = html.escape(message or "(no message)")
    safe_name = html.escape(customer_name or "")
    safe_email = html.escape(customer_email or "")
    body = f"""
    <html><body style="font-family: system-ui, sans-serif; color: #333;">
      <h2 style="color:#0f766e;">New customer feedback</h2>
      <table style="border-collapse:collapse;max-width:560px;">
        <tr><td style="padding:6px 12px 6px 0;color:#666;">From</td><td><strong>{safe_name}</strong> &lt;{safe_email}&gt;</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666;">Scope</td><td>{html.escape(scope)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666;">Category</td><td>{html.escape(category)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666;">Rating</td><td>{rating} / 5</td></tr>
      </table>
      <p style="margin-top:16px;"><strong>Message</strong></p>
      <div style="background:#f9fafb;padding:12px;border-radius:8px;white-space:pre-wrap;">{safe_msg}</div>
      <p style="margin-top:24px;font-size:12px;color:#888;">Sent by FleetOpt API from the customer feedback form.</p>
    </body></html>
    """
    return send_email_notification(to, subject, body)

