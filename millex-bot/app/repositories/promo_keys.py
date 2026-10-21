from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Key


@dataclass
class KeyStats:
    total: int
    free: int
    used: int


async def add_key(
    session: AsyncSession,
    *,
    item_alias: str,
    key_value: str,
    added_by_tg_id: int | None = None,
    item_id: int | None = None,
) -> Key:
    item_alias = item_alias.strip()
    key_value = key_value.strip()

    exists = await session.scalar(
        select(Key).where(Key.key_value == key_value)
    )
    if exists:
        raise ValueError("DUPLICATE_KEY")

    obj = Key(
        item_alias=item_alias,
        item_id=item_id,
        key_value=key_value,
        status="free",
        added_by_tg_id=added_by_tg_id,
    )
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


async def add_promo_key(
    session: AsyncSession,
    *,
    item_alias: str,
    key_value: str,
    added_by_tg_id: int | None = None,
    item_id: int | None = None,
) -> Key:
    return await add_key(
        session,
        item_alias=item_alias,
        key_value=key_value,
        added_by_tg_id=added_by_tg_id,
        item_id=item_id,
    )


async def get_keys_stats(session: AsyncSession) -> KeyStats:
    total = await session.scalar(select(func.count(Key.id))) or 0
    free = await session.scalar(
        select(func.count(Key.id)).where(Key.status == "free")
    ) or 0
    used = await session.scalar(
        select(func.count(Key.id)).where(Key.status == "used")
    ) or 0

    return KeyStats(total=total, free=free, used=used)


async def list_recent_keys(
    session: AsyncSession,
    *,
    limit: int = 10,
) -> list[Key]:
    result = await session.execute(
        select(Key).order_by(Key.id.desc()).limit(limit)
    )
    return list(result.scalars().all())

async def get_free_key_by_alias(session, item_alias: str):
    stmt = (
        select(Key)
        .where(
            Key.item_alias == item_alias,
            Key.status == "free"
        )
        .order_by(Key.id.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def reserve_free_key(
    session: AsyncSession,
    *,
    item_alias: str,
    used_by_tg_id: int | None = None,
) -> Key | None:

    async with session.begin():
        result = await session.execute(
            select(Key)
            .where(
                Key.item_alias == item_alias,
                Key.status == "free",
            )
            .order_by(Key.id.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )

        key = result.scalars().first()
        if key is None:
            return None

        key.status = "used"
        key.used_by_tg_id = used_by_tg_id
        key.used_at = datetime.now(timezone.utc)

    return key

    