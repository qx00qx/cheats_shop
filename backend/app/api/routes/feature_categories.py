from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database import get_db
from app.models import CheatFeatureAssignment, CheatFeatureCategory, User

router = APIRouter(prefix="/api/catalog/admin/feature-categories", tags=["catalog"])


class FeatureCategoryInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)


@router.get("")
def list_feature_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return [
        {"id": category.id, "title": category.title}
        for category in db.query(CheatFeatureCategory).order_by(
            CheatFeatureCategory.title
        )
    ]


@router.post("", status_code=201)
def create_feature_category(
    payload: FeatureCategoryInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Название категории обязательно")

    category = CheatFeatureCategory(title=title)
    db.add(category)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Категория с таким названием уже существует",
        ) from exc

    db.refresh(category)
    return {"id": category.id, "title": category.title}


@router.put("/{category_id}")
def update_feature_category(
    category_id: int,
    payload: FeatureCategoryInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Название категории обязательно")

    category = db.get(CheatFeatureCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Категория не найдена")

    category.title = title
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Категория с таким названием уже существует",
        ) from exc
    return {"id": category.id, "title": category.title}


@router.delete("/{category_id}", status_code=204)
def delete_feature_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    category = db.get(CheatFeatureCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Категория не найдена")

    assigned = (
        db.query(CheatFeatureAssignment.id)
        .filter(CheatFeatureAssignment.category_id == category_id)
        .first()
    )
    if assigned:
        raise HTTPException(
            status_code=409,
            detail="Сначала удалите категорию у всех читов",
        )

    db.delete(category)
    db.commit()
