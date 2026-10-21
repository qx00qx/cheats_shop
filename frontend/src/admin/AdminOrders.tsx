import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

type AdminOrder = {
  source: "store" | "catalog";
  id: number;
  status: string;
  total: string | number | null;
  payment_method: string | null;
  created_at: string | null;
  user_id: number | null;
  email: string | null;
  product: string | null;
  period: string | null;
  game: string | null;
  promo_code: string | null;
  transaction_id: string | null;
};

type OrdersResponse = {
  items: AdminOrder[];
  total: number;
  page: number;
  page_size: number;
};

const PAGE_SIZE = 25;

const statusLabels: Record<string, string> = {
  pending: "Ожидает оплаты",
  pending_payment: "Ожидает оплаты",
  new: "Оплачен / ожидает выдачи",
  paid: "Оплачен",
  completed: "Выполнен",
  paid_no_stock: "Оплачен, нет ключа",
  failed: "Ошибка",
  chargeback: "Возврат / чарджбэк",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadOrders = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get<OrdersResponse>("/admin/orders", {
          params: {
            page,
            page_size: PAGE_SIZE,
            source,
            status: status || undefined,
            q: appliedSearch || undefined,
          },
        });
        if (active) {
          setOrders(response.data.items);
          setTotal(response.data.total);
        }
      } catch (loadError) {
        console.error("Failed to load admin orders:", loadError);
        if (active) {
          setOrders([]);
          setTotal(0);
          setError("Не удалось загрузить заказы. Проверьте права доступа и попробуйте снова.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadOrders();
    return () => {
      active = false;
    };
  }, [page, source, status, appliedSearch]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU");
  };

  const formatTotal = (value: string | number | null) => {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? `${amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`
      : "—";
  };

  return (
    <div>
      <h1 className="page-title">Заказы</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Всего заказов: {total}</p>

      <form
        onSubmit={handleSearch}
        className="admin-orders__filters"
      >
        <input
          aria-label="Поиск заказов"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ID, товар, email"
          style={{
            minWidth: 0,
            padding: "10px 12px",
            color: "#fff",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
          }}
        />
        <select
          aria-label="Источник заказов"
          value={source}
          onChange={(event) => {
            setPage(1);
            setSource(event.target.value);
          }}
          style={{ padding: "10px 12px", color: "#fff", background: "#171717", borderRadius: 8 }}
        >
          <option value="all">Все источники</option>
          <option value="store">Магазин</option>
          <option value="catalog">Каталог / аккаунты</option>
        </select>
        <select
          aria-label="Статус заказа"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          style={{ padding: "10px 12px", color: "#fff", background: "#171717", borderRadius: 8 }}
        >
          <option value="">Все статусы</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
        <button className="btn-ghost" type="submit">Найти</button>
      </form>

      {error && <p role="alert" style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>}

      <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["ID", "Источник", "Товар", "Пользователь", "Сумма", "Оплата", "Статус", "Дата"].map((heading) => (
                <th key={heading} style={{ padding: "12px 16px", color: "rgba(255,255,255,0.7)" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: "center" }}>Загрузка...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: "center" }}>
                {error ? "Список недоступен" : "Заказы не найдены"}
              </td></tr>
            ) : orders.map((order) => (
              <tr key={`${order.source}-${order.id}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: "12px 16px" }}>#{order.id}</td>
                <td style={{ padding: "12px 16px" }}>{order.source === "catalog" ? "Каталог" : "Магазин"}</td>
                <td style={{ padding: "12px 16px" }}>
                  {order.product || order.game || "Заказ"}
                  {order.period && <div className="muted" style={{ fontSize: 12 }}>{order.period}</div>}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {order.email || (order.user_id ? `ID ${order.user_id}` : "Гость")}
                </td>
                <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>{formatTotal(order.total)}</td>
                <td style={{ padding: "12px 16px" }}>{order.payment_method || "—"}</td>
                <td style={{ padding: "12px 16px" }}>{statusLabels[order.status] || order.status}</td>
                <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>{formatDate(order.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
        <button className="btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
          Назад
        </button>
        <span className="muted">Страница {page} · Показано {orders.length} из {total}</span>
        <button
          className="btn-ghost"
          disabled={page * PAGE_SIZE >= total || loading}
          onClick={() => setPage((current) => current + 1)}
        >
          Далее
        </button>
      </div>
    </div>
  );
}
