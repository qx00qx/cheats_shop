import asyncio

import httpx

from app.config import settings


class NfaConfigurationError(RuntimeError):
    pass


def _api_key() -> str:
    api_key = settings.NFA_API_KEY.strip() or settings.NFA_TOKEN.strip()
    if not api_key:
        raise NfaConfigurationError(
            "Выдача аккаунтов не настроена: задайте NFA_API_KEY в backend/.env"
        )
    return api_key


def _provider_error_message(response: httpx.Response, operation: str) -> str:
    if response.status_code in {401, 403}:
        return (
            f"NFA отклонил API-ключ при {operation} "
            f"(HTTP {response.status_code}); проверьте NFA_API_KEY"
        )

    try:
        payload = response.json()
    except ValueError:
        payload = None
    message = payload.get("message") if isinstance(payload, dict) else None
    if isinstance(message, str) and message.strip():
        return f"NFA: {message.strip()[:300]} (HTTP {response.status_code})"
    return f"NFA вернул HTTP {response.status_code} при {operation}"


class NfaClient:
    async def get_stock(self) -> dict:
        api_key = _api_key()

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    f"{settings.NFA_API_BASE_URL.rstrip('/')}/api/v1/stock",
                    headers={"X-API-Key": api_key, "Accept": "application/json"},
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                _provider_error_message(exc.response, "получении остатка")
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError("Не удалось получить остаток у NFA") from exc
        except ValueError as exc:
            raise RuntimeError("NFA вернул некорректный JSON остатка") from exc

        if not isinstance(payload, dict) or payload.get("status") != "success":
            raise RuntimeError("NFA вернул некорректный ответ остатка")
        stock = payload.get("stock")
        if not isinstance(stock, dict):
            raise RuntimeError("NFA вернул некорректный формат остатка")
        return stock

    async def get_status(self) -> dict:
        api_key = _api_key()

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    f"{settings.NFA_API_BASE_URL.rstrip('/')}/api/v1/status",
                    headers={"X-API-Key": api_key, "Accept": "application/json"},
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                _provider_error_message(exc.response, "проверке статуса")
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError("Не удалось проверить статус NFA") from exc
        except ValueError as exc:
            raise RuntimeError("NFA вернул некорректный JSON при проверке статуса") from exc

        if not isinstance(payload, dict) or payload.get("status") != "success":
            raise RuntimeError("NFA вернул некорректный статус")
        return payload

    async def activate_direct(self, account_type: str) -> dict:
        api_key = _api_key()

        status = await self.get_status()
        if status.get("steam_down"):
            await asyncio.sleep(60)
            status = await self.get_status()
            if status.get("steam_down"):
                raise RuntimeError("Сервисы Steam временно недоступны")

        try:
            async with httpx.AsyncClient(timeout=140) as client:
                response = await client.post(
                    f"{settings.NFA_API_BASE_URL.rstrip('/')}/api/v1/activate_direct",
                    json={"account_type": account_type},
                    headers={
                        "X-API-Key": api_key,
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                )
        except httpx.HTTPError as exc:
            raise RuntimeError("Не удалось связаться с поставщиком аккаунтов") from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise RuntimeError("Поставщик вернул некорректный ответ") from exc

        if not isinstance(payload, dict):
            raise RuntimeError("Поставщик вернул некорректный ответ")
        if response.status_code >= 400:
            raise RuntimeError(
                _provider_error_message(response, "выдаче аккаунта")
            )
        return payload


nfa = NfaClient()
