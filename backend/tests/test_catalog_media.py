from app.api.routes.catalog import _item_gallery


def test_item_gallery_uses_legacy_preview_when_gallery_is_empty():
    gallery = _item_gallery([], "/uploads/preview.jpg", None)

    assert gallery == [{
        "type": "image",
        "url": "/uploads/preview.jpg",
        "alt": "",
    }]


def test_item_gallery_preserves_video_first_and_adds_legacy_screenshot():
    gallery = _item_gallery(
        [{"type": "video", "url": "/uploads/demo.mp4", "alt": ""}],
        "/uploads/preview.jpg",
    )

    assert gallery == [
        {"type": "video", "url": "/uploads/demo.mp4", "alt": ""},
        {"type": "image", "url": "/uploads/preview.jpg", "alt": ""},
    ]
