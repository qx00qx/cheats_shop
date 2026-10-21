import logging
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database import get_db
from app.models import HomepageSetting, User
from app.storage import MAX_IMAGE_SIZE, UPLOADS_DIR, image_extension

logger = logging.getLogger(__name__)

router = APIRouter(tags=["homepage"])
HOMEPAGE_UPLOAD_DIR = UPLOADS_DIR / "homepage"


@router.get("/api/homepage/telegram-card")
def get_telegram_card_settings(db: Session = Depends(get_db)):
    setting = db.get(HomepageSetting, 1)
    return {
        "background_url": (
            setting.telegram_card_background_url if setting else None
        )
    }


@router.put("/api/admin/homepage/telegram-card")
async def upload_telegram_card_background(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    content = await image.read(MAX_IMAGE_SIZE + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Выберите изображение")
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Размер изображения не должен превышать 5 МБ")

    extension = image_extension(content)
    if extension is None:
        raise HTTPException(
            status_code=415,
            detail="Поддерживаются изображения PNG, JPEG и WebP",
        )

    HOMEPAGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    image_path = HOMEPAGE_UPLOAD_DIR / filename
    image_url = f"/uploads/homepage/{filename}"
    previous_url = None

    try:
        with image_path.open("xb") as uploaded_file:
            uploaded_file.write(content)

        setting = db.get(HomepageSetting, 1)
        if setting is None:
            setting = HomepageSetting(id=1)
            db.add(setting)

        previous_url = setting.telegram_card_background_url
        setting.telegram_card_background_url = image_url
        db.commit()
    except Exception:
        db.rollback()
        try:
            image_path.unlink(missing_ok=True)
        except OSError:
            logger.exception("Failed to remove homepage image after database error")
        raise
    finally:
        await image.close()

    if previous_url and previous_url.startswith("/uploads/homepage/"):
        previous_path = HOMEPAGE_UPLOAD_DIR / Path(previous_url).name
        if previous_path != image_path:
            try:
                previous_path.unlink(missing_ok=True)
            except OSError:
                logger.exception("Failed to remove replaced homepage background image")

    return {"background_url": image_url}
