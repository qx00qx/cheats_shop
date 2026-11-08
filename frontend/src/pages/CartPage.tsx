import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { useCart } from "../store/cart";
import { formatPrice } from "../utils/format";
import { useAuth } from "../store/auth";
import { getCheatPromotion } from "../api/catalog";
import {
  applyDiscount,
  getCheatDiscountPercent,
  type CheatPromotion,
} from "../utils/cheatPromotion";

export default function CartPage() {
  const { items, remove, clear } = useCart();
  const { user } = useAuth();
  const [promotion, setPromotion] = useState<CheatPromotion | null>(null);

  useEffect(() => {
    getCheatPromotion()
      .then(setPromotion)
      .catch((error: unknown) => {
        console.error("Failed to load cart promotion:", error);
      });
  }, []);

  const discountPercent = getCheatDiscountPercent(
    user?.discount_percent,
    promotion?.active ? promotion.discount_percent : 0,
    promotion?.ends_at,
  );
  const promotionActive = Boolean(
    promotion?.active && Date.now() < new Date(promotion.ends_at).getTime(),
  );
  const displayedTotal = items.reduce(
    (sum, item) => sum + applyDiscount(item.price * item.qty, discountPercent),
    0,
  );

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <Seo title="Корзина" noIndex />
      <h1 className="page-title">Корзина</h1>

      {items.length === 0 ? (
        <div className="muted">
          Корзина пуста. <Link to="/catalog">Перейти в каталог</Link>
        </div>
      ) : (
        <>
          {items.map((i) => (
            <div key={i.planId} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <b>{i.title}</b>
                  <div className="muted">
                    {i.planLabel} × {i.qty}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {discountPercent > 0 && (
                    <div className="price-old">{formatPrice(i.price * i.qty)}</div>
                  )}
                  <div className="rating">
                    {formatPrice(applyDiscount(i.price * i.qty, discountPercent))}
                  </div>
                  <button className="btn-ghost" onClick={() => remove(i.planId)}>
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 20 }}>
                Итого: <b className="rating">{formatPrice(displayedTotal)}</b>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={clear}>
                  Очистить
                </button>
                <Link to="/checkout" className="btn-primary">
                  Оформить
                </Link>
              </div>
            </div>
            {discountPercent > 0 && (
              <p className="muted" style={{ marginTop: 8 }}>
                {promotionActive ? "Акционная скидка" : "Накопительная скидка"}: {discountPercent}%
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}