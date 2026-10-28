import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { OrdersAPI, Order } from "../api/orders";
import AccountLayout from "../components/AccountLayout";

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<number | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await OrdersAPI.getMyOrders();
      setOrders(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка загрузки заказов");
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "Ожидает оплаты",
      pending_payment: "Ожидает оплаты",
      new: "В обработке",
      paid: "Оплачен",
      paid_no_stock: "Оплачен, ключ готовится",
      completed: "Ключ выдан",
      cancelled: "Отменен",
      failed: "Ошибка оплаты",
      chargeback: "Платеж возвращен",
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      pending: "status-pending",
      paid: "status-paid",
      cancelled: "status-cancelled",
      failed: "status-failed",
    };
    return classMap[status] || "";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const downloadAccountFile = async (orderId: number) => {
    setDownloadError(null);
    setDownloadingOrderId(orderId);
    try {
      const response = await api.get(`/accounts/purchases/${orderId}/download`, {
        responseType: "blob",
      });
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `millex-account-${orderId}.exe`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      console.error("Failed to download account purchase:", requestError);
      setDownloadError("Не удалось скачать файл. Попробуйте позже или обратитесь в поддержку.");
    } finally {
      setDownloadingOrderId(null);
    }
  };

  if (loading) {
    return (
      <AccountLayout activeSection="history">
        <h1 className="lk-card-title">История покупок</h1>
        {downloadError && <div className="error" role="alert">{downloadError}</div>}
        <p className="muted">Загрузка...</p>
      </AccountLayout>
    );
  }

  if (error) {
    return (
      <AccountLayout activeSection="history">
        <h1 className="lk-card-title">История покупок</h1>
        <div className="error">{error}</div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout activeSection="history">
      <h1 className="lk-card-title">История покупок</h1>

      {orders.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
          }}
        >
          <p style={{ color: "white" }}>
            Вы еще не совершали покупки на сайте
          </p>
          <Link to="/catalog" className="btn-primary" style={{ marginTop: 24, display: "inline-flex" }}>
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {orders.map((order) => (
            <div
              key={`${order.source}-${order.id}`}
              style={{
                padding: "20px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <strong style={{ fontSize: 16 }}>Заказ #{order.id}</strong>
                  {order.product && (
                    <p style={{ margin: "6px 0 0", color: "white" }}>
                      {order.product}{order.period ? ` · ${order.period}` : ""}
                    </p>
                  )}

              {order.status === "completed" && order.key_value && !order.delivery_file_available && (
                <div style={{ marginTop: 16 }}>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                    Ключ выдан
                  </div>
                  <code
                    style={{
                      display: "block",
                      padding: 12,
                      background: "rgba(0, 0, 0, 0.25)",
                      borderRadius: 6,
                      overflowWrap: "anywhere",
                      userSelect: "all",
                    }}
                  >
                    {order.key_value}
                  </code>
                </div>
              )}
              {order.delivery_file_available && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: 12, fontSize: 13, padding: "8px 16px" }}
                  disabled={downloadingOrderId === order.id}
                  onClick={() => void downloadAccountFile(order.id)}
                >
                  {downloadingOrderId === order.id ? "Подготавливаем файл…" : "Скачать файл аккаунта"}
                </button>
              )}
                  <p style={{ fontSize: 13, marginTop: 4, color: "white" }}>
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <div
                  className={`order-status ${getStatusClass(order.status)}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {getStatusText(order.status)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div>
                  <span className="muted" style={{ fontSize: 13 }}>
                    Сумма:
                  </span>{" "}
                  <strong style={{ fontSize: 16 }}>
                    {order.total} ₽
                  </strong>
                </div>
                {order.status === "pending" && order.platega_url && (
                  <a
                    href={order.platega_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ fontSize: 13, padding: "8px 16px" }}
                  >
                    Оплатить
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountLayout>
  );
}
