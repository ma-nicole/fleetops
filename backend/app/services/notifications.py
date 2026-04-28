import resend

from app.core.config import settings


def send_email_notification(to_email: str, subject: str, html_body: str) -> bool:
    """Send email notification via Resend"""
    if not settings.resend_api_key:
        print(f"[MOCK EMAIL] To: {to_email} | Subject: {subject}")
        return False

    try:
        resend.api_key = settings.resend_api_key
        response = resend.Emails.send(
            {
                "from": "FleetOpt <notifications@fleetopt.com>",
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            }
        )
        return bool(response.get("id"))
    except Exception as e:
        print(f"Email send error: {e}")
        return False

