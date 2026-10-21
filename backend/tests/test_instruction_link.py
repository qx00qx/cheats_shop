import pytest
from pydantic import ValidationError

from app.api.routes.catalog import LegacyItemCreate


def test_instruction_link_normalizes_relative_blog_paths():
    assert LegacyItemCreate.normalize_instruction_link("/blog/manual-next") == (
        "/blog/manual-next"
    )
    assert LegacyItemCreate.normalize_instruction_link("blogs/manual-next/") == (
        "/blog/manual-next"
    )


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://millex.xyz/blogs/manual-next", "/blog/manual-next"),
        ("https://www.millex.market/blog/manual-next", "/blog/manual-next"),
    ],
)
def test_instruction_link_converts_legacy_millex_urls_to_site_path(value, expected):
    assert LegacyItemCreate.normalize_instruction_link(value) == expected


def test_instruction_link_rejects_external_domains():
    with pytest.raises(ValidationError):
        LegacyItemCreate(
            name="Example",
            alias="example",
            game_id=1,
            tariffs=[{"label": "1 day", "price": 10}],
            instruction_link="https://example.com/blog/manual-next",
        )


def test_instruction_link_allows_being_cleared():
    assert LegacyItemCreate.normalize_instruction_link("  ") is None
