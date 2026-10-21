import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ProductsAPI, ProductFull, Plan } from "../api/products";
import { OrdersAPI } from "../api/orders";
import { useAuth } from "../store/auth";

import FeaturesGrid from "../components/FeaturesGrid";
import PricingOption from "../components/PricingOption";
import PaymentMethodSelector, { PaymentMethod } from "../components/PaymentMethodSelector";
import { ProductDetail } from "../components/ProductDetail";
import { Comments } from "../components/Comments";

export default function ProductPage() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<ProductFull | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ProductsAPI.get(slug).then((p) => {
      setProduct(p);
      setPlanId(p.plans[0]?.id ?? null);
    });
  }, [slug]);

  const selectedPlan: Plan | undefined = useMemo(
    () => product?.plans.find((p) => p.id === planId),
    [product, planId]
  );

  async function buy() {
    if (!user) return nav("/login");
    if (!product || !selectedPlan) return;
    setBusy(true);
    try {
      const order = await OrdersAPI.create({
        items: [{ product_id: product.id, plan_id: selectedPlan.id, qty: 1 }],
        payment_method: method,
        promo_code: promo || null,
      });

      if (order.platega_url) {
        window.location.href = order.platega_url;
      } else {
        nav("/profile");
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Ошибка создания заказа");
    } finally {
      setBusy(false);
    }
  }

  if (!product) return <div className="container" style={{ padding: 60 }}>Загрузка…</div>;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="product-layout">
        <div className="product-main">
          <div className="product-hero">
            <div className="product-badge">{product.game.title}</div>
            <h1 className="product-title">{product.title}</h1>
            {product.subtitle && <p className="product-description">{product.subtitle}</p>}
          </div>

          {!!product.features?.length && <FeaturesGrid features={product.features} />}

          <div className="reviews-block">
            <h3 className="section-title">Отзывы</h3>
            <div className="reviews-summary">
              <div className="rating-large">{Number(product.rating).toFixed(1)}</div>
              <div className="rating-details">
                <div className="stars">★★★★★</div>
                <div className="reviews-count">
                  На основе <span>{product.reviews_count}</span> отзывов
                </div>
              </div>
            </div>
          </div>

          {/* Новые компоненты */}
          <ProductDetail
            id={product.id.toString()}
            name={product.title}
            price={selectedPlan?.price || 0}
            description={product.subtitle || undefined}
            image={product.image}
            screenshots={product.screenshots || []}
            characteristics={product.requirements || undefined}
            onAddToCart={(qty) => console.log("Add to cart:", qty)}
            onBuyOneClick={(data) => console.log("Buy one click:", data)}
          />

          <Comments
            productId={product.id.toString()}
            addCommentEndpoint="/ajax/addcomment"
            addReviewEndpoint="/ajax/additemreview"
          />
        </div>

        <aside className="product-sidebar">
          <div className="sticky-sidebar">
            <div className="purchase-block">
              <div className="purchase-title">Покупка</div>
              <div className="purchase-subtitle">Выберите тариф</div>

              <div className="pricing-options">
                {product.plans.map((p) => (
                  <PricingOption
                    key={p.id}
                    plan={p}
                    active={planId === p.id}
                    onSelect={() => setPlanId(p.id)}
                  />
                ))}
              </div>

              <div className="purchase-form">
                <input
                  className="promo-input"
                  placeholder="Промокод"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                />

                <div className="payment-section">
                  <div className="payment-title">Способ оплаты</div>
                  <PaymentMethodSelector value={method} onChange={setMethod} />
                </div>

                <button className="purchase-btn" onClick={buy} disabled={busy}>
                  {busy
                    ? "Создаём заказ…"
                    : `Купить${selectedPlan ? ` за ${selectedPlan.price} ₽` : ""}`}
                </button>
              </div>
            </div>

            {product.requirements && Object.keys(product.requirements).length > 0 && (
              <div className="requirements-block">
                <div className="requirements-title">Требования</div>
                <div className="requirements-content">
                  {Object.entries(product.requirements).map(([k, v]) => (
                    <div key={k} className="requirement-item">
                      <div className="requirement-label">{k}</div>
                      <div className="requirement-value">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}