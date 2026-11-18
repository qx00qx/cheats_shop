import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


SEO_COLUMNS = (
    "id",
    "url",
    "title",
    "title_en",
    "description",
    "description_en",
    "keywords",
    "h1",
    "h1_en",
    "text",
    "text_en",
)

FIXED_PAGE_PATHS = {
    "/": "home",
    "/catalog": "catalog",
    "/accounts": "accounts",
    "/blog": "blog",
    "/blogs": "blog",
    "/privacy": "privacy",
    "/cookie": "cookie",
    "/user-agreement": "user-agreement",
}

SEO_FIELD_MAP = {
    "seo_title": "title",
    "seo_description": "description",
    "seo_h1": "h1",
    "seo_text": "seo_text",
}

SEO_SCHEMA_COLUMNS = {
    "seo_pages": {
        "h1": "VARCHAR(255) NOT NULL DEFAULT ''",
        "seo_text": "TEXT NOT NULL DEFAULT ''",
    },
    "categories": {
        "seo_title": "VARCHAR(255)",
        "seo_description": "TEXT",
        "seo_h1": "VARCHAR(255)",
        "seo_text": "TEXT",
    },
    "items": {
        "seo_title": "VARCHAR(255)",
        "seo_description": "TEXT",
        "seo_h1": "VARCHAR(255)",
        "seo_text": "TEXT",
    },
    "blog": {
        "meta_title": "VARCHAR(255) NOT NULL DEFAULT ''",
        "meta_description": "TEXT",
        "seo_h1": "VARCHAR(255)",
        "seo_text": "TEXT",
    },
}


@dataclass(frozen=True)
class LegacySeoEntry:
    url: str
    title: str
    description: str
    h1: str
    seo_text: str


def _read_sql_value(sql: str, index: int) -> tuple[str | None, int]:
    if sql[index] == "'":
        index += 1
        value: list[str] = []
        escapes = {
            "0": "\0",
            "b": "\b",
            "n": "\n",
            "r": "\r",
            "t": "\t",
            "Z": "\x1a",
        }
        while index < len(sql):
            char = sql[index]
            if char == "\\" and index + 1 < len(sql):
                next_char = sql[index + 1]
                value.append(escapes.get(next_char, next_char))
                index += 2
            elif char == "'":
                if index + 1 < len(sql) and sql[index + 1] == "'":
                    value.append("'")
                    index += 2
                else:
                    return "".join(value), index + 1
            else:
                value.append(char)
                index += 1
        raise ValueError("Unterminated quoted value in legacy SEO dump")

    end = index
    while end < len(sql) and sql[end] not in ",)":
        end += 1
    value = sql[index:end].strip()
    return (None if value.upper() == "NULL" else value), end


def parse_legacy_seo_sql(sql: str) -> list[LegacySeoEntry]:
    marker = "INSERT INTO `seo` VALUES"
    marker_index = sql.find(marker)
    if marker_index < 0:
        raise ValueError("The SQL dump does not contain an INSERT for the seo table")

    index = marker_index + len(marker)
    entries: list[LegacySeoEntry] = []
    while index < len(sql):
        while index < len(sql) and sql[index].isspace():
            index += 1
        if index >= len(sql) or sql[index] == ";":
            break
        if sql[index] == ",":
            index += 1
            continue
        if sql[index] != "(":
            index += 1
            continue

        index += 1
        values: list[str | None] = []
        while index < len(sql):
            while index < len(sql) and sql[index].isspace():
                index += 1
            value, index = _read_sql_value(sql, index)
            values.append(value)
            while index < len(sql) and sql[index].isspace():
                index += 1
            if index < len(sql) and sql[index] == ",":
                index += 1
                continue
            if index < len(sql) and sql[index] == ")":
                index += 1
                break
            raise ValueError("Malformed row in legacy SEO dump")

        if len(values) != len(SEO_COLUMNS):
            raise ValueError(
                f"Expected {len(SEO_COLUMNS)} columns in a legacy SEO row; "
                f"got {len(values)}"
            )
        row = dict(zip(SEO_COLUMNS, values))
        if row["url"]:
            entries.append(LegacySeoEntry(
                url=row["url"],
                title=row["title"] or "",
                description=row["description"] or "",
                h1=row["h1"] or "",
                seo_text=row["text"] or "",
            ))

    if not entries:
        raise ValueError("The SQL dump contains no SEO rows")
    return entries


def load_legacy_seo_dump(path: Path) -> list[LegacySeoEntry]:
    return parse_legacy_seo_sql(path.read_text(encoding="utf-8-sig"))


def _source_fields(entry: LegacySeoEntry) -> dict[str, str]:
    return {
        target: value.strip()
        for target, attribute in SEO_FIELD_MAP.items()
        if (value := getattr(entry, attribute)).strip()
    }


def _table_columns(connection: Connection, table_name: str) -> set[str]:
    return {column["name"] for column in inspect(connection).get_columns(table_name)}


def _ensure_seo_columns(connection: Connection, table_name: str) -> None:
    columns = _table_columns(connection, table_name)
    for column, sql_type in SEO_SCHEMA_COLUMNS[table_name].items():
        if column not in columns:
            connection.execute(text(
                f"ALTER TABLE {table_name} ADD COLUMN {column} {sql_type}"
            ))


def _update_if_empty(
    connection: Connection,
    table_name: str,
    key_column: str,
    key_value: str | int,
    fields: dict[str, str],
) -> bool:
    if not fields:
        return False
    assignments = ", ".join(
        f"{column} = COALESCE(NULLIF(TRIM({column}), ''), :{column})"
        for column in fields
    )
    result = connection.execute(
        text(
            f"UPDATE {table_name} SET {assignments} "
            f"WHERE {key_column} = :lookup_key"
        ),
        {**fields, "lookup_key": key_value},
    )
    return result.rowcount > 0


def _import_fixed_page(
    connection: Connection,
    page_key: str,
    entry: LegacySeoEntry,
) -> bool:
    fields = {
        key: value.strip()
        for key, value in {
            "title": entry.title,
            "description": entry.description,
            "h1": entry.h1,
            "seo_text": entry.seo_text,
        }.items()
        if value.strip()
    }
    if not fields:
        return False

    if _update_if_empty(connection, "seo_pages", "page_key", page_key, fields):
        return True

    existing = connection.execute(
        text("SELECT 1 FROM seo_pages WHERE page_key = :page_key"),
        {"page_key": page_key},
    ).first()
    if existing:
        return False

    connection.execute(text("""
        INSERT INTO seo_pages (page_key, title, description, h1, seo_text, image, noindex)
        VALUES (
            :page_key, :title, :description, :h1, :seo_text, '', FALSE
        )
    """), {
        "page_key": page_key,
        "title": fields.get("title", ""),
        "description": fields.get("description", ""),
        "h1": fields.get("h1", ""),
        "seo_text": fields.get("seo_text", ""),
    })
    return True


def _read_category_data(value: object) -> tuple[str | None, str | None]:
    if isinstance(value, dict):
        category_id = value.get("id")
        alias = value.get("alias")
        return (
            str(category_id) if category_id is not None else None,
            str(alias) if alias is not None else None,
        )
    if not isinstance(value, str):
        return None, None

    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        parsed = None
    if isinstance(parsed, dict):
        category_id = parsed.get("id")
        alias = parsed.get("alias")
        return (
            str(category_id) if category_id is not None else None,
            str(alias) if alias is not None else None,
        )

    id_match = re.search(r'"id"\s*:\s*"?([0-9]+)"?', value)
    alias_match = re.search(r'"alias"\s*:\s*"([^"]+)"', value)
    return (
        id_match.group(1) if id_match else None,
        alias_match.group(1) if alias_match else None,
    )


def _import_item(
    connection: Connection,
    alias: str,
    game_alias: str | None,
    fields: dict[str, str],
) -> bool:
    if not fields:
        return False
    candidates = connection.execute(
        text('SELECT id, "categoryData" FROM items WHERE alias = :alias'),
        {"alias": alias},
    ).mappings().all()
    if not candidates:
        return False

    matching = candidates
    if game_alias and len(candidates) > 1:
        game = connection.execute(
            text("SELECT id FROM categories WHERE alias = :alias"),
            {"alias": game_alias},
        ).first()
        if game:
            game_id = str(game[0])
            matching = [
                candidate
                for candidate in candidates
                if _read_category_data(candidate["categoryData"])
                in {(game_id, game_alias), (game_id, None), (None, game_alias)}
            ]
        else:
            matching = [
                candidate for candidate in candidates
                if _read_category_data(candidate["categoryData"])[1] == game_alias
            ]
        if not matching and len(candidates) == 1:
            matching = candidates

    if len(matching) != 1:
        return False
    return _update_if_empty(
        connection, "items", "id", matching[0]["id"], fields,
    )


def import_legacy_seo_entries(
    connection: Connection,
    entries: list[LegacySeoEntry],
) -> dict[str, int]:
    inspector = inspect(connection)
    for table_name in ("seo_pages", "categories", "items"):
        if not inspector.has_table(table_name):
            raise RuntimeError(f"The current database is missing the {table_name} table")
    for table_name in ("seo_pages", "categories", "items"):
        _ensure_seo_columns(connection, table_name)
    has_blog = inspector.has_table("blog")
    if has_blog:
        _ensure_seo_columns(connection, "blog")
    for table_name in ("categories", "items"):
        if "alias" not in _table_columns(connection, table_name):
            raise RuntimeError(f"The {table_name} table is missing the alias column")

    counts = {"fixed_pages": 0, "games": 0, "items": 0, "articles": 0, "unmatched": 0}
    for entry in entries:
        path = "/" + entry.url.strip().strip("/")
        if path in FIXED_PAGE_PATHS:
            counts["fixed_pages"] += int(
                _import_fixed_page(connection, FIXED_PAGE_PATHS[path], entry)
            )
            continue

        segments = [segment for segment in path.split("/") if segment]
        fields = _source_fields(entry)
        if not fields:
            continue
        imported = False

        if len(segments) == 2 and segments[0] == "catalog":
            imported = _update_if_empty(
                connection, "categories", "alias", segments[1], fields,
            )
            if imported:
                counts["games"] += 1
            else:
                imported = _import_item(
                    connection, segments[1], None, fields,
                )
                if imported:
                    counts["items"] += 1
        elif len(segments) >= 3 and segments[0] == "catalog":
            imported = _import_item(
                connection, segments[-1], segments[-2], fields,
            )
            if imported:
                counts["items"] += 1
        elif len(segments) == 2 and segments[0] in {"blog", "blogs"} and has_blog:
            blog_fields = {
                target: value for target, value in fields.items()
                if target in {"seo_h1", "seo_text"}
            }
            if "seo_title" in fields:
                blog_fields["meta_title"] = fields["seo_title"]
            if "seo_description" in fields:
                blog_fields["meta_description"] = fields["seo_description"]
            imported = _update_if_empty(
                connection, "blog", "alias", segments[1], blog_fields,
            )
            if imported:
                counts["articles"] += 1

        if not imported:
            counts["unmatched"] += 1

    return counts


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import legacy SEO metadata into the current PostgreSQL database."
    )
    parser.add_argument("--dump", required=True, type=Path, help="Path to the old millex.sql dump")
    args = parser.parse_args()

    from app.database import engine

    entries = load_legacy_seo_dump(args.dump)
    with engine.begin() as connection:
        counts = import_legacy_seo_entries(connection, entries)
    print(f"Processed {len(entries)} legacy SEO records: {counts}")


if __name__ == "__main__":
    main()
