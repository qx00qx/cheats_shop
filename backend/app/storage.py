from pathlib import Path

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
MAX_IMAGE_SIZE = 5 * 1024 * 1024
IMAGE_SIGNATURES = (
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"\xff\xd8\xff", ".jpg"),
)


def image_extension(content: bytes) -> str | None:
    for signature, extension in IMAGE_SIGNATURES:
        if content.startswith(signature):
            return extension
    if (
        len(content) >= 12
        and content.startswith(b"RIFF")
        and content[8:12] == b"WEBP"
    ):
        return ".webp"
    return None
