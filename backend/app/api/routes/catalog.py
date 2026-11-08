import json
import re
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal
from decimal import Decimal
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Query
from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import bindparam, func, inspect, text

from app.database import get_db
from app.api.deps import get_current_admin
from app.models import BotOrder, CheatFeatureAssignment, CheatFeatureCategory
from app.services.cheat_promotion import (
    cheat_promotion_payload,
    cheat_promotion_public_fields,
)
from app.services.legacy_catalog import parse_legacy_tariffs

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

RECENT_PURCHASES_LIMIT = 50
RECENT_PURCHASES_DAYS = 7
ITEM_SALES_LIMIT = 10


def _mask_purchase_email(email: str) -> str:
    local, separator, domain = email.strip().partition("@")
    if not separator or not local or "." not in domain:
        return ""
    top_level_domain = domain.rsplit(".", 1)[-1]
    return f"{local[:2]}****@.{top_level_domain}"


def _validate_seo_image(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    normalized = value.strip()
    if normalized.startswith("/") and not normalized.startswith("//"):
        return normalized
    parsed = urlsplit(normalized)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return normalized
    raise ValueError("Укажите HTTP(S)-ссылку или путь к изображению на сайте")


class LegacyTariffInput(BaseModel):
    label: str = Field(..., min_length=1, max_length=64)
    price: Decimal = Field(..., gt=0, le=1000000, max_digits=12, decimal_places=2)
    raw_price: str | None = Field(default=None, max_length=2000)


class GalleryMediaInput(BaseModel):
    type: Literal["image", "video"]
    url: str = Field(..., min_length=1, max_length=2000)
    alt: str = Field(default="", max_length=255)

    @field_validator("url")
    @classmethod
    def validate_media_url(cls, value: str) -> str:
        normalized = value.strip()
        if normalized.startswith("/") and not normalized.startswith("//"):
            return normalized

        parsed = urlsplit(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Укажите HTTP(S)-ссылку или путь к файлу на сайте")
        return normalized


class CheatFeatureCategoryInput(BaseModel):
    category_id: int = Field(..., gt=0)
    features: list[Annotated[str, Field(max_length=200)]] = Field(
        default_factory=list,
        max_length=100,
    )


class LegacyItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=1000)
    alias: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9_-]+$")
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)
    seo_image: str | None = Field(default=None, max_length=2000)
    seo_noindex: bool = False
    game_id: int = Field(..., gt=0)
    systems: str | None = Field(default=None, max_length=1000)
    text: str | None = None
    instruction: str | None = None
    instruction_link: str | None = Field(default=None, max_length=1000)
    advantages: str | None = None
    keys_text: str | None = None
    preview: str | None = Field(default=None, max_length=2000)
    gallery: list[GalleryMediaInput] = Field(default_factory=list, max_length=30)
    characteristics: str | None = None
    platforms: str | None = None
    video: str | None = None
    status: int = Field(default=1, ge=0, le=1)
    security_status: int = Field(default=2, ge=1, le=3)
    vis: int = Field(default=1, ge=0, le=1)
    home: int = Field(default=0, ge=0, le=1)
    top: int = Field(default=0, ge=0, le=1)
    hit: int = Field(default=0, ge=0, le=1)
    undetected: int = Field(default=0, ge=0, le=1)
    win10: int = Field(default=0, ge=0, le=1)
    win11: int = Field(default=0, ge=0, le=1)
    amd: int = Field(default=0, ge=0, le=1)
    intel: int = Field(default=0, ge=0, le=1)
    esp_title: str | None = None
    esp: str | None = None
    esp_desc: str | None = None
    esp_en_title: str | None = None
    esp_en_desc: str | None = None
    aimbot_title: str | None = None
    aimbot: str | None = None
    aimbot_desc: str | None = None
    aimbot_en_title: str | None = None
    aimbot_en_desc: str | None = None
    misc_title: str | None = None
    misc: str | None = None
    misc_desc: str | None = None
    misc_en_title: str | None = None
    misc_en_desc: str | None = None
    loot_title: str | None = None
    loot: str | None = None
    loot_desc: str | None = None
    loot_en_title: str | None = None
    loot_en_desc: str | None = None
    visuals_title: str | None = None
    visuals: str | None = None
    visuals_desc: str | None = None
    visuals_en_title: str | None = None
    visuals_en_desc: str | None = None
    feature_categories: list[CheatFeatureCategoryInput] = Field(
        default_factory=list,
        max_length=50,
    )
    tariffs: list[LegacyTariffInput] = Field(..., min_length=1, max_length=20)

    @field_validator("instruction_link")
    @classmethod
    def normalize_instruction_link(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None

        candidate = value.strip()
        if candidate.startswith("/") and not candidate.startswith("//"):
            parsed = urlsplit(candidate)
        elif candidate.startswith(("http://", "https://")):
            parsed = urlsplit(candidate)
            if parsed.hostname not in {
                "millex.market",
                "www.millex.market",
                "millex.xyz",
                "www.millex.xyz",
            }:
                raise ValueError("Используйте ссылку на статью блога MILLEX")
        else:
            parsed = urlsplit(f"/{candidate.lstrip('/')}")

        match = re.fullmatch(r"/blogs?/([a-zA-Z0-9_-]+)/?", parsed.path)
        if not match or parsed.query or parsed.fragment:
            raise ValueError("Укажите адрес статьи блога в формате /blog/alias")
        return f"/blog/{match.group(1)}"

    @field_validator("seo_image")
    @classmethod
    def validate_seo_image(cls, value: str | None) -> str | None:
        return _validate_seo_image(value)


class AdminGameInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9_-]+$")
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)
    seo_image: str | None = Field(default=None, max_length=2000)
    seo_noindex: bool = False
    cover_url: str | None = Field(default=None, max_length=2000)
    sort_order: int = Field(default=999, ge=0)
    is_active: bool = True

    @field_validator("seo_image")
    @classmethod
    def validate_seo_image(cls, value: str | None) -> str | None:
        return _validate_seo_image(value)


class ItemVisibilityInput(BaseModel):
    vis: int = Field(..., ge=0, le=1)


class ItemSecurityStatusInput(BaseModel):
    security_status: int = Field(..., ge=1, le=3)


def serialize_legacy_prices(tariffs: list[LegacyTariffInput]) -> str:
    prices = []
    for tariff in tariffs:
        price = format(tariff.price, "f")
        if tariff.raw_price:
            preserved = re.sub(r"^\s*\d+(?:[.,]\d+)?", price, tariff.raw_price, count=1)
            prices.append(preserved)
        else:
            prices.append(price)
    return json.dumps(prices)


def deserialize_legacy_prices(value: str | list | None) -> list:
    if isinstance(value, list):
        return value
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


def _feature_assignments_by_item(db: Session, item_ids: list[int]) -> dict[int, list[dict]]:
    if not item_ids:
        return {}

    rows = (
        db.query(CheatFeatureAssignment, CheatFeatureCategory.title)
        .join(
            CheatFeatureCategory,
            CheatFeatureCategory.id == CheatFeatureAssignment.category_id,
        )
        .filter(CheatFeatureAssignment.item_id.in_(item_ids))
        .order_by(CheatFeatureCategory.title)
        .all()
    )
    assignments: dict[int, list[dict]] = {}
    for assignment, title in rows:
        try:
            features = json.loads(assignment.features)
        except (TypeError, json.JSONDecodeError):
            features = []
        if not isinstance(features, list):
            features = []
        assignments.setdefault(assignment.item_id, []).append({
            "category_id": assignment.category_id,
            "title": title,
            "features": [
                str(feature) for feature in features if isinstance(feature, str)
            ],
        })
    return assignments


def _shared_feature_names(
    current_categories: list[dict],
    candidate_categories: list[dict],
) -> list[str]:
    candidate_features = {
        category["category_id"]: {
            " ".join(feature.strip().lower().split())
            for feature in category["features"]
            if feature.strip()
        }
        for category in candidate_categories
    }

    shared: dict[str, str] = {}
    for category in current_categories:
        candidate = candidate_features.get(category["category_id"])
        if not candidate:
            continue
        for feature in category["features"]:
            normalized = " ".join(feature.strip().lower().split())
            if normalized and normalized in candidate:
                shared.setdefault(normalized, feature.strip())
    return list(shared.values())


def _save_feature_assignments(
    db: Session,
    item_id: int,
    assignments: list[CheatFeatureCategoryInput],
) -> None:
    category_ids = [assignment.category_id for assignment in assignments]
    if len(category_ids) != len(set(category_ids)):
        raise HTTPException(422, "Категория не может быть добавлена к читу дважды")

    valid_ids = {
        row[0]
        for row in db.query(CheatFeatureCategory.id)
        .filter(CheatFeatureCategory.id.in_(category_ids))
        .all()
    } if category_ids else set()
    if valid_ids != set(category_ids):
        raise HTTPException(422, "Выбрана неизвестная категория функционала")

    db.query(CheatFeatureAssignment).filter(
        CheatFeatureAssignment.item_id == item_id
    ).delete(synchronize_session=False)
    for assignment in assignments:
        features = []
        for feature in assignment.features:
            normalized = feature.strip()
            if normalized and normalized not in features:
                features.append(normalized)
        db.add(CheatFeatureAssignment(
            item_id=item_id,
            category_id=assignment.category_id,
            features=json.dumps(features, ensure_ascii=False),
        ))


def _item_gallery(
    gallery: object,
    preview: str | None = None,
    video: str | None = None,
) -> list[dict[str, str]]:
    if isinstance(gallery, str):
        try:
            gallery = json.loads(gallery)
        except json.JSONDecodeError:
            gallery = None

    if isinstance(gallery, list):
        media_items = [
            {
                "type": media["type"],
                "url": media["url"],
                "alt": media.get("alt", ""),
            }
            for media in gallery
            if isinstance(media, dict)
            and media.get("type") in {"image", "video"}
            and isinstance(media.get("url"), str)
            and media["url"].strip()
        ]
        if preview and preview.strip() and not any(
            media["type"] == "image" and media["url"] == preview.strip()
            for media in media_items
        ):
            media_items.append({"type": "image", "url": preview.strip(), "alt": ""})
        if video and video.strip() and not any(
            media["type"] == "video" and media["url"] == video.strip()
            for media in media_items
        ):
            media_items.append({"type": "video", "url": video.strip(), "alt": ""})
        return media_items

    if gallery is not None:
        return []

    legacy_media = []
    if preview and preview.strip():
        legacy_media.append({"type": "image", "url": preview.strip(), "alt": ""})
    if video and video.strip():
        legacy_media.append({"type": "video", "url": video.strip(), "alt": ""})
    return legacy_media


@router.get("/games")
def get_games(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT
            c.id,
            c.name AS title,
            c.alias AS slug,
            c.images_characters AS image,
            c.seo_title,
            c.seo_description,
            c.seo_image,
            c.seo_noindex,
            COUNT(i.id)::integer AS product_count,
            COALESCE(MIN(i.price), 0) AS min_price
        FROM categories c
        LEFT JOIN items i
                      ON substring(i."categoryData" from '"id"\\s*:\\s*([0-9]+)') = c.id::text
         AND i.status = 1
         AND COALESCE(i.vis, 1) = 1
        WHERE c.vis = 1 AND c.parent = 0
        GROUP BY c.id, c.name, c.alias, c.images_characters, c.seo_title,
                 c.seo_description, c.seo_image, c.seo_noindex, c.posled
        ORDER BY c.posled, c.id
    """)).mappings().all()

    promotion_fields = cheat_promotion_public_fields(db)
    return [{**dict(row), **promotion_fields} for row in rows]


@router.get("/search")
def search_catalog(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
):
    query = q.strip()
    if len(query) < 2:
        return []

    rows = db.execute(text("""
        SELECT
            i.id,
            i.name,
            i.alias,
            i.price,
            c.name AS game_title
        FROM items i
        LEFT JOIN categories c
          ON substring(i."categoryData" from '"id"\\s*:\\s*([0-9]+)') = c.id::text
        WHERE i.status = 1
          AND COALESCE(i.vis, 1) = 1
          AND (
              i.name ILIKE :pattern
              OR i.alias ILIKE :pattern
              OR COALESCE(i.text, '') ILIKE :pattern
              OR COALESCE(c.name, '') ILIKE :pattern
          )
        ORDER BY i.id DESC
        LIMIT 8
    """), {"pattern": f"%{query}%"}).mappings().all()
    return [
        {
            "id": int(row["id"]),
            "name": str(row["name"] or ""),
            "alias": str(row["alias"] or ""),
            "price": float(row["price"] or 0),
            "game_title": str(row["game_title"] or ""),
        }
        for row in rows
    ]


@router.get("/promotion")
def get_promotion(db: Session = Depends(get_db)):
    return cheat_promotion_payload(db)


@router.get("/recent-purchases")
def get_recent_purchases(db: Session = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECENT_PURCHASES_DAYS)
    rows = (
        db.query(
            BotOrder.item_alias,
            BotOrder.product,
            BotOrder.email,
            BotOrder.created_at,
        )
        .filter(
            BotOrder.status.in_(("new", "completed")),
            BotOrder.created_at >= cutoff,
            BotOrder.email.is_not(None),
            BotOrder.product.is_not(None),
            func.lower(func.coalesce(BotOrder.period, "")) != "аккаунт",
            func.coalesce(BotOrder.period, "") != "Аккаунт",
        )
        .order_by(BotOrder.created_at.desc(), BotOrder.external_order_id.desc())
        .limit(RECENT_PURCHASES_LIMIT)
        .all()
    )

    purchases = []
    for row in rows:
        masked_email = _mask_purchase_email(row.email or "")
        product = (row.product or "").strip()
        if not masked_email or not product:
            continue
        created_at = row.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        else:
            created_at = created_at.astimezone(timezone.utc)
        purchases.append({
            "alias": row.item_alias,
            "product": product,
            "email": masked_email,
            "created_at": created_at.isoformat(),
        })

    return purchases


@router.get("/statuses")
def get_cheat_statuses(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT id, name, alias, security_status, "categoryData"
        FROM items
        WHERE COALESCE(status, 0) = 1
          AND COALESCE(vis, 1) = 1
          AND security_status IN (1, 2, 3)
        ORDER BY name, id
    """)).mappings()

    games: dict[str, dict] = {}
    for row in rows:
        try:
            game = json.loads(row["categoryData"] or "{}")
        except (TypeError, ValueError):
            continue
        if not isinstance(game, dict) or game.get("id") is None or not game.get("name"):
            continue

        game_id = str(game["id"])
        section = games.setdefault(
            game_id,
            {"id": game_id, "name": str(game["name"]), "cheats": []},
        )
        section["cheats"].append({
            "id": str(row["id"]),
            "alias": row["alias"],
            "name": row["name"],
            "status": row["security_status"],
        })

    return {"games": sorted(games.values(), key=lambda game: game["name"].casefold())}


@router.get("/games/{slug}")
def get_game_items(slug: str, db: Session = Depends(get_db)):
    game = db.execute(text("""
        SELECT id, name AS title, alias AS slug, images_characters AS image,
               seo_title, seo_description, seo_image, seo_noindex
        FROM categories
        WHERE alias = :slug AND vis = 1
        LIMIT 1
    """), {"slug": slug}).mappings().first()

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    items = db.execute(text("""
        SELECT
            id,
            name,
            alias,
            seo_title,
            seo_description,
            seo_image,
            seo_noindex,
            text,
            tabs,
            status,
            price,
            preview,
            video,
            gallery,
            COALESCE(vis, 1) AS vis,
            COALESCE(top, 0) AS top,
            COALESCE(hit, 0) AS hit,
            COALESCE(undetected, 0) AS undetected,
            COALESCE(security_status, 2) AS security_status,
            COALESCE(win10, 0) AS win10,
            COALESCE(win11, 0) AS win11,
            COALESCE(amd, 0) AS amd,
            COALESCE(intel, 0) AS intel
        FROM items
        WHERE substring("categoryData" from '"id"\\s*:\\s*([0-9]+)') = CAST(:cid AS TEXT)
          AND status = 1
          AND COALESCE(vis, 1) = 1
        ORDER BY id DESC
    """), {"cid": game["id"]}).mappings().all()
    feature_categories = _feature_assignments_by_item(
        db,
        [item["id"] for item in items],
    )
    purchase_summaries = {}
    if items:
        purchase_rows = (
            db.query(
                BotOrder.item_alias,
                func.count(BotOrder.id).label("purchase_count"),
                func.max(BotOrder.created_at).label("last_purchase_at"),
            )
            .filter(
                BotOrder.item_alias.in_([item["alias"] for item in items]),
                BotOrder.status.in_(("new", "completed")),
                func.lower(func.coalesce(BotOrder.period, "")) != "аккаунт",
                func.coalesce(BotOrder.period, "") != "Аккаунт",
            )
            .group_by(BotOrder.item_alias)
            .all()
        )
        for alias, purchase_count, last_purchase_at in purchase_rows:
            if last_purchase_at is not None:
                if last_purchase_at.tzinfo is None:
                    last_purchase_at = last_purchase_at.replace(tzinfo=timezone.utc)
                else:
                    last_purchase_at = last_purchase_at.astimezone(timezone.utc)
            purchase_summaries[alias] = {
                "purchase_count": purchase_count,
                "last_purchase_at": last_purchase_at.isoformat() if last_purchase_at else None,
            }

    public_items = []
    for item in items:
        gallery = _item_gallery(item["gallery"], item["preview"], item["video"])
        first_image = next(
            (media["url"] for media in gallery if media["type"] == "image"),
            game["image"],
        )
        public_items.append({
            **dict(item),
            **cheat_promotion_public_fields(db),
            "gallery": gallery,
            "image": first_image,
            "feature_categories": feature_categories.get(item["id"], []),
            **purchase_summaries.get(item["alias"], {
                "purchase_count": 0,
                "last_purchase_at": None,
            }),
        })

    return {
        "game": dict(game),
        "items": public_items,
    }


@router.get("/similar-items/{alias}")
def get_similar_items(alias: str, db: Session = Depends(get_db)):
    current_item_id = db.execute(text("""
        SELECT id
        FROM items
        WHERE alias = :alias
          AND status = 1
          AND COALESCE(vis, 1) = 1
        LIMIT 1
    """), {"alias": alias}).scalar()
    if current_item_id is None:
        raise HTTPException(status_code=404, detail="Item not found")

    current_categories = _feature_assignments_by_item(db, [current_item_id]).get(
        current_item_id,
        [],
    )
    category_ids = [category["category_id"] for category in current_categories]
    matches = []
    if category_ids:
        candidate_item_ids = [
            row[0]
            for row in db.query(CheatFeatureAssignment.item_id)
            .filter(
                CheatFeatureAssignment.category_id.in_(category_ids),
                CheatFeatureAssignment.item_id != current_item_id,
            )
            .distinct()
            .all()
        ]
        if candidate_item_ids:
            active_candidates_query = text("""
                SELECT id, name
                FROM items
                WHERE id IN :item_ids
                  AND status = 1
                  AND COALESCE(vis, 1) = 1
            """).bindparams(bindparam("item_ids", expanding=True))
            active_candidates = db.execute(
                active_candidates_query,
                {"item_ids": candidate_item_ids},
            ).mappings().all()
            active_candidate_ids = [row["id"] for row in active_candidates]
            feature_categories = _feature_assignments_by_item(
                db,
                active_candidate_ids,
            )
            candidate_names = {row["id"]: row["name"] for row in active_candidates}
            shared_features_by_id = {}
            for candidate_id in active_candidate_ids:
                shared_features = _shared_feature_names(
                    current_categories,
                    feature_categories.get(candidate_id, []),
                )
                if shared_features:
                    shared_features_by_id[candidate_id] = shared_features
            matches = sorted(
                shared_features_by_id,
                key=lambda candidate_id: (
                    -len(shared_features_by_id[candidate_id]),
                    candidate_names[candidate_id].casefold(),
                ),
            )[:12]

    if matches:
        matched_items_query = text("""
            SELECT id, name, alias, price, preview, video, gallery
            FROM items
            WHERE id IN :item_ids
        """).bindparams(bindparam("item_ids", expanding=True))
        item_rows = db.execute(
            matched_items_query,
            {"item_ids": matches},
        ).mappings().all()
        rows_by_id = {row["id"]: dict(row) for row in item_rows}
        rows = [
            {
                **rows_by_id[candidate_id],
                "shared_features": shared_features_by_id[candidate_id],
            }
            for candidate_id in matches
        ]
    else:
        rows = db.execute(text("""
            SELECT id, name, alias, price, preview, video, gallery
            FROM items
            WHERE alias != :alias
              AND status = 1
              AND COALESCE(vis, 1) = 1
            ORDER BY id DESC
            LIMIT 12
        """), {"alias": alias}).mappings().all()

    promotion_fields = cheat_promotion_public_fields(db)

    public_items = []
    for row in rows:
        item = dict(row)
        gallery = [
            media
            for media in _item_gallery(
                item.get("gallery"),
                item.get("preview"),
                item.get("video"),
            )
            if media["type"] == "image"
        ]
        item["gallery"] = gallery[:1]
        item["image"] = gallery[0]["url"] if gallery else None
        item.pop("preview", None)
        item.pop("video", None)
        item.update(promotion_fields)
        item.setdefault("shared_features", [])
        public_items.append(item)

    return {"items": public_items}


@router.get("/home-items")
def get_home_items(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT
            i.id,
            i.name,
            i.alias,
            i.price,
            COALESCE(i.top, 0) AS top,
            COALESCE(i.hit, 0) AS hit,
            COALESCE(i.undetected, 0) AS undetected,
            COALESCE(i.security_status, 2) AS security_status,
            i.preview,
            i.video,
            i.gallery,
            c.name AS game_title
        FROM items i
        LEFT JOIN categories c
          ON substring(i."categoryData" from '"id"\\s*:\\s*([0-9]+)') = c.id::text
        WHERE i.status = 1
          AND COALESCE(i.vis, 1) = 1
          AND COALESCE(i.home, 0) = 1
        ORDER BY i.id DESC
    """)).mappings().all()
    assignments = _feature_assignments_by_item(
        db,
        [row["id"] for row in rows],
    )
    promotion_fields = cheat_promotion_public_fields(db)
    items = []
    for row in rows:
        item = dict(row)
        item["gallery"] = _item_gallery(
            item.get("gallery"),
            item.get("preview"),
            item.get("video"),
        )
        item["image"] = next(
            (media["url"] for media in item["gallery"] if media["type"] == "image"),
            None,
        )
        item["feature_categories"] = assignments.get(item["id"], [])
        item.update(promotion_fields)
        items.append(item)
    return items


@router.get("/items/{alias}/sales")
def get_item_sales(alias: str, db: Session = Depends(get_db)):
    purchase_filter = (
        BotOrder.item_alias == alias,
        BotOrder.status.in_(("new", "completed")),
        func.lower(func.coalesce(BotOrder.period, "")) != "аккаунт",
        func.coalesce(BotOrder.period, "") != "Аккаунт",
    )
    purchase_count = (
        db.query(func.count(BotOrder.id))
        .filter(*purchase_filter)
        .scalar()
        or 0
    )
    rows = (
        db.query(BotOrder.email, BotOrder.created_at)
        .filter(
            *purchase_filter,
            BotOrder.email.is_not(None),
        )
        .order_by(BotOrder.created_at.desc(), BotOrder.external_order_id.desc())
        .limit(ITEM_SALES_LIMIT)
        .all()
    )

    sales = []
    for row in rows:
        masked_email = _mask_purchase_email(row.email or "")
        if not masked_email:
            continue
        created_at = row.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        else:
            created_at = created_at.astimezone(timezone.utc)
        sales.append({
            "email": masked_email,
            "created_at": created_at.isoformat(),
        })

    return {"purchase_count": purchase_count, "sales": sales}


@router.get("/items/{alias}")
def get_item(alias: str, db: Session = Depends(get_db)):
    row = db.execute(text("""
        SELECT
            id,
            name,
            alias,
            seo_title,
            seo_description,
            seo_image,
            seo_noindex,
            text,
            tabs,
            systems,
            instruction,
            instruction_link,
            advantages,
            keys_text,
            preview,
            video,
            gallery,
            "categoryData",
            status,
            platforms,
            COALESCE(undetected, 0) AS undetected,
            COALESCE(win10, 0) AS win10,
            COALESCE(win11, 0) AS win11,
            COALESCE(amd, 0) AS amd,
            COALESCE(intel, 0) AS intel,
            prices
        FROM items
        WHERE alias = :alias AND status = 1
        LIMIT 1
    """), {"alias": alias}).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Item not found")

    item = dict(row)
    item["gallery"] = _item_gallery(
        item.get("gallery"),
        item.get("preview"),
        item.get("video"),
    )
    category_match = re.search(r'"id"\s*:\s*([0-9]+)', item.pop("categoryData") or "")
    if category_match:
        category = db.execute(text("""
            SELECT alias, name
            FROM categories
            WHERE id = :category_id
            LIMIT 1
        """), {"category_id": int(category_match.group(1))}).mappings().first()
        item["game_alias"] = category["alias"] if category else None
        item["game_title"] = category["name"] if category else None
    else:
        item["game_alias"] = None
        item["game_title"] = None
    item["tariffs"] = parse_legacy_tariffs(item["tabs"], item.pop("prices"))
    item.update(cheat_promotion_public_fields(db))
    item["feature_categories"] = _feature_assignments_by_item(db, [item["id"]]).get(
        item["id"],
        [],
    )
    return item

@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT id, alias AS slug, name AS title,
               seo_title, seo_description
        FROM categories
        WHERE vis = 1 AND parent = 0
        ORDER BY posled, id
    """)).mappings().all()
    return [dict(row) for row in rows]


@router.get("/admin/games")
def list_admin_games(
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    rows = db.execute(text("""
        SELECT id, COALESCE(name, '') AS title, COALESCE(alias, '') AS slug,
               images_characters AS cover_url, COALESCE(posled, 999) AS sort_order,
               COALESCE(vis, 0) = 1 AS is_active,
               COALESCE(seo_title, '') AS seo_title,
               COALESCE(seo_description, '') AS seo_description,
               COALESCE(seo_image, '') AS seo_image,
               COALESCE(seo_noindex, FALSE) AS seo_noindex
        FROM categories
        WHERE parent = 0
        ORDER BY posled, id
    """)).mappings().all()
    product_counts: dict[int, int] = {}
    inspector = inspect(db.get_bind())
    if inspector.has_table("items"):
        item_columns = {column["name"] for column in inspector.get_columns("items")}
        if "categoryData" in item_columns:
            status_filter = " WHERE status = 1" if "status" in item_columns else ""
            for item in db.execute(text(
                f'SELECT "categoryData" FROM items{status_filter}'
            )).mappings():
                match = re.search(r'"id"\s*:\s*([0-9]+)', item["categoryData"] or "")
                if match:
                    category_id = int(match.group(1))
                    product_counts[category_id] = product_counts.get(category_id, 0) + 1
    games = []
    for row in rows:
        game = dict(row)
        game["is_active"] = bool(game["is_active"])
        game["product_count"] = product_counts.get(row["id"], 0)
        games.append(game)
    return games


@router.post("/admin/games", status_code=201)
def create_admin_game(
    payload: AdminGameInput,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    existing = db.execute(
        text("SELECT id FROM categories WHERE alias = :slug LIMIT 1"),
        {"slug": payload.slug},
    ).first()
    if existing:
        raise HTTPException(409, "Game slug already exists")

    row = db.execute(text("""
        INSERT INTO categories (
            name, alias, images_characters, parent, vis, posled,
            seo_title, seo_description, seo_image, seo_noindex
        )
        VALUES (
            :title, :slug, :cover_url, 0, :is_active, :sort_order,
            :seo_title, :seo_description, :seo_image, :seo_noindex
        )
        RETURNING id, name AS title, alias AS slug, images_characters AS cover_url,
                  posled AS sort_order, (vis = 1) AS is_active,
                  COALESCE(seo_title, '') AS seo_title,
                  COALESCE(seo_description, '') AS seo_description,
                  COALESCE(seo_image, '') AS seo_image,
                  COALESCE(seo_noindex, FALSE) AS seo_noindex
    """), {
        **payload.model_dump(),
        "is_active": int(payload.is_active),
    }).mappings().first()
    db.commit()
    result = dict(row)
    result["is_active"] = bool(result["is_active"])
    return result


@router.put("/admin/games/{game_id}")
def update_admin_game(
    game_id: int,
    payload: AdminGameInput,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    existing = db.execute(text("""
        SELECT id FROM categories
        WHERE alias = :slug AND id != :game_id
        LIMIT 1
    """), {"slug": payload.slug, "game_id": game_id}).first()
    if existing:
        raise HTTPException(409, "Game slug already exists")

    row = db.execute(text("""
        UPDATE categories
        SET name = :title,
            alias = :slug,
            images_characters = :cover_url,
            posled = :sort_order,
            vis = :is_active,
            seo_title = :seo_title,
            seo_description = :seo_description,
            seo_image = :seo_image,
            seo_noindex = :seo_noindex
        WHERE id = :game_id AND parent = 0
        RETURNING id, name AS title, alias AS slug, images_characters AS cover_url,
                  posled AS sort_order, (vis = 1) AS is_active,
                  COALESCE(seo_title, '') AS seo_title,
                  COALESCE(seo_description, '') AS seo_description,
                  COALESCE(seo_image, '') AS seo_image,
                  COALESCE(seo_noindex, FALSE) AS seo_noindex
    """), {
        **payload.model_dump(),
        "is_active": int(payload.is_active),
        "game_id": game_id,
    }).mappings().first()
    if not row:
        raise HTTPException(404, "Game not found")
    db.commit()
    result = dict(row)
    result["is_active"] = bool(result["is_active"])
    return result


@router.get("/admin/items")
def list_admin_items(
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    rows = db.execute(text("""
        SELECT
            i.id, COALESCE(i.name, '') AS name, COALESCE(i.alias, '') AS alias,
            COALESCE(i.seo_title, '') AS seo_title,
            COALESCE(i.seo_description, '') AS seo_description,
            COALESCE(i.seo_image, '') AS seo_image,
            COALESCE(i.seo_noindex, FALSE) AS seo_noindex,
            COALESCE(i.systems, '') AS systems, COALESCE(i.text, '') AS text,
            COALESCE(i.instruction, '') AS instruction,
            COALESCE(i.instruction_link, '') AS instruction_link,
            COALESCE(i.advantages, '') AS advantages, COALESCE(i.keys_text, '') AS keys_text,
            COALESCE(i.preview, '') AS preview, COALESCE(i.characteristics, '') AS characteristics,
            COALESCE(i.platforms, '') AS platforms, COALESCE(i.video, '') AS video,
            i.gallery AS gallery,
            i.tabs, i.prices,
            COALESCE(i.status, 0) AS status, COALESCE(i.vis, 0) AS vis,
            COALESCE(i.security_status, 2) AS security_status,
            COALESCE(i.home, 0) AS home, COALESCE(i.top, 0) AS top,
            COALESCE(i.hit, 0) AS hit, COALESCE(i.undetected, 0) AS undetected,
            COALESCE(i.win10, 0) AS win10, COALESCE(i.win11, 0) AS win11,
            COALESCE(i.amd, 0) AS amd, COALESCE(i.intel, 0) AS intel,
            COALESCE(i.esp_title, '') AS esp_title, COALESCE(i.esp, '') AS esp,
            COALESCE(i.esp_desc, '') AS esp_desc, COALESCE(i.esp_en_title, '') AS esp_en_title,
            COALESCE(i.esp_en_desc, '') AS esp_en_desc,
            COALESCE(i.aimbot_title, '') AS aimbot_title, COALESCE(i.aimbot, '') AS aimbot,
            COALESCE(i.aimbot_desc, '') AS aimbot_desc, COALESCE(i.aimbot_en_title, '') AS aimbot_en_title,
            COALESCE(i.aimbot_en_desc, '') AS aimbot_en_desc,
            COALESCE(i.misc_title, '') AS misc_title, COALESCE(i.misc, '') AS misc,
            COALESCE(i.misc_desc, '') AS misc_desc, COALESCE(i.misc_en_title, '') AS misc_en_title,
            COALESCE(i.misc_en_desc, '') AS misc_en_desc,
            COALESCE(i.loot_title, '') AS loot_title, COALESCE(i.loot, '') AS loot,
            COALESCE(i.loot_desc, '') AS loot_desc, COALESCE(i.loot_en_title, '') AS loot_en_title,
            COALESCE(i.loot_en_desc, '') AS loot_en_desc,
            COALESCE(i.visuals_title, '') AS visuals_title, COALESCE(i.visuals, '') AS visuals,
            COALESCE(i.visuals_desc, '') AS visuals_desc, COALESCE(i.visuals_en_title, '') AS visuals_en_title,
            COALESCE(i.visuals_en_desc, '') AS visuals_en_desc,
            COALESCE(c.id, 0) AS game_id, COALESCE(c.name, '') AS game_title
        FROM items i
        LEFT JOIN categories c
          ON substring(i."categoryData" from '"id"\\s*:\\s*([0-9]+)') = c.id::text
        ORDER BY i.id DESC
    """)).mappings().all()
    items = []
    for row in rows:
        item = dict(row)
        item["gallery"] = _item_gallery(
            item.get("gallery"),
            item.get("preview"),
            item.get("video"),
        )
        tariffs = parse_legacy_tariffs(item.pop("tabs"), item["prices"])
        raw_prices = deserialize_legacy_prices(item.pop("prices"))
        item["tariffs"] = []
        for tariff in tariffs:
            raw_index = tariff["id"] - 1
            item["tariffs"].append({
                "label": tariff["title"],
                "price": tariff["price"],
                "raw_price": raw_prices[raw_index] if raw_index < len(raw_prices) else None,
            })
        items.append(item)
    assignments = _feature_assignments_by_item(
        db,
        [item["id"] for item in items],
    )
    for item in items:
        item["feature_categories"] = assignments.get(item["id"], [])
    return items


@router.patch("/admin/items/{item_id}/visibility")
def update_admin_item_visibility(
    item_id: int,
    payload: ItemVisibilityInput,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    row = db.execute(text("""
        UPDATE items
        SET vis = :vis
        WHERE id = :item_id
        RETURNING id, vis
    """), {"item_id": item_id, "vis": payload.vis}).mappings().first()
    if not row:
        raise HTTPException(404, "Item not found")
    db.commit()
    return {"id": row["id"], "vis": row["vis"]}


@router.patch("/admin/items/{item_id}/security-status")
def update_admin_item_security_status(
    item_id: int,
    payload: ItemSecurityStatusInput,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    row = db.execute(text("""
        UPDATE items
        SET security_status = :security_status,
            undetected = :undetected
        WHERE id = :item_id
        RETURNING id, security_status
    """), {
        "item_id": item_id,
        "security_status": payload.security_status,
        "undetected": int(payload.security_status == 1),
    }).mappings().first()
    if not row:
        raise HTTPException(404, "Item not found")
    db.commit()
    return dict(row)


@router.put("/admin/items/{item_id}")
def update_admin_item(
    item_id: int,
    payload: LegacyItemCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    category = db.execute(text("""
        SELECT id, name, alias, parent
        FROM categories
        WHERE id = :game_id AND vis = 1 AND parent = 0
        LIMIT 1
    """), {"game_id": payload.game_id}).mappings().first()
    if not category:
        raise HTTPException(404, "Game not found")

    alias_exists = db.execute(
        text("SELECT 1 FROM items WHERE alias = :alias AND id != :item_id LIMIT 1"),
        {"alias": payload.alias, "item_id": item_id},
    ).first()
    if alias_exists:
        raise HTTPException(409, "Item alias already exists")

    category_data = json.dumps({
        "id": category["id"],
        "name": category["name"],
        "alias": category["alias"],
        "parent": category["parent"],
    }, ensure_ascii=False)
    tabs = json.dumps([tariff.label for tariff in payload.tariffs], ensure_ascii=False)
    prices = serialize_legacy_prices(payload.tariffs)
    min_price = min(tariff.price for tariff in payload.tariffs)
    values = payload.model_dump(exclude={"game_id", "tariffs"})
    values.update({
        "item_id": item_id,
        "category_data": category_data,
        "tabs": tabs,
        "prices": prices,
        "min_price": min_price,
        "undetected": int(payload.security_status == 1),
        "gallery": json.dumps(
            [media.model_dump() for media in payload.gallery],
            ensure_ascii=False,
        ),
    })

    result = db.execute(text("""
        UPDATE items SET
            "categoryData" = :category_data,
            name = :name, alias = :alias, systems = :systems, text = :text,
            instruction = :instruction, instruction_link = :instruction_link,
            advantages = :advantages, keys_text = :keys_text, preview = :preview,
            gallery = CAST(:gallery AS jsonb),
            characteristics = :characteristics, platforms = :platforms, video = :video,
            tabs = :tabs, prices = :prices, price = :min_price,
            status = :status, security_status = :security_status,
            vis = :vis, home = :home, top = :top, hit = :hit,
            undetected = :undetected, win10 = :win10, win11 = :win11, amd = :amd, intel = :intel,
            esp_title = :esp_title, esp = :esp, esp_desc = :esp_desc,
            esp_en_title = :esp_en_title, esp_en_desc = :esp_en_desc,
            aimbot_title = :aimbot_title, aimbot = :aimbot, aimbot_desc = :aimbot_desc,
            aimbot_en_title = :aimbot_en_title, aimbot_en_desc = :aimbot_en_desc,
            misc_title = :misc_title, misc = :misc, misc_desc = :misc_desc,
            misc_en_title = :misc_en_title, misc_en_desc = :misc_en_desc,
            loot_title = :loot_title, loot = :loot, loot_desc = :loot_desc,
            loot_en_title = :loot_en_title, loot_en_desc = :loot_en_desc,
            visuals_title = :visuals_title, visuals = :visuals, visuals_desc = :visuals_desc,
            visuals_en_title = :visuals_en_title, visuals_en_desc = :visuals_en_desc,
            seo_title = :seo_title, seo_description = :seo_description,
            seo_image = :seo_image, seo_noindex = :seo_noindex
        WHERE id = :item_id
        RETURNING id, name, alias, status, vis
    """), values).mappings().first()
    if not result:
        raise HTTPException(404, "Item not found")

    _save_feature_assignments(db, item_id, payload.feature_categories)
    db.commit()
    return dict(result)


@router.post("/items", status_code=201)
def create_legacy_item(
    payload: LegacyItemCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    category = db.execute(text("""
        SELECT id, name, alias, parent
        FROM categories
        WHERE id = :game_id AND vis = 1 AND parent = 0
        LIMIT 1
    """), {"game_id": payload.game_id}).mappings().first()
    if not category:
        raise HTTPException(404, "Game not found")

    alias_exists = db.execute(
        text("SELECT 1 FROM items WHERE alias = :alias LIMIT 1"),
        {"alias": payload.alias},
    ).first()
    if alias_exists:
        raise HTTPException(409, "Item alias already exists")

    category_data = json.dumps({
        "id": category["id"],
        "name": category["name"],
        "alias": category["alias"],
        "parent": category["parent"],
    }, ensure_ascii=False)
    tabs = json.dumps([tariff.label for tariff in payload.tariffs], ensure_ascii=False)
    prices = serialize_legacy_prices(payload.tariffs)
    min_price = min(tariff.price for tariff in payload.tariffs)
    gallery = json.dumps(
        [media.model_dump() for media in payload.gallery],
        ensure_ascii=False,
    )

    result = db.execute(text("""
        INSERT INTO items (
            "categoryData", name, alias, tabs, prices, systems, text,
            instruction, instruction_link, advantages, keys_text, preview,
            gallery, characteristics, platforms, video, status, vis, price,
            home, top, hit, undetected, security_status, win10, win11, amd, intel,
            esp_title, esp, esp_desc, aimbot_title, aimbot, aimbot_desc,
            misc_title, misc, misc_desc, loot_title, loot, loot_desc,
            visuals_title, visuals, visuals_desc, seo_title, seo_description,
            seo_image, seo_noindex,
            esp_en_title, esp_en_desc, aimbot_en_title, aimbot_en_desc,
            misc_en_title, misc_en_desc, loot_en_title, loot_en_desc,
            visuals_en_title, visuals_en_desc
        )
        VALUES (
            :category_data, :name, :alias, :tabs, :prices, :systems, :item_text,
            :instruction, :instruction_link, :advantages, :keys_text, :preview,
            CAST(:gallery AS jsonb), :characteristics, :platforms, :video, :status, :vis, :min_price,
            :home, :top, :hit, :undetected, :security_status, :win10, :win11, :amd, :intel,
            :esp_title, :esp, :esp_desc, :aimbot_title, :aimbot, :aimbot_desc,
            :misc_title, :misc, :misc_desc, :loot_title, :loot, :loot_desc,
            :visuals_title, :visuals, :visuals_desc, :seo_title, :seo_description,
            :seo_image, :seo_noindex,
            :esp_en_title, :esp_en_desc, :aimbot_en_title, :aimbot_en_desc,
            :misc_en_title, :misc_en_desc, :loot_en_title, :loot_en_desc,
            :visuals_en_title, :visuals_en_desc
        )
        RETURNING id, name, alias, status
    """), {
        "category_data": category_data,
        "name": payload.name,
        "alias": payload.alias,
        "seo_title": payload.seo_title,
        "seo_description": payload.seo_description,
        "seo_image": payload.seo_image,
        "seo_noindex": payload.seo_noindex,
        "tabs": tabs,
        "prices": prices,
        "systems": payload.systems,
        "item_text": payload.text,
        "instruction": payload.instruction,
        "instruction_link": payload.instruction_link,
        "advantages": payload.advantages,
        "keys_text": payload.keys_text,
        "preview": payload.preview,
        "gallery": gallery,
        "characteristics": payload.characteristics,
        "platforms": payload.platforms,
        "video": payload.video,
        "status": payload.status,
        "vis": payload.vis,
        "home": payload.home,
        "top": payload.top,
        "hit": payload.hit,
        "undetected": int(payload.security_status == 1),
        "security_status": payload.security_status,
        "win10": payload.win10,
        "win11": payload.win11,
        "amd": payload.amd,
        "intel": payload.intel,
        "esp_title": payload.esp_title,
        "esp": payload.esp,
        "esp_desc": payload.esp_desc,
        "esp_en_title": payload.esp_en_title,
        "esp_en_desc": payload.esp_en_desc,
        "aimbot_title": payload.aimbot_title,
        "aimbot": payload.aimbot,
        "aimbot_desc": payload.aimbot_desc,
        "aimbot_en_title": payload.aimbot_en_title,
        "aimbot_en_desc": payload.aimbot_en_desc,
        "misc_title": payload.misc_title,
        "misc": payload.misc,
        "misc_desc": payload.misc_desc,
        "misc_en_title": payload.misc_en_title,
        "misc_en_desc": payload.misc_en_desc,
        "loot_title": payload.loot_title,
        "loot": payload.loot,
        "loot_desc": payload.loot_desc,
        "loot_en_title": payload.loot_en_title,
        "loot_en_desc": payload.loot_en_desc,
        "visuals_title": payload.visuals_title,
        "visuals": payload.visuals,
        "visuals_desc": payload.visuals_desc,
        "visuals_en_title": payload.visuals_en_title,
        "visuals_en_desc": payload.visuals_en_desc,
        "min_price": min_price,
    }).mappings().one()

    _save_feature_assignments(db, result["id"], payload.feature_categories)
    db.commit()
    return dict(result)