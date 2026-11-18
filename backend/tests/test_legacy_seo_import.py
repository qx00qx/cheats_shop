from sqlalchemy import create_engine, text

from app.services.legacy_seo_import import (
    LegacySeoEntry,
    import_legacy_seo_entries,
    parse_legacy_seo_sql,
)


def test_parse_legacy_seo_insert_values():
    sql = r"""
    INSERT INTO `seo` VALUES
    (1,'/catalog/eft','Title','Title EN','Description','Description EN',
    'keywords','H1','H1 EN','<p>Text\'s \ncontent</p>','');
    """

    entries = parse_legacy_seo_sql(sql)

    assert entries == [
        LegacySeoEntry(
            url="/catalog/eft",
            title="Title",
            description="Description",
            h1="H1",
            seo_text="<p>Text's \ncontent</p>",
        )
    ]


def test_import_matches_routes_and_preserves_existing_seo_values():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE seo_pages (
                page_key TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
                h1 TEXT NOT NULL, seo_text TEXT NOT NULL, image TEXT NOT NULL,
                noindex BOOLEAN NOT NULL
            )
        """))
        connection.execute(text("""
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY, alias TEXT UNIQUE, seo_title TEXT,
                seo_description TEXT
            )
        """))
        connection.execute(text("""
            CREATE TABLE items (
                id INTEGER PRIMARY KEY, alias TEXT, "categoryData" TEXT,
                seo_title TEXT, seo_description TEXT
            )
        """))
        connection.execute(text("CREATE TABLE blog (alias TEXT PRIMARY KEY)"))
        connection.execute(text("""
            INSERT INTO categories (id, alias, seo_title)
            VALUES (1, 'eft', 'Current title'), (2, 'dayz', '')
        """))
        connection.execute(text("""
            INSERT INTO items (id, alias, "categoryData")
            VALUES
                (10, 'product', '{"id": 1, "alias": "eft"}'),
                (11, 'product', '{"id": 2, "alias": "dayz"}')
        """))
        connection.execute(text("INSERT INTO blog (alias) VALUES ('article')"))

        entries = [
            LegacySeoEntry(
                url="/catalog/eft",
                title="Legacy title",
                description="Legacy description",
                h1="Game H1",
                seo_text="<p>Game text</p>",
            ),
            LegacySeoEntry(
                url="/catalog/eft/product",
                title="Product title",
                description="Product description",
                h1="Product H1",
                seo_text="<p>Product text</p>",
            ),
            LegacySeoEntry(
                url="/",
                title="Home title",
                description="Home description",
                h1="Home H1",
                seo_text="",
            ),
            LegacySeoEntry(
                url="/blog/article",
                title="Article title",
                description="Article description",
                h1="Article H1",
                seo_text="<p>Article text</p>",
            ),
        ]

        counts = import_legacy_seo_entries(connection, entries)

        game = connection.execute(
            text("SELECT * FROM categories WHERE alias = 'eft'")
        ).mappings().one()
        item = connection.execute(
            text("SELECT * FROM items WHERE id = 10")
        ).mappings().one()
        other_item = connection.execute(
            text("SELECT * FROM items WHERE id = 11")
        ).mappings().one()
        home = connection.execute(
            text("SELECT * FROM seo_pages WHERE page_key = 'home'")
        ).mappings().one()
        article = connection.execute(
            text("SELECT * FROM blog WHERE alias = 'article'")
        ).mappings().one()

        assert counts == {
            "fixed_pages": 1,
            "games": 1,
            "items": 1,
            "articles": 1,
            "unmatched": 0,
        }
        assert game["seo_title"] == "Current title"
        assert game["seo_description"] == "Legacy description"
        assert game["seo_h1"] == "Game H1"
        assert game["seo_text"] == "<p>Game text</p>"
        assert item["seo_h1"] == "Product H1"
        assert item["seo_text"] == "<p>Product text</p>"
        assert other_item["seo_h1"] is None
        assert home["h1"] == "Home H1"
        assert article["meta_title"] == "Article title"
        assert article["meta_description"] == "Article description"
        assert article["seo_h1"] == "Article H1"
        assert article["seo_text"] == "<p>Article text</p>"

        import_legacy_seo_entries(connection, [
            LegacySeoEntry(
                url="/catalog/eft",
                title="Replacement title",
                description="Replacement description",
                h1="Replacement H1",
                seo_text="<p>Replacement text</p>",
            )
        ])
        game = connection.execute(
            text("SELECT * FROM categories WHERE alias = 'eft'")
        ).mappings().one()
        assert game["seo_h1"] == "Game H1"
        assert game["seo_text"] == "<p>Game text</p>"
    engine.dispose()
