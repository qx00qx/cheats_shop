from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import orders as orders_route
from app.database import Base, get_db
from app.main import app
from app.models import Game, Key, Product, ProductPlan, User, Order, BotOrder
import app.services.order_delivery as delivery_service


def make_order_client(monkeypatch, *, with_stock_key):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = session_factory()
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
    if with_stock_key:
        db.add(Key(item_alias=product.slug, key_value="LICENSE-123", status="free"))
    db.commit()
    user_id, product_id, plan_id = user.id, product.id, plan.id
    db.close()

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id)
    monkeypatch.setattr(orders_route.settings, "SMTP_HOST", "smtp.example.test")
    monkeypatch.setattr(orders_route.settings, "SMTP_FROM_EMAIL", "shop@example.test")
    monkeypatch.setattr(
        delivery_service,
        "_next_bot_order_id",
        lambda session: 7001,
    )
    return (
        engine,
        session_factory,
        TestClient(app),
        previous,
        product_id,
        plan_id,
        user_id,
    )


def test_balance_purchase_assigns_key_and_increases_discount(monkeypatch):
    engine, session_factory, client, previous, product_id, plan_id, user_id = (
        make_order_client(monkeypatch, with_stock_key=True)
    )
    try:
        response = client.post("/api/orders", json={
            "items": [{"product_id": product_id, "plan_id": plan_id, "qty": 1}],
            "payment_method": "balance",
        })

        assert response.status_code == 201
        assert response.json()["status"] == "completed"
        assert response.json()["key_value"] == "LICENSE-123"
        with session_factory() as db:
            user = db.get(User, user_id)
            order = db.query(Order).one()
            stock_key = db.query(Key).one()
            assert user.discount_percent == 1
            assert user.balance == "900.0"
            assert order.email_sent_at is None
            assert stock_key.status == "used"
            assert db.query(BotOrder).count() == 0
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_balance_purchase_queues_manual_telegram_fallback_when_out_of_stock(monkeypatch):
    engine, session_factory, client, previous, product_id, plan_id, user_id = (
        make_order_client(monkeypatch, with_stock_key=False)
    )
    try:
        response = client.post("/api/orders", json={
            "items": [{"product_id": product_id, "plan_id": plan_id, "qty": 1}],
            "payment_method": "balance",
        })

        assert response.status_code == 201
        assert response.json()["status"] == "paid_no_stock"
        with session_factory() as db:
            order = db.query(Order).one()
            bot_order = db.query(BotOrder).one()
            assert order.status == "paid_no_stock"
            assert bot_order.status == "new"
            assert bot_order.source_order_id == order.id
            assert bot_order.source_order_item_id == order.items[0].id
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()
