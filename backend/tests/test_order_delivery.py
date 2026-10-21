from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Game, Key, Order, OrderItem, Product, ProductPlan, User, BotOrder
from app.services.order_delivery import (
    fulfill_bot_order,
    fulfill_store_order,
    sync_store_order_item_delivery,
)
import app.services.order_delivery as delivery_service


def make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine, Session(engine, autoflush=False)


def make_order(db):
    game = Game(slug="cs2", title="CS2")
    user = User(
        email="buyer@example.test",
        username="buyer",
        password_hash="hash",
        balance="1000",
    )
    db.add_all([game, user])
    db.flush()
    product = Product(slug="test-product", title="Test product", game_id=game.id)
    db.add(product)
    db.flush()
    plan = ProductPlan(product_id=product.id, label="30 дней", price=100)
    db.add(plan)
    db.flush()
    order = Order(
        user_id=user.id,
        status="paid",
        total=100,
        payment_method="balance",
    )
    db.add(order)
    db.flush()
    item = OrderItem(
        order_id=order.id,
        product_id=product.id,
        plan_id=plan.id,
        qty=1,
        price=100,
    )
    db.add(item)
    db.commit()
    return user, order, item


def test_store_order_uses_stock_key_and_marks_order_complete():
    engine, db = make_session()
    try:
        user, order, item = make_order(db)
        stock_key = Key(item_alias="test-product", key_value="LICENSE-123", status="free")
        db.add(stock_key)
        db.commit()
        db.refresh(order)

        assert fulfill_store_order(db, order, user) is True
        db.commit()
        db.refresh(order)
        db.refresh(item)

        assert order.status == "completed"
        assert order.key_value == "LICENSE-123"
        assert item.delivered_qty == 1
        assert db.get(Key, stock_key.id).status == "used"
    finally:
        db.close()
        engine.dispose()


def test_store_order_falls_back_to_bot_and_completes_after_manual_key(monkeypatch):
    engine, db = make_session()
    try:
        user, order, item = make_order(db)
        monkeypatch.setattr(delivery_service, "_next_bot_order_id", lambda session: 7001)

        assert fulfill_store_order(db, order, user) is False
        db.commit()
        bot_order = db.query(BotOrder).filter_by(external_order_id=7001).one()
        assert order.status == "paid_no_stock"
        assert bot_order.source_order_id == order.id
        assert bot_order.source_order_item_id == item.id

        db.add(Key(item_alias="test-product", key_value="MANUAL-456", status="free"))
        db.commit()
        assert fulfill_bot_order(db, bot_order) == "MANUAL-456"
        sync_store_order_item_delivery(db, bot_order)
        db.commit()
        db.refresh(order)

        assert bot_order.status == "completed"
        assert order.status == "completed"
        assert order.key_value == "MANUAL-456"
    finally:
        db.close()
        engine.dispose()
