from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Product, Review
from app.schemas import ReviewIn, ReviewOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/products", tags=["reviews"])


@router.get("/{slug}/reviews", response_model=list[ReviewOut])
def product_reviews(slug: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.slug == slug).first()
    if not p:
        raise HTTPException(404, "Product not found")
    return db.query(Review).filter(Review.product_id == p.id).order_by(Review.created_at.desc()).all()


@router.post("/{slug}/reviews", response_model=ReviewOut, status_code=201)
def add_review(
    slug: str,
    payload: ReviewIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    p = db.query(Product).filter(Product.slug == slug).first()
    if not p:
        raise HTTPException(404, "Product not found")

    r = Review(product_id=p.id, user_id=user.id, rating=payload.rating, text=payload.text)
    db.add(r)
    db.flush()

    avg, cnt = (
        db.query(func.avg(Review.rating), func.count(Review.id))
        .filter(Review.product_id == p.id)
        .first()
    )
    p.rating = float(avg or 5)
    p.reviews_count = int(cnt or 0)
    db.commit()
    db.refresh(r)
    return r