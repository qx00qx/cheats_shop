import httpx
from urllib.parse import quote
from app.config import settings


class PlategaClient:
    BASE = "https://app.platega.io"

    @property
    def headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "X-MerchantId": settings.PLATEGA_MERCHANT_ID,
            "X-Secret": settings.PLATEGA_SECRET,
        }

    async def create_payment(
        self,
        order_id: int,
        amount: float,
        method: int = 2,
        *,
        description: str | None = None,
        currency: str = "RUB",
        payload: str | None = None,
        return_url: str | None = None,
        failed_url: str | None = None,
    ) -> dict:
        payload_value = payload or str(order_id)
        payload_data = {
            "paymentMethod": method,
            "paymentDetails": {"amount": float(amount), "currency": currency},
            "description": description or f"Оплата заказа #{order_id}",
            "return": return_url or f"{settings.SITE_URL}/payment/success",
            "failedUrl": failed_url or f"{settings.SITE_URL}/payment/fail",
            "payload": payload_value,
        }

        async with httpx.AsyncClient(timeout=30) as c:
            try:
                r = await c.post(
                    f"{self.BASE}/transaction/process",
                    json=payload_data,
                    headers=self.headers,
                )
            except httpx.HTTPError as exc:
                raise RuntimeError(f"Platega request failed: {exc}") from exc

        if r.status_code >= 400:
            raise RuntimeError(f"Platega error {r.status_code}: {r.text}")

        try:
            data = r.json()
        except ValueError as exc:
            raise RuntimeError(f"Platega returned non-JSON response: {r.text}") from exc

        if not isinstance(data, dict):
            raise RuntimeError(f"Platega returned unexpected response: {data!r}")

        return data

    async def get_transaction_status(self, transaction_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            try:
                r = await c.get(
                    f"{self.BASE}/transaction/{quote(transaction_id, safe='')}",
                    headers=self.headers,
                )
            except httpx.HTTPError as exc:
                raise RuntimeError(f"Platega status request failed: {exc}") from exc

        if r.status_code >= 400:
            raise RuntimeError(f"Platega status error {r.status_code}: {r.text}")

        try:
            data = r.json()
        except ValueError as exc:
            raise RuntimeError(f"Platega returned non-JSON status response: {r.text}") from exc

        if not isinstance(data, dict):
            raise RuntimeError(f"Platega returned unexpected status response: {data!r}")

        return data

    async def get_rate(
        self,
        payment_method: int = 2,
        currency_from: str = "RUB",
        currency_to: str = "USDT",
    ) -> dict:
        params = {
            "merchantId": settings.PLATEGA_MERCHANT_ID,
            "paymentMethod": payment_method,
            "currencyFrom": currency_from,
            "currencyTo": currency_to,
        }
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(
                f"{self.BASE}/rates/payment_method_rate",
                params=params,
            )
            r.raise_for_status()
            return r.json()


platega = PlategaClient()