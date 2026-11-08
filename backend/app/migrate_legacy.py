import argparse
import base64
import hashlib
import json
import os
import re
import secrets
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    MetaData,
    String,
    Table,
    URL,
    create_engine,
    inspect,
    select,
    text,
)
from sqlalchemy.engine import Connection, Engine, make_url
from sqlalchemy.dialects.postgresql import JSONB, insert as pg_insert
from sqlalchemy.schema import CreateSchema

import app.models as _models
from app.config import settings
from app.core.security import hash_password
from app.database import Base, engine as target_engine


BATCH_SIZE = 500
APP_DATA_TABLES = (
    "categories",
    "items",
    "users",
    "blog_categories",
    "blog",
)


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"$binary_base64": base64.b64encode(bytes(value)).decode("ascii")}
    return str(value)


def _json_value(value: Any) -> Any:
    return json.loads(json.dumps(value, default=_json_default))


def _source_key(row: dict[str, Any], primary_key: list[str], fallback: int) -> str:
    if primary_key:
        key_value = {column: row[column] for column in primary_key}
        return json.dumps(key_value, sort_keys=True, default=_json_default)
    canonical = json.dumps(row, sort_keys=True, default=_json_default)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"{digest}:{fallback}"


def _ensure_archive_tables(conn: Connection) -> tuple[Table, Table]:
    inspector = inspect(conn)
    if "legacy_archive" not in inspector.get_schema_names():
        conn.execute(CreateSchema("legacy_archive"))

    metadata = MetaData()
    source_tables = Table(
        "source_tables",
        metadata,
        Column("table_name", String(255), primary_key=True),
        Column("columns", JSONB, nullable=False),
        Column("source_row_count", BigInteger, nullable=False),
        Column("archived_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
        schema="legacy_archive",
    )
    rows = Table(
        "rows",
        metadata,
        Column("table_name", String(255), primary_key=True),
        Column("source_key", String(2000), primary_key=True),
        Column("row_data", JSONB, nullable=False),
        schema="legacy_archive",
    )
    metadata.create_all(conn)
    return source_tables, rows


def _archive_source_data(
    source_conn: Connection,
    target_conn: Connection,
    source_tables: Table,
    archive_rows: Table,
    table_names: list[str],
    source_schema: str,
) -> dict[str, int]:
    source_inspector = inspect(source_conn)
    archive_counts: dict[str, int] = {}

    for table_name in table_names:
        source_table = Table(
            table_name,
            MetaData(),
            schema=source_schema,
            autoload_with=source_conn,
        )
        primary_key = (
            source_inspector.get_pk_constraint(
                table_name,
                schema=source_schema,
            ).get("constrained_columns")
            or []
        )
        column_manifest = [
            {
                "name": column["name"],
                "type": str(column["type"]),
                "nullable": column["nullable"],
            }
            for column in source_inspector.get_columns(
                table_name,
                schema=source_schema,
            )
        ]
        row_count = source_conn.execute(
            select(text("count(*)")).select_from(source_table)
        ).scalar_one()

        source_tables_insert = pg_insert(source_tables).values(
            table_name=table_name,
            columns=column_manifest,
            source_row_count=row_count,
        )
        target_conn.execute(
            source_tables_insert.on_conflict_do_update(
                index_elements=[source_tables.c.table_name],
                set_={
                    "columns": source_tables_insert.excluded["columns"],
                    "source_row_count": source_tables_insert.excluded.source_row_count,
                    "archived_at": text("now()"),
                },
            )
        )

        statement = select(source_table)
        if primary_key:
            statement = statement.order_by(
                *(source_table.c[column] for column in primary_key)
            )
        result = source_conn.execution_options(
            stream_results=True,
            yield_per=BATCH_SIZE,
        ).execute(statement)

        batch: list[dict[str, Any]] = []
        archived = 0
        fallback_key = 0
        for source_row in result.mappings():
            row = dict(source_row)
            batch.append({
                "table_name": table_name,
                "source_key": _source_key(row, primary_key, fallback_key),
                "row_data": _json_value(row),
            })
            fallback_key += 1
            if len(batch) >= BATCH_SIZE:
                inserted = target_conn.execute(
                    pg_insert(archive_rows)
                    .values(batch)
                    .on_conflict_do_nothing()
                    .returning(archive_rows.c.source_key)
                )
                archived += len(inserted.fetchall())
                batch.clear()

        if batch:
            inserted = target_conn.execute(
                pg_insert(archive_rows)
                .values(batch)
                .on_conflict_do_nothing()
                .returning(archive_rows.c.source_key)
            )
            archived += len(inserted.fetchall())

        archive_counts[table_name] = archived

    return archive_counts


def _unique_slug(value: Any, row_id: Any, taken: set[str]) -> str:
    normalized = re.sub(r"[^a-z0-9_-]+", "-", str(value or "").strip().lower())
    normalized = normalized.strip("-_") or f"legacy-category-{row_id}"
    normalized = normalized[:64].rstrip("-_") or f"legacy-category-{row_id}"
    candidate = normalized
    if candidate in taken:
        suffix = f"-{row_id}"
        candidate = f"{normalized[:64 - len(suffix)].rstrip('-_')}{suffix}"
    counter = 2
    base = candidate
    while candidate in taken:
        suffix = f"-{counter}"
        candidate = f"{base[:64 - len(suffix)].rstrip('-_')}{suffix}"
        counter += 1
    taken.add(candidate)
    return candidate


def _existing_values(conn: Connection, table: Table, column_name: str) -> set[str]:
    if column_name not in table.c:
        return set()
    return {
        str(value).casefold()
        for value in conn.execute(select(table.c[column_name])).scalars()
        if value is not None
    }


def _insert_batches(
    conn: Connection,
    table: Table,
    rows: list[dict[str, Any]],
) -> int:
    inserted_count = 0
    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start:start + BATCH_SIZE]
        if not batch:
            continue
        statement = pg_insert(table).values(batch).on_conflict_do_nothing()
        primary_key = list(table.primary_key.columns)
        if primary_key:
            statement = statement.returning(*primary_key)
            inserted_count += len(conn.execute(statement).fetchall())
        else:
            result = conn.execute(statement)
            inserted_count += max(result.rowcount, 0)
    return inserted_count


def _copy_matching_table(
    source_conn: Connection,
    target_conn: Connection,
    table_name: str,
    source_schema: str,
) -> int:
    if table_name not in inspect(source_conn).get_table_names(schema=source_schema):
        return 0

    source_table = Table(
        table_name,
        MetaData(),
        schema=source_schema,
        autoload_with=source_conn,
    )
    target_table = Table(
        table_name,
        MetaData(),
        autoload_with=target_conn,
    )
    target_columns = set(target_table.c.keys())
    shared_columns = set(source_table.c.keys()) & target_columns
    if "id" not in shared_columns:
        raise RuntimeError(f"Cannot safely migrate {table_name}: no shared id column")

    result = source_conn.execution_options(
        stream_results=True,
        yield_per=BATCH_SIZE,
    ).execute(select(source_table).order_by(source_table.c.id))
    inserted = 0
    batch: list[dict[str, Any]] = []
    for source_row in result.mappings():
        row = {
            key: value
            for key, value in dict(source_row).items()
            if key in shared_columns
        }
        if table_name == "blog" and "seo_noindex" in target_columns:
            row["seo_noindex"] = bool(row.get("seo_noindex", False))
        batch.append(row)
        if len(batch) >= BATCH_SIZE:
            inserted += _insert_batches(target_conn, target_table, batch)
            batch.clear()
    if batch:
        inserted += _insert_batches(target_conn, target_table, batch)
    return inserted


def _copy_categories(
    source_conn: Connection,
    target_conn: Connection,
    source_schema: str,
) -> int:
    source_names = set(inspect(source_conn).get_table_names(schema=source_schema))
    if "categories" not in source_names:
        return 0

    source_table = Table(
        "categories",
        MetaData(),
        schema=source_schema,
        autoload_with=source_conn,
    )
    target_table = Table("categories", MetaData(), autoload_with=target_conn)
    source_columns = set(source_table.c.keys())
    target_columns = set(target_table.c.keys())
    taken_slugs = _existing_values(target_conn, target_table, "slug")
    result = source_conn.execution_options(
        stream_results=True,
        yield_per=BATCH_SIZE,
    ).execute(select(source_table).order_by(source_table.c.id))
    inserted = 0
    batch: list[dict[str, Any]] = []

    for source_row in result.mappings():
        source = dict(source_row)
        category: dict[str, Any] = {
            key: value
            for key, value in source.items()
            if key in source_columns & target_columns and key not in {"slug", "title"}
        }
        category["slug"] = _unique_slug(
            source.get("alias") or source.get("slug"),
            source.get("id"),
            taken_slugs,
        )
        category["title"] = (
            source.get("name")
            or source.get("title")
            or f"Legacy category {source.get('id')}"
        )
        batch.append(category)
        if len(batch) >= BATCH_SIZE:
            inserted += _insert_batches(target_conn, target_table, batch)
            batch.clear()
    if batch:
        inserted += _insert_batches(target_conn, target_table, batch)
    return inserted


def _gallery_from_legacy(row: dict[str, Any]) -> list[dict[str, str]]:
    gallery = row.get("gallery")
    if isinstance(gallery, str):
        try:
            gallery = json.loads(gallery)
        except json.JSONDecodeError:
            gallery = None
    if isinstance(gallery, list):
        return gallery

    result = []
    preview = row.get("preview")
    video = row.get("video")
    if isinstance(preview, str) and preview.strip():
        result.append({"type": "image", "url": preview.strip(), "alt": ""})
    if isinstance(video, str) and video.strip():
        result.append({"type": "video", "url": video.strip(), "alt": ""})
    return result


def _copy_items(
    source_conn: Connection,
    target_conn: Connection,
    source_schema: str,
) -> int:
    if "items" not in inspect(source_conn).get_table_names(schema=source_schema):
        return 0

    source_table = Table(
        "items",
        MetaData(),
        schema=source_schema,
        autoload_with=source_conn,
    )
    target_table = Table("items", MetaData(), autoload_with=target_conn)
    target_columns = set(target_table.c.keys())
    result = source_conn.execution_options(
        stream_results=True,
        yield_per=BATCH_SIZE,
    ).execute(select(source_table).order_by(source_table.c.id))
    inserted = 0
    batch: list[dict[str, Any]] = []

    for source_row in result.mappings():
        source = dict(source_row)
        item = {
            key: value
            for key, value in source.items()
            if key in target_columns
        }
        if "gallery" in target_columns:
            item["gallery"] = _gallery_from_legacy(source)
        if "security_status" in target_columns and not item.get("security_status"):
            item["security_status"] = 1 if source.get("undetected") == 1 else 2
        batch.append(item)
        if len(batch) >= BATCH_SIZE:
            inserted += _insert_batches(target_conn, target_table, batch)
            batch.clear()
    if batch:
        inserted += _insert_batches(target_conn, target_table, batch)
    return inserted


def _created_at(source: dict[str, Any]) -> datetime | None:
    for value in (source.get("timeAdd"), source.get("created_at")):
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, date):
            return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)
        if isinstance(value, (int, float)):
            try:
                return datetime.fromtimestamp(value, tz=timezone.utc)
            except (OverflowError, OSError, ValueError):
                continue
    return None


def _copy_users(
    source_conn: Connection,
    target_conn: Connection,
    source_schema: str,
) -> tuple[int, int]:
    if "users" not in inspect(source_conn).get_table_names(schema=source_schema):
        return 0, 0

    source_table = Table(
        "users",
        MetaData(),
        schema=source_schema,
        autoload_with=source_conn,
    )
    target_table = Base.metadata.tables["users"]
    used_emails = _existing_values(target_conn, target_table, "email")
    used_usernames = _existing_values(target_conn, target_table, "username")
    fallback_password_hash = hash_password(secrets.token_urlsafe(32))
    result = source_conn.execution_options(
        stream_results=True,
        yield_per=BATCH_SIZE,
    ).execute(select(source_table).order_by(source_table.c.id))
    inserted = 0
    reset_required = 0
    batch: list[dict[str, Any]] = []

    for source_row in result.mappings():
        source = dict(source_row)
        user_id = source.get("id")

        email = str(source.get("email") or "").strip()
        real_email = len(email) <= 255 and bool(
            re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)
        )
        email_key = email.casefold()
        if not real_email or email_key in used_emails:
            email = f"legacy-{user_id}@invalid.local"
            email_key = email.casefold()
            real_email = False
        used_emails.add(email_key)

        username = str(source.get("username") or "").strip()[:64]
        username_key = username.casefold()
        if not username or username_key in used_usernames:
            username = f"legacy-{user_id}"[:64]
            username_key = username.casefold()
        used_usernames.add(username_key)

        password_hash = str(source.get("password_hash") or "")
        if not password_hash.startswith(("$argon2", "$2a$", "$2b$", "$2y$")):
            password_hash = fallback_password_hash
            reset_required += 1

        status = source.get("status")
        try:
            is_active = real_email and (status is None or int(status) == 1)
        except (TypeError, ValueError):
            is_active = False

        batch.append({
            "id": user_id,
            "email": email,
            "username": username,
            "password_hash": password_hash,
            "balance": str(source.get("balance") or "0")[:32],
            "discount_percent": 0,
            "is_active": is_active,
            "is_admin": False,
            "totp_secret": None,
            "token_version": 0,
            "created_at": _created_at(source),
        })
        if len(batch) >= BATCH_SIZE:
            inserted += _insert_batches(target_conn, target_table, batch)
            batch.clear()
    if batch:
        inserted += _insert_batches(target_conn, target_table, batch)
    return inserted, reset_required


def _set_id_sequence(conn: Connection, table_name: str) -> None:
    if table_name not in inspect(conn).get_table_names():
        return
    columns = {column["name"] for column in inspect(conn).get_columns(table_name)}
    if "id" not in columns:
        return
    conn.execute(text(
        f"SELECT setval("
        f"pg_get_serial_sequence('{table_name}', 'id'), "
        f"COALESCE((SELECT MAX(id) FROM \"{table_name}\"), 1), "
        f"EXISTS (SELECT 1 FROM \"{table_name}\")"
        f")"
    ))


def _source_row_counts(
    source_conn: Connection,
    table_names: list[str],
    source_schema: str,
) -> dict[str, int]:
    counts = {}
    for table_name in table_names:
        source_table = Table(
            table_name,
            MetaData(),
            schema=source_schema,
            autoload_with=source_conn,
        )
        counts[table_name] = source_conn.execute(
            select(text("count(*)")).select_from(source_table)
        ).scalar_one()
    return counts


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Archive and migrate legacy Millex data into PostgreSQL."
    )
    parser.add_argument(
        "--source-database",
        help="Name of a PostgreSQL database containing the restored legacy dump.",
    )
    parser.add_argument(
        "--source-url",
        help="SQLAlchemy URL for a separate source database.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the migration. Without this flag, only inspect and report.",
    )
    return parser


def main() -> None:
    args = _parser().parse_args()
    target_url = make_url(settings.DATABASE_URL)
    if args.source_url:
        source_url = make_url(args.source_url)
    elif args.source_database:
        source_url = target_url.set(database=args.source_database)
    else:
        mysql_password = os.getenv("LEGACY_MYSQL_PASSWORD")
        if not mysql_password:
            raise RuntimeError(
                "Set LEGACY_MYSQL_PASSWORD in the project .env or pass "
                "--source-url / --source-database."
            )
        source_url = URL.create(
            "mysql+pymysql",
            username=os.getenv("LEGACY_MYSQL_USER", "root"),
            password=mysql_password,
            host=os.getenv("LEGACY_MYSQL_HOST", "legacy-db"),
            port=int(os.getenv("LEGACY_MYSQL_PORT", "3306")),
            database=os.getenv("LEGACY_MYSQL_DATABASE", "millex"),
        )

    source_schema = (
        source_url.database
        if source_url.get_backend_name() == "mysql"
        else "public"
    )
    if (
        source_url.get_backend_name() == target_url.get_backend_name()
        and source_url.host == target_url.host
        and source_url.database == target_url.database
    ):
        raise RuntimeError("Source database must be separate from the target database.")

    source_engine: Engine = create_engine(source_url, pool_pre_ping=True)
    try:
        with source_engine.connect() as source_conn:
            source_tables = sorted(
                inspect(source_conn).get_table_names(schema=source_schema)
            )
            if not source_tables:
                raise RuntimeError(
                    f"No tables found in source database "
                    f"{source_url.database!r} (schema {source_schema!r})."
                )
            source_counts = _source_row_counts(
                source_conn,
                source_tables,
                source_schema,
            )

            with target_engine.connect() as target_conn:
                target_tables = set(inspect(target_conn).get_table_names())
                required = set(Base.metadata.tables) | {"items"}
                missing = sorted(required - target_tables)
                if missing:
                    raise RuntimeError(
                        "Target schema is incomplete. Run "
                        "'python -m app.create_schema' first. Missing: "
                        + ", ".join(missing)
                    )

            print(f"Source database: {source_url.database}")
            print(f"Source type: {source_url.get_backend_name()}")
            print(f"Source tables: {len(source_tables)}")
            print(f"Source rows: {sum(source_counts.values())}")
            for table_name in APP_DATA_TABLES:
                if table_name in source_counts:
                    print(f"  {table_name}: {source_counts[table_name]} rows")
            if "categories" in source_counts:
                print(
                    "  Note: legacy game pages are stored in 'categories'; "
                    "these rows are migrated from that table."
                )
            if not args.apply:
                print(
                    "Dry run only: no rows were written. Re-run with --apply "
                    "to archive and migrate."
                )
                return

            with target_engine.begin() as target_conn:
                source_metadata, archive_rows = _ensure_archive_tables(target_conn)
                archived = _archive_source_data(
                    source_conn,
                    target_conn,
                    source_metadata,
                    archive_rows,
                    source_tables,
                    source_schema,
                )
                migrated: dict[str, int] = {}
                migrated["categories"] = _copy_categories(
                    source_conn,
                    target_conn,
                    source_schema,
                )
                migrated["items"] = _copy_items(
                    source_conn,
                    target_conn,
                    source_schema,
                )
                migrated["users"], reset_required = _copy_users(
                    source_conn,
                    target_conn,
                    source_schema,
                )
                migrated["blog_categories"] = _copy_matching_table(
                    source_conn,
                    target_conn,
                    "blog_categories",
                    source_schema,
                )
                migrated["blog"] = _copy_matching_table(
                    source_conn,
                    target_conn,
                    "blog",
                    source_schema,
                )
                for table_name in ("categories", "items", "users", "blog_categories", "blog"):
                    _set_id_sequence(target_conn, table_name)

            print("Migration committed.")
            print(f"Archived rows: {sum(archived.values())}")
            for table_name, count in migrated.items():
                print(f"  inserted {table_name}: {count}")
            print(f"Users requiring a password reset: {reset_required}")
            print(
                "Legacy admin accounts were not granted current admin privileges; "
                "review and grant those separately."
            )
            print(
                "Other legacy tables and rows are preserved in "
                "legacy_archive.rows as JSONB."
            )
    finally:
        source_engine.dispose()


if __name__ == "__main__":
    main()
