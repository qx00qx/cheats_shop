"""
Выплаты через Platega Payout API.

Публично документирован только вывод на рублёвые карты (HMAC-SHA256).
USDT-payout — запросить у менеджера Platega (@Platega_chat_bot).
"""
import base64
import hashlib
import hmac
import json
import time
import uuid

import httpx

from app.config import settings


class PlategaPayouts:
    BASE = "https://app.platega.io"

    def __init__(self) -> None:
        self.merchant_id = settings.PLATEGA_MERCHANT_ID
        self.secret = settings.PLATEGA_PAYOUT_SECRET or settings.PLATEGA_SECRET

    def _sign(self, method: str, path: str, body: bytes, idempotency_key: str) -> tuple[str, str, str]:
        ts = str(int(time.time()))
        body_hash = hashlib.sha256(body).hexdigest()
        string_to_sign = "\n".join([method.upper(), path, ts, idempotency_key, body_hash])
        sig = base64.b64encode(
            hmac.new(self.secret.encode(), string_to_sign.encode(), hashlib.sha256).digest()
        ).decode()
        auth = f"PG-HMAC kid={self.merchant_id}, ts={ts}, sig={sig}"
        return auth, ts, body_hash

    async def payout_card_rub(
        self,
        card_number: str,
        amount_rub: int,
        payout_method: str = "CARD",
        idempotency_key: str | None = None,
    ) -> dict:
        path = "/api/v1/payouts/card-rub"
        idem = idempotency_key or str(uuid.uuid4())
        body = json.dumps({
            "cardNumber": card_number,
            "amountRub": int(amount_rub),
            "payoutMethod": payout_method,
            "currencyRequested": "RUB",
        }, separators=(",", ":")).encode()

        auth, _ts, _h = self._sign("POST", path, body, idem)

        async with httpx.AsyncClient() as c:
            r = await c.post(
                f"{self.BASE}{path}",
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": auth,
                    "Idempotency-Key": idem,
                },
                timeout=30,
            )
            r.raise_for_status()
            return r.json()

    async def payout_usdt(
        self,
        wallet: str,
        network: str,
        amount_usdt: float,
    ) -> dict:
        """
        Плейсхолдер. Как только менеджер Platega откроет endpoint для USDT —
        подставить реальный PATH и тело запроса.
        Сети: TON, TRC20, BEP20, ERC20.
        """
        raise NotImplementedError(
            "USDT payout endpoint необходимо запросить у менеджера Platega (@Platega_chat_bot)"
        )


payouts = PlategaPayouts()