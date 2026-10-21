import logging
import os
import re
import shutil
from pathlib import Path
from tempfile import gettempdir
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from app.api.deps import get_current_admin
from app.models import User
from app.storage import MAX_IMAGE_SIZE, UPLOADS_DIR, image_extension

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/uploads", tags=["admin uploads"])
VIDEO_UPLOAD_DIR = UPLOADS_DIR / "videos"
VIDEO_CHUNKS_DIR = Path(gettempdir()) / "millex-video-uploads"
MAX_VIDEO_SIZE = 500 * 1024 * 1024
VIDEO_CHUNK_SIZE = 512 * 1024
MAX_VIDEO_CHUNKS = (MAX_VIDEO_SIZE + VIDEO_CHUNK_SIZE - 1) // VIDEO_CHUNK_SIZE
GAME_COVER_UPLOAD_DIR = UPLOADS_DIR / "game-covers"
VIDEO_SIGNATURES = {
    ".mp4": lambda content: len(content) >= 8 and content[4:8] == b"ftyp",
    ".webm": lambda content: content.startswith(b"\x1aE\xdf\xa3"),
    ".ogg": lambda content: content.startswith(b"OggS"),
    ".ogv": lambda content: content.startswith(b"OggS"),
}


class FinalizeVideoUpload(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    total_chunks: int = Field(..., ge=1, le=MAX_VIDEO_CHUNKS)


@router.post("/images/game-covers")
async def upload_game_cover(
    image: UploadFile = File(...),
    _: User = Depends(get_current_admin),
):
    try:
        content = await image.read(MAX_IMAGE_SIZE + 1)
        if not content:
            raise HTTPException(status_code=400, detail="Выберите изображение")
        if len(content) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Размер изображения не должен превышать 5 МБ",
            )

        extension = image_extension(content)
        if extension is None:
            raise HTTPException(
                status_code=415,
                detail="Поддерживаются изображения PNG, JPEG и WebP",
            )

        GAME_COVER_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid4().hex}{extension}"
        image_path = GAME_COVER_UPLOAD_DIR / filename
        try:
            with image_path.open("xb") as uploaded_file:
                uploaded_file.write(content)
        except OSError as exc:
            logger.exception("Failed to store uploaded game cover")
            raise HTTPException(
                status_code=500,
                detail="Не удалось сохранить изображение",
            ) from exc

        return {
            "url": f"/uploads/game-covers/{filename}",
            "size": len(content),
        }
    finally:
        await image.close()


def _video_filename(original_filename: str) -> tuple[str, str]:
    basename = re.split(r"[/\\]", original_filename)[-1]
    suffix = Path(basename).suffix.lower()
    if suffix not in VIDEO_SIGNATURES:
        raise HTTPException(
            status_code=415,
            detail="Поддерживаются видео MP4, WebM и OGG",
        )

    stem = Path(basename).stem
    safe_stem = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-_")[:100]
    if not safe_stem:
        safe_stem = "video"
    return f"{safe_stem}-{uuid4().hex}{suffix}", suffix


@router.put("/videos/chunks/{upload_id}/{chunk_index}")
async def upload_video_chunk(
    upload_id: UUID,
    chunk_index: int,
    total_chunks: int,
    request: Request,
    _: User = Depends(get_current_admin),
):
    if total_chunks < 1 or total_chunks > MAX_VIDEO_CHUNKS:
        raise HTTPException(status_code=400, detail="Недопустимое количество частей видео")
    if chunk_index < 0 or chunk_index >= total_chunks:
        raise HTTPException(status_code=400, detail="Недопустимый номер части видео")

    upload_dir = VIDEO_CHUNKS_DIR / str(upload_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = upload_dir / f"{chunk_index:04d}.chunk"
    temporary_path = upload_dir / f".{chunk_index:04d}.{uuid4().hex}.tmp"
    chunk_size = 0

    try:
        with temporary_path.open("xb") as chunk_file:
            async for data in request.stream():
                chunk_size += len(data)
                if chunk_size > VIDEO_CHUNK_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Размер части видео превышает допустимый лимит",
                    )
                chunk_file.write(data)

        if chunk_size == 0:
            raise HTTPException(status_code=400, detail="Получена пустая часть видео")
        os.replace(temporary_path, chunk_path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise

    return {"chunk_index": chunk_index, "received_bytes": chunk_size}


@router.post("/videos/finalize/{upload_id}")
def finalize_video_upload(
    upload_id: UUID,
    payload: FinalizeVideoUpload,
    _: User = Depends(get_current_admin),
):
    upload_dir = VIDEO_CHUNKS_DIR / str(upload_id)
    if not upload_dir.is_dir():
        raise HTTPException(status_code=400, detail="Части видео не найдены; загрузите видео заново")

    filename, suffix = _video_filename(payload.filename)
    signature_check = VIDEO_SIGNATURES[suffix]
    VIDEO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    video_path = VIDEO_UPLOAD_DIR / filename
    temporary_video_path = VIDEO_UPLOAD_DIR / f".{filename}.{uuid4().hex}.tmp"
    total_size = 0
    first_chunk = True

    try:
        with temporary_video_path.open("xb") as output_file:
            for chunk_index in range(payload.total_chunks):
                chunk_path = upload_dir / f"{chunk_index:04d}.chunk"
                if not chunk_path.is_file():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Не загружена часть видео {chunk_index + 1}",
                    )
                with chunk_path.open("rb") as chunk_file:
                    chunk_signature = chunk_file.read(VIDEO_CHUNK_SIZE)
                    total_size += len(chunk_signature)
                    if first_chunk and not signature_check(chunk_signature):
                        raise HTTPException(
                            status_code=415,
                            detail="Содержимое файла не соответствует формату видео",
                        )
                    first_chunk = False
                    output_file.write(chunk_signature)

                    while data := chunk_file.read(VIDEO_CHUNK_SIZE):
                        total_size += len(data)
                        output_file.write(data)
                        if total_size > MAX_VIDEO_SIZE:
                            raise HTTPException(
                                status_code=413,
                                detail="Размер видео не должен превышать 500 МБ",
                            )

                    if total_size > MAX_VIDEO_SIZE:
                        raise HTTPException(
                            status_code=413,
                            detail="Размер видео не должен превышать 500 МБ",
                        )
                chunk_path.unlink()

        if total_size == 0:
            raise HTTPException(status_code=400, detail="Выберите видеофайл")

        os.replace(temporary_video_path, video_path)
    except Exception:
        temporary_video_path.unlink(missing_ok=True)
        raise
    finally:
        try:
            shutil.rmtree(upload_dir)
        except OSError:
            logger.exception("Failed to remove temporary video chunks")

    return {
        "filename": filename,
        "url": f"/uploads/videos/{filename}",
        "size": total_size,
    }


@router.delete("/videos/chunks/{upload_id}")
def cancel_video_upload(
    upload_id: UUID,
    _: User = Depends(get_current_admin),
):
    upload_dir = VIDEO_CHUNKS_DIR / str(upload_id)
    try:
        shutil.rmtree(upload_dir, ignore_errors=False)
    except FileNotFoundError:
        pass
    except OSError as exc:
        logger.exception("Failed to remove cancelled video upload")
        raise HTTPException(status_code=500, detail="Не удалось очистить временную загрузку") from exc
    return {"ok": True}
