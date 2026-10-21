from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, Game
from app.schemas import ProductShort, ProductFull, ProductCreate
from app.api.deps import get_current_admin

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductShort])
def list_products(
    game: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = 60,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Product).filter(Product.is_active == True)  # noqa: E712
    if game:
        q = q.join(Game).filter(Game.slug == game)
    if search:
        q = q.filter(Product.title.ilike(f"%{search}%"))
    return q.order_by(Product.id.desc()).offset(offset).limit(limit).all()


@router.get("/{slug}", response_model=ProductFull)
def get_product(slug: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.slug == slug, Product.is_active == True).first()  # noqa: E712
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@router.post("", response_model=ProductFull, status_code=201)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    # Проверка уникальности slug
    existing = db.query(Product).filter(Product.slug == payload.slug).first()
    if existing:
        raise HTTPException(400, "Product with this slug already exists")

    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product