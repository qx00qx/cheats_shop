import pytest

from app.services import amazon_ses


def test_send_email_uses_ses_v2_and_keeps_recipients_individual(monkeypatch):
    request_data = {}

    class FakeSESClient:
        def send_email(self, **kwargs):
            request_data.update(kwargs)
            return {"MessageId": "ses-message-id"}

    def fake_client(service_name, **kwargs):
        assert service_name == "sesv2"
        assert kwargs == {
            "region_name": "eu-central-1",
            "aws_access_key_id": "ses-access-key",
            "aws_secret_access_key": "ses-secret-key",
        }
        return FakeSESClient()

    monkeypatch.setattr(amazon_ses.settings, "AMAZON_SES_REGION", "eu-central-1")
    monkeypatch.setattr(amazon_ses.settings, "AMAZON_SES_ACCESS_KEY_ID", "ses-access-key")
    monkeypatch.setattr(amazon_ses.settings, "AMAZON_SES_SECRET_ACCESS_KEY", "ses-secret-key")
    monkeypatch.setattr(amazon_ses.settings, "AMAZON_SES_SESSION_TOKEN", "")
    monkeypatch.setattr(amazon_ses.settings, "AMAZON_SES_CONFIGURATION_SET", "campaigns")
    monkeypatch.setattr(amazon_ses.boto3, "client", fake_client)

    message_id = amazon_ses.send_email(
        subject="Campaign",
        from_email="news@millex.market",
        to_email="user@example.com",
        body_html="<h1>Hello</h1>",
        cc_email="archive@millex.market",
    )

    assert message_id == "ses-message-id"
    assert request_data["Destination"] == {
        "ToAddresses": ["user@example.com"],
        "CcAddresses": ["archive@millex.market"],
    }
    assert request_data["Content"]["Simple"]["Subject"] == {
        "Data": "Campaign",
        "Charset": "UTF-8",
    }
    assert request_data["ConfigurationSetName"] == "campaigns"


def test_send_email_rejects_incomplete_credentials(monkeypatch):
    monkeypatch.setattr(amazon_ses.settings, "AMAZON_SES_REGION", "eu-central-1")
    monkeypatch.setattr(amazon_ses.settings, "AMAZON_SES_ACCESS_KEY_ID", "ses-access-key")
    monkeypatch.setattr(amazon_ses.settings, "AMAZON_SES_SECRET_ACCESS_KEY", "")
    monkeypatch.setattr(amazon_ses.settings, "AMAZON_SES_SESSION_TOKEN", "")

    with pytest.raises(amazon_ses.AmazonSESConfigurationError, match="Both AMAZON_SES"):
        amazon_ses.send_email(
            subject="Campaign",
            from_email="news@millex.market",
            to_email="user@example.com",
            body_html="<p>Hello</p>",
        )
