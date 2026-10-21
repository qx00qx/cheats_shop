import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { useCart } from "../store/cart";
import { formatPrice } from "../utils/format";

export default function CartPage() {
  const { items, remove, clear, total } = useCart();

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
                  <div className="rating">{formatPrice(i.price * i.qty)}</div>
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
                Итого: <b className="rating">{formatPrice(total())}</b>
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
          </div>
        </>
      )}
    </div>
  );
}