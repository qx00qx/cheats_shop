import { useState, useEffect } from "react";
import { api } from "../api/client";

type DashboardStats = {
  total_users: number;
  total_orders: number;
  total_revenue: number | null;
};

type RevenueByPeriod = {
  today: number | null;
  month: number | null;
  year: number | null;
};

type DashboardUser = {
  id: number;
  email: string | null;
  username: string | null;
  balance: number;
  created_at: string | null;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueByPeriod, setRevenueByPeriod] = useState<RevenueByPeriod | null>(null);
  const [recentUsers, setRecentUsers] = useState<DashboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const results = await Promise.allSettled([
      api.get<DashboardStats>("/auth/stats"),
      api.get<RevenueByPeriod>("/auth/revenue-by-period"),
      api.get<DashboardUser[]>("/auth/recent-users"),
    ]);
    const errors: string[] = [];

    if (results[0].status === "fulfilled") {
      setStats(results[0].value.data);
    } else {
      console.error("Failed to load dashboard stats:", results[0].reason);
      errors.push("Не удалось загрузить общую статистику.");
    }

    if (results[1].status === "fulfilled") {
      setRevenueByPeriod(results[1].value.data);
    } else {
      console.error("Failed to load dashboard revenue:", results[1].reason);
      errors.push("Не удалось загрузить выручку по периодам.");
    }

    if (results[2].status === "fulfilled") {
      setRecentUsers(results[2].value.data);
    } else {
      console.error("Failed to load dashboard users:", results[2].reason);
      errors.push("Не удалось загрузить последних пользователей.");
    }

    setLoadErrors(errors);
    setLoading(false);
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

  const formatRevenue = (amount: number | null) =>
    amount === null ? "Недоступно" : `${amount.toLocaleString("ru-RU")} ₽`;

  return (
    <div>
      <h1 className="page-title">Дашборд</h1>
      {loadErrors.length > 0 && (
        <div role="alert" style={{ color: "#ff8a8a", marginBottom: 16 }}>
          {loadErrors.map((message) => <p key={message}>{message}</p>)}
        </div>
      )}

      {loading ? (
        <p className="muted">Загрузка...</p>
      ) : (
        <>
          {/* Общая статистика */}
          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, marginBottom: 32 }}>
              <div
                style={{
                  padding: "24px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                }}
              >
                <div className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
                  Всего пользователей
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#00ff94" }}>
                  {stats.total_users}
                </div>
              </div>

              <div
                style={{
                  padding: "24px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                }}
              >
                <div className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
                  Всего заказов
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#00ff94" }}>
                  {stats.total_orders}
                </div>
              </div>

              <div
                style={{
                  padding: "24px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                }}
              >
                <div className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
                  Общая выручка
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#00ff94" }}>
                  {formatRevenue(stats.total_revenue)}
                </div>
              </div>
            </div>
          )}

          {/* Выручка по периодам */}
          {revenueByPeriod && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>Выручка по периодам</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
                <div
                  style={{
                    padding: "20px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                  }}
                >
                  <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Сегодня</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#00ff94" }}>
                    {formatRevenue(revenueByPeriod.today)}
                  </div>
                </div>

                <div
                  style={{
                    padding: "20px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                  }}
                >
                  <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Месяц</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#00ff94" }}>
                    {formatRevenue(revenueByPeriod.month)}
                  </div>
                </div>

                <div
                  style={{
                    padding: "20px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                  }}
                >
                  <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Год</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#00ff94" }}>
                    {formatRevenue(revenueByPeriod.year)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Таблица последних пользователей */}
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Последние пользователи</h2>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>ID</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Email</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Username</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Баланс</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Дата регистрации</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                        Нет пользователей
                      </td>
                    </tr>
                  ) : (
                    recentUsers.map((user) => (
                      <tr key={user.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "12px 16px", fontSize: 14 }}>{user.id}</td>
                        <td style={{ padding: "12px 16px", fontSize: 14 }}>{user.email || "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: 14 }}>{user.username || "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: 14 }}>{user.balance} ₽</td>
                        <td style={{ padding: "12px 16px", fontSize: 14 }}>{user.created_at ? formatDate(user.created_at) : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}