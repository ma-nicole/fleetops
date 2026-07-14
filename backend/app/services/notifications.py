import html
import logging
from datetime import datetime
from typing import Any

import resend

from app.core.config import settings
from app.services.phone_normalize import normalize_e164_phone

logger = logging.getLogger(__name__)


def send_email_notification(
    to_email: str,
    subject: str,
    html_body: str,
    *,
    reply_to: str | None = None,
) -> bool:
    """Send email notification via Resend"""
    if not settings.resend_api_key:
        logger.warning("Email delivery skipped: RESEND_API_KEY is not configured.")
        return False

    try:
        resend.api_key = settings.resend_api_key
        payload: dict[str, Any] = {
            "from": settings.email_from,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
        if reply_to and reply_to.strip():
            payload["reply_to"] = reply_to.strip()
        response = resend.Emails.send(payload)
        ok = bool(response and response.get("id"))
        if ok:
            logger.info(
                "Email sent via Resend id=%s to=%s from=%s subject=%s",
                response.get("id"),
                to_email,
                settings.email_from,
                subject,
            )
        else:
            logger.warning(
                "Resend returned no message id for to=%s from=%s response=%s",
                to_email,
                settings.email_from,
                response,
            )
        return ok
    except Exception as exc:
        logger.exception(
            "Email delivery failed via Resend to=%s from=%s error=%s",
            to_email,
            settings.email_from,
            exc,
        )
        return False


def _feedback_severity_label(rating: int) -> str:
    labels = {
        5: "Critical — blocking / safety",
        4: "High — urgent issue",
        3: "Medium — needs attention soon",
        2: "Low — minor inconvenience",
        1: "Info — question or suggestion",
    }
    return labels.get(int(rating), f"{rating} / 5")


def _feedback_severity_colors(rating: int) -> tuple[str, str]:
    """Return (background, text) colors for severity badge."""
    colors = {
        5: ("#FEE2E2", "#991B1B"),
        4: ("#FFEDD5", "#9A3412"),
        3: ("#FEF3C7", "#92400E"),
        2: ("#DBEAFE", "#1E40AF"),
        1: ("#F3F4F6", "#374151"),
    }
    return colors.get(int(rating), ("#F3F4F6", "#374151"))


def _category_label(category: str) -> str:
    labels = {
        "support": "Support inquiry",
        "service": "Service quality",
        "driver": "Driver",
        "vehicle": "Vehicle",
        "general": "General feedback",
    }
    key = (category or "").strip().lower()
    return labels.get(key, (category or "Support").replace("_", " ").title())


def _row(label: str, value: str) -> str:
    return (
        f'<tr>'
        f'<td style="padding:10px 12px;color:#64748B;font-size:13px;width:36%;'
        f'border-bottom:1px solid #F1F5F9;vertical-align:top;">{html.escape(label)}</td>'
        f'<td style="padding:10px 12px;color:#0F172A;font-size:14px;'
        f'border-bottom:1px solid #F1F5F9;vertical-align:top;">{value}</td>'
        f"</tr>"
    )


def build_customer_support_email_html(
    *,
    feedback_id: int | None,
    customer_name: str,
    customer_email: str,
    customer_phone: str | None,
    booking_id: int | None,
    booking_status: str | None,
    pickup: str | None,
    dropoff: str | None,
    scheduled_date: str | None,
    scheduled_slot: str | None,
    estimated_cost: float | None,
    category: str,
    rating: int,
    message: str | None,
    attachment_url: str | None,
    submitted_at: str | None,
    dashboard_url: str | None,
) -> str:
    severity = _feedback_severity_label(rating)
    sev_bg, sev_fg = _feedback_severity_colors(rating)
    category_text = _category_label(category)
    safe_msg = html.escape((message or "").strip() or "(No message provided.)")
    safe_name = html.escape(customer_name or "Customer")
    safe_email = html.escape(customer_email or "—")
    phone = html.escape(normalize_e164_phone(customer_phone) or (customer_phone or "").strip() or "—")
    when = html.escape(submitted_at or datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))
    ticket = f"#{feedback_id}" if feedback_id is not None else "—"

    details_rows = [
        _row("Ticket ID", f"<strong>{html.escape(ticket)}</strong>"),
        _row("Submitted", when),
        _row(
            "Severity",
            f'<span style="display:inline-block;padding:4px 10px;border-radius:999px;'
            f'background:{sev_bg};color:{sev_fg};font-weight:700;font-size:12px;">'
            f"{html.escape(severity)}</span>",
        ),
        _row("Category", html.escape(category_text)),
    ]

    booking_rows: list[str] = []
    if booking_id is not None:
        booking_rows.append(_row("Booking", f"<strong>#{int(booking_id)}</strong>"))
        if booking_status:
            booking_rows.append(_row("Booking status", html.escape(str(booking_status).replace("_", " ").title())))
        if scheduled_date:
            slot = f" · {scheduled_slot}" if scheduled_slot else ""
            booking_rows.append(_row("Scheduled", html.escape(f"{scheduled_date}{slot}")))
        if pickup:
            booking_rows.append(_row("Pickup", html.escape(pickup)))
        if dropoff:
            booking_rows.append(_row("Drop-off", html.escape(dropoff)))
        if estimated_cost is not None:
            booking_rows.append(_row("Quoted total", html.escape(f"₱{float(estimated_cost):,.2f}")))
    else:
        booking_rows.append(_row("Booking", "General inquiry (no booking linked)"))

    attachment_block = ""
    if attachment_url:
        safe_url = html.escape(attachment_url)
        attachment_block = f"""
          <div style="margin-top:18px;padding:14px 16px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;">
            <div style="font-weight:700;color:#1E3A8A;margin-bottom:6px;">Screenshot attached</div>
            <a href="{safe_url}" style="color:#1D4ED8;font-weight:600;word-break:break-all;">{safe_url}</a>
          </div>
        """

    cta = ""
    if dashboard_url:
        safe_dash = html.escape(dashboard_url.rstrip("/"))
        cta = f"""
          <div style="margin-top:22px;text-align:center;">
            <a href="{safe_dash}/modules/customer/support"
               style="display:inline-block;background:#FF9800;color:#fff;text-decoration:none;
                      font-weight:700;padding:12px 18px;border-radius:10px;">
              Open FleetOpt
            </a>
          </div>
        """

    return f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <div style="max-width:640px;margin:0 auto;padding:24px 12px;">
    <div style="background:#0F766E;border-radius:14px 14px 0 0;padding:22px 24px;color:#fff;">
      <div style="font-size:13px;opacity:.9;letter-spacing:.04em;text-transform:uppercase;">FleetOpt Support Desk</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">New customer support request</h1>
      <p style="margin:8px 0 0;opacity:.92;font-size:14px;">A customer submitted Contact Support. Reply to this email to respond directly.</p>
    </div>

    <div style="background:#fff;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 14px 14px;padding:22px 24px;">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
        <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:{sev_bg};color:{sev_fg};font-weight:700;font-size:12px;">
          {html.escape(severity)}
        </span>
        <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#F1F5F9;color:#334155;font-weight:700;font-size:12px;">
          {html.escape(category_text)}
        </span>
        <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#ECFDF5;color:#065F46;font-weight:700;font-size:12px;">
          Ticket {html.escape(ticket)}
        </span>
      </div>

      <h2 style="margin:0 0 10px;font-size:15px;color:#0F766E;">Customer</h2>
      <table style="width:100%;border-collapse:collapse;background:#F8FAFC;border-radius:10px;overflow:hidden;margin-bottom:18px;">
        {_row("Name", f"<strong>{safe_name}</strong>")}
        {_row("Email", f'<a href="mailto:{safe_email}" style="color:#0F766E;font-weight:600;">{safe_email}</a>')}
        {_row("Phone", phone)}
      </table>

      <h2 style="margin:0 0 10px;font-size:15px;color:#0F766E;">Request details</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        {"".join(details_rows)}
      </table>

      <h2 style="margin:0 0 10px;font-size:15px;color:#0F766E;">Booking</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        {"".join(booking_rows)}
      </table>

      <h2 style="margin:0 0 10px;font-size:15px;color:#0F766E;">Customer message</h2>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;
                  white-space:pre-wrap;line-height:1.5;font-size:14px;color:#1F2937;">{safe_msg}</div>

      {attachment_block}
      {cta}

      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B;line-height:1.5;">
        <p style="margin:0;">This message was sent automatically by FleetOpt when a customer used <strong>Contact Support</strong>.</p>
        <p style="margin:8px 0 0;">Hit <strong>Reply</strong> to answer {safe_name} at {safe_email}.</p>
      </div>
    </div>
  </div>
</body>
</html>
"""


def notify_fleetops_customer_feedback(
    *,
    customer_email: str,
    customer_name: str,
    booking_id: int | None,
    category: str,
    rating: int,
    message: str | None,
    recipient_emails: list[str] | None = None,
    feedback_id: int | None = None,
    customer_phone: str | None = None,
    booking_status: str | None = None,
    pickup: str | None = None,
    dropoff: str | None = None,
    scheduled_date: str | None = None,
    scheduled_slot: str | None = None,
    estimated_cost: float | None = None,
    attachment_url: str | None = None,
    submitted_at: str | None = None,
) -> bool:
    """Email FleetOps inbox / admins when a customer submits Contact Support feedback."""
    recipients: list[str] = []
    for raw in recipient_emails or []:
        email = (raw or "").strip()
        if email and email not in recipients:
            recipients.append(email)
    inbox = (settings.feedback_inbox_email or "").strip()
    if inbox and inbox not in recipients:
        recipients.insert(0, inbox)

    if not recipients:
        logger.warning(
            "Feedback inbox email is not configured and no admin recipients were provided; "
            "feedback is saved but not forwarded."
        )
        return False

    scope = f"Booking #{booking_id}" if booking_id is not None else "General inquiry"
    severity_short = {
        5: "CRITICAL",
        4: "HIGH",
        3: "MEDIUM",
        2: "LOW",
        1: "INFO",
    }.get(int(rating), "SUPPORT")
    subject = f"[FleetOpt][{severity_short}] Support {scope} — {customer_name or 'Customer'}"

    frontend = (settings.frontend_url or "").strip().rstrip("/") or None
    body = build_customer_support_email_html(
        feedback_id=feedback_id,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        booking_id=booking_id,
        booking_status=booking_status,
        pickup=pickup,
        dropoff=dropoff,
        scheduled_date=scheduled_date,
        scheduled_slot=scheduled_slot,
        estimated_cost=estimated_cost,
        category=category,
        rating=rating,
        message=message,
        attachment_url=attachment_url,
        submitted_at=submitted_at,
        dashboard_url=frontend,
    )

    sent_any = False
    for to in recipients:
        if send_email_notification(to, subject, body, reply_to=customer_email):
            sent_any = True
    return sent_any
