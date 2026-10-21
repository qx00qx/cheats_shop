import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrdersAPI, Order } from "../api/orders";
import { useAuth } from "../store/auth";
import { formatDate, formatPrice } from "../utils/format";

export default function OrdersPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!user) return void nav("/login");
    OrdersAPI.list().then(setOrders).catch(() => {});
    }, [user, nav]);

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <h1 className="page-title">Мои заказы</h1>

      {orders.length === 0 ? (
        <div className="muted">Заказов пока нет.</div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Заказ #{o.id}</span>
              <span className={`status-${o.status}`}>{o.status}</span>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              {o.payment_method} · {formatPrice(o.total)} · {formatDate(o.created_at)}
            </div>
            {o.platega_url && o.status === "pending" && (
              <a
                href={o.platega_url}
                className="btn-primary"
                style={{ marginTop: 10, display: "inline-block" }}
              >
                Перейти к оплате
              </a>
            )}
          </div>
        ))
      )}
    </div>
  );
}