import json
import re
from decimal import Decimal, InvalidOperation


def _json_list(value: str | list | None) -> list:
    if isinstance(value, list):
        return value
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


def parse_legacy_tariffs(tabs_value: str | list | None, prices_value: str | list | None) -> list[dict]:
    tabs = _json_list(tabs_value)
    prices = _json_list(prices_value)
    tariffs = []

    for index, raw_price in enumerate(prices):
        price_text = str(raw_price).split(";", 1)[0].split("|", 1)[0].strip()
        match = re.search(r"\d+(?:[.,]\d+)?", price_text)
        if not match:
            continue

        try:
            price = Decimal(match.group().replace(",", "."))
        except InvalidOperation:
            continue
        if price <= 0:
            continue

        title = str(tabs[index]).strip() if index < len(tabs) else f"Тариф {index + 1}"
        duration_match = re.search(r"\d+", title)
        duration_days = int(duration_match.group()) if duration_match else None

        tariffs.append({
            "id": index + 1,
            "title": title or f"Тариф {index + 1}",
            "duration_days": duration_days,
            "price": float(price),
            "old_price": None,
            "sort_order": index,
        })

    return tariffs