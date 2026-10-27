import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings


class AmazonSESConfigurationError(RuntimeError):
    pass


def amazon_ses_credentials_source() -> str:
    has_access_key = bool(settings.AMAZON_SES_ACCESS_KEY_ID)
    has_secret_key = bool(settings.AMAZON_SES_SECRET_ACCESS_KEY)
    if has_access_key != has_secret_key:
        return "invalid"
    if settings.AMAZON_SES_SESSION_TOKEN and not has_access_key:
        return "invalid"
    return "access_keys" if has_access_key else "default_chain"


def amazon_ses_is_configured() -> bool:
    return bool(settings.AMAZON_SES_REGION) and amazon_ses_credentials_source() != "invalid"


def send_email(
    *,
    subject: str,
    from_email: str,
    to_email: str,
    body_html: str,
    cc_email: str | None = None,
) -> str:
    credentials_source = amazon_ses_credentials_source()
    if not settings.AMAZON_SES_REGION:
        raise AmazonSESConfigurationError("AMAZON_SES_REGION is not configured")
    if credentials_source == "invalid":
        raise AmazonSESConfigurationError(
            "Both AMAZON_SES_ACCESS_KEY_ID and AMAZON_SES_SECRET_ACCESS_KEY must be configured"
        )
    if settings.AMAZON_SES_SESSION_TOKEN and credentials_source != "access_keys":
        raise AmazonSESConfigurationError(
            "AMAZON_SES_SESSION_TOKEN requires explicit Amazon SES access keys"
        )

    client_options: dict[str, str] = {
        "region_name": settings.AMAZON_SES_REGION,
    }
    if credentials_source == "access_keys":
        client_options["aws_access_key_id"] = settings.AMAZON_SES_ACCESS_KEY_ID
        client_options["aws_secret_access_key"] = settings.AMAZON_SES_SECRET_ACCESS_KEY
        if settings.AMAZON_SES_SESSION_TOKEN:
            client_options["aws_session_token"] = settings.AMAZON_SES_SESSION_TOKEN

    request: dict = {
        "FromEmailAddress": from_email,
        "Destination": {
            "ToAddresses": [to_email],
        },
        "Content": {
            "Simple": {
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": body_html, "Charset": "UTF-8"},
                },
            },
        },
    }
    if cc_email:
        request["Destination"]["CcAddresses"] = [cc_email]
    if settings.AMAZON_SES_CONFIGURATION_SET:
        request["ConfigurationSetName"] = settings.AMAZON_SES_CONFIGURATION_SET

    try:
        client = boto3.client("sesv2", **client_options)
        response = client.send_email(**request)
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(f"Amazon SES send failed: {exc}") from exc

    message_id = response.get("MessageId")
    if not message_id:
        raise RuntimeError("Amazon SES returned no MessageId")
    return message_id
