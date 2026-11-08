from urllib.parse import urlsplit

import httpx

from app.config import settings

MAX_RECIPIENTS_PER_REQUEST = 500


class UnisenderGoConfigurationError(RuntimeError):
    pass


def unisender_go_is_configured() -> bool:
    endpoint = urlsplit(settings.UNISENDER_GO_API_URL)
    return bool(
        settings.UNISENDER_GO_API_KEY
        and endpoint.scheme == "https"
        and endpoint.netloc
    )


def send_email_batch(
    client: httpx.Client,
    *,
    subject: str,
    from_email: str,
    recipients: list[str],
    body_html: str,
    idempotence_key: str,
    cc_email: str | None = None,
) -> set[str]:
    if not unisender_go_is_configured():
        raise UnisenderGoConfigurationError(
            "Set UNISENDER_GO_API_KEY and UNISENDER_GO_API_URL."
        )
    if not recipients or len(recipients) > MAX_RECIPIENTS_PER_REQUEST:
        raise ValueError(
            f"Unisender Go accepts 1-{MAX_RECIPIENTS_PER_REQUEST} recipients per request."
        )
    if len(idempotence_key) > 64:
        raise ValueError("Unisender Go idempotence keys cannot exceed 64 characters.")

    message: dict[str, object] = {
        "recipients": [{"email": address} for address in recipients],
        "body": {"html": body_html},
        "subject": subject,
        "from_email": from_email,
        "global_language": "ru",
        "skip_unsubscribe": 0,
        "bypass_unsubscribed": 0,
        "track_links": 0,
        "track_read": 0,
        "idempotence_key": idempotence_key,
    }
    if cc_email:
        message["headers"] = {"CC": cc_email}

    endpoint = (
        f"{settings.UNISENDER_GO_API_URL.rstrip('/')}/email/send.json"
    )
    try:
        response = client.post(
            endpoint,
            headers={
                "X-API-KEY": settings.UNISENDER_GO_API_KEY,
                "Accept": "application/json",
            },
            json={"message": message},
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"Unisender Go returned HTTP {exc.response.status_code}."
        ) from exc
    except httpx.RequestError as exc:
        raise RuntimeError("Could not reach Unisender Go.") from exc

    try:
        result = response.json()
    except ValueError as exc:
        raise RuntimeError("Unisender Go returned an invalid JSON response.") from exc
    if not isinstance(result, dict):
        raise RuntimeError("Unisender Go returned an unexpected response.")

    if result.get("status") != "success":
        raise RuntimeError("Unisender Go rejected the request.")
    if not isinstance(result.get("job_id"), str) or not result["job_id"]:
        raise RuntimeError("Unisender Go returned no job identifier.")

    failed_emails = result.get("failed_emails", {})
    if not isinstance(failed_emails, dict):
        raise RuntimeError("Unisender Go returned an invalid failed_emails object.")

    failed_addresses = {
        address.strip().casefold()
        for address in failed_emails
        if isinstance(address, str) and address.strip()
    }
    submitted_addresses = {address.casefold() for address in recipients}
    if not failed_addresses.issubset(submitted_addresses):
        raise RuntimeError("Unisender Go returned an unknown failed recipient.")
    return failed_addresses
