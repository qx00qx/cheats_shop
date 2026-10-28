import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AccountLayout from "../components/AccountLayout";
import { useAuth } from "../store/auth";

export default function ProfilePage() {
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!user) nav("/login");
  }, [user, nav]);

  if (!user) return null;

  return (
    <AccountLayout activeSection="profile">
      <h1 className="lk-card-title">Профиль</h1>
      <div className="card" style={{ marginBottom: 24 }}>
        <div>
          <b>Ник:</b> {user.username}
        </div>
        <div>
          <b>Email:</b> {user.email}
        </div>
        <div>
          <b>Баланс:</b> <span className="rating">{Number(user.balance).toFixed(2)} ₽</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/profile/history" className="btn-ghost">История покупок</Link>
        <Link to="/profile/balance" className="btn-ghost">Пополнить баланс</Link>
        <Link to="/2fa" className="btn-ghost">
          2FA
        </Link>
      </div>
    </AccountLayout>
  );
}