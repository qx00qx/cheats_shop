from fastapi import APIRouter, Query
from sqlalchemy import text

from app.db import SessionMaker

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/users")
async def list_users(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
):
    where = []
    params: dict[str, object] = {
        "limit": limit,
        "offset": offset,
    }

    if q:
        where.append("""
            (
                email ILIKE :q
                OR username ILIKE :q
                OR name ILIKE :q
            )
        """)
        params["q"] = f"%{q}%"

    where_sql = ""
    if where:
        where_sql = "WHERE " + " AND ".join(where)

    sql = text(f"""
        SELECT
            id,
            email,
            COALESCE(username, '') AS username,
            COALESCE(name, '') AS name,
            COALESCE(balance, '0') AS balance,
            COALESCE(balance_eu, '0') AS balance_eu,
            is_admin,
            is_active,
            moderate,
            "timeAdd" AS created_at
        FROM users
        {where_sql}
        ORDER BY "timeAdd" DESC NULLS LAST, id DESC
        LIMIT :limit OFFSET :offset
    """)

    async with SessionMaker() as session:
        result = await session.execute(sql, params)
        rows = result.mappings().all()

    return [dict(row) for row in rows]