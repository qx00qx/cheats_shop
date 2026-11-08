import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../store/cart";
import { OrdersAPI } from "../api/orders";
import PaymentMethodSelector, { PaymentMethod } from "../components/PaymentMethodSelector";
import { formatPrice } from "../utils/format";
import { useAuth } from "../store/auth";
import { getCheatPromotion } from "../api/catalog";
import type { CheatPromotion } from "../utils/cheatPromotion";
import { getCheatDiscountPercent } from "../utils/cheatPromotion";

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const { user, loadMe } = useAuth();
  const nav = useNavigate();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);
  const [promotion, setPromotion] = useState<CheatPromotion | null>(null);
  const [promotionLoaded, setPromotionLoaded] = useState(false);
  const [promotionError, setPromotionError] = useState(false);

  useEffect(() => {
    getCheatPromotion()
      .then(setPromotion)
      .catch((error: unknown) => {
        console.error("Failed to load checkout promotion:", error);
        setPromotionError(true);
      })
      .finally(() => setPromotionLoaded(true));
  }, []);

  const discountPercent = getCheatDiscountPercent(
    user?.discount_percent,
    promotion?.active ? promotion.discount_percent : 0,
    promotion?.ends_at,
  );
  const isPromotionActive = Boolean(
    promotion?.active && Date.now() < new Date(promotion.ends_at).getTime(),
  );
  const discountedTotal = items.reduce(
    (sum, item) =>
      sum + Math.round(item.price * item.qty * (100 - discountPercent)) / 100,
    0
  );

  async function submit() {
    if (items.length === 0) return nav("/catalog");
    setBusy(true);
    try {
      const order = await OrdersAPI.create({
        items: items.map((i) => ({
          product_id: i.productId,
          plan_id: i.planId,
          qty: i.qty,
        })),
        payment_method: method,
        promo_code: promo || null,
      });

      await loadMe();
      clear();

      if (order.platega_url) {
        window.location.href = order.platega_url;
      } else {
        nav("/profile");
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Ошибка оформления");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 32, maxWidth: 720 }}>
      <h1 className="page-title">Оформление заказа</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        {items.map((i) => (
          <div key={i.planId} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              {i.title} — {i.planLabel} × {i.qty}
            </span>
            <span className="rating">
              {formatPrice(Math.round(i.price * i.qty * (100 - discountPercent)) / 100)}
            </span>
          </div>
        ))}
        <hr style={{ borderColor: "var(--border-color)", margin: "12px 0" }} />
        {discountPercent > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span>{isPromotionActive ? "Акционная скидка" : "Накопительная скидка"}</span>
            <span className="rating">{discountPercent}%</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <b>Итого</b>
          <b className="rating">{formatPrice(discountPercent ? discountedTotal : total())}</b>
        </div>
      </div>

      <div className="card">
        {promotionError && (
          <p role="alert">
            Не удалось проверить условия акции. Обновите страницу перед оплатой.
          </p>
        )}
        <div className="payment-title" style={{ marginBottom: 12 }}>
          Способ оплаты
        </div>
        <PaymentMethodSelector value={method} onChange={setMethod} />

        <input
          className="promo-input"
          placeholder="Промокод"
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
          style={{ marginTop: 12 }}
        />

        <button className="purchase-btn" style={{ marginTop: 16 }} onClick={submit} disabled={busy || !promotionLoaded || promotionError}>
          {busy ? "Оформляем…" : !promotionLoaded ? "Проверяем скидку…" : "Оплатить"}
        </button>
      </div>
    </div>
  );
}