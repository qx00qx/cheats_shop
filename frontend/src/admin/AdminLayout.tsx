import { NavLink, Link, Routes, Route } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import AdminGames from "./AdminGames";
import AdminProducts from "./AdminProducts";
import AdminOrders from "./AdminOrders";
import AdminUsers from "./AdminUsers";
import AdminPayouts from "./AdminPayouts";
import AdminEmailer from "./AdminEmailer";
import AdminHomepage from "./AdminHomepage";
import AdminArticles from "./AdminArticles";

export default function AdminLayout() {
  const navigation = [
    { to: "/admin", label: "Дашборд", end: true },
    { to: "/admin/games", label: "Игры" },
    { to: "/admin/products", label: "Читы и товары" },
    { to: "/admin/orders", label: "Заказы" },
    { to: "/admin/users", label: "Пользователи" },
    { to: "/admin/payouts", label: "Выплаты" },
    { to: "/admin/emailer", label: "Рассылки" },
    { to: "/admin/homepage", label: "Настройка главной" },
    { to: "/admin/articles", label: "Статьи" },
  ];

  return (
    <div className="container admin-shell">
      <div className="admin-shell__layout">
        <aside className="admin-shell__sidebar">
          <h2 className="page-title" style={{ fontSize: 20 }}>Админка</h2>
          <nav className="admin-shell__nav" aria-label="Разделы админки">
            {navigation.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `btn-ghost${isActive ? " is-active" : ""}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <Link className="admin-shell__store-link" to="/">
            ← Открыть витрину
          </Link>
        </aside>
        <section>
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="games" element={<AdminGames />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="payouts" element={<AdminPayouts />} />
            <Route path="emailer" element={<AdminEmailer />} />
            <Route path="homepage" element={<AdminHomepage />} />
            <Route path="articles" element={<AdminArticles />} />
          </Routes>
        </section>
      </div>
    </div>
  );
}