import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo";
import { useAuth } from "../store/auth";
import { getAuthErrorMessage } from "../utils/authErrorMessage";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErr(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      nav("/");
    } catch (e: any) {
      setErr(getAuthErrorMessage(e, "login"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
      <Seo title="Вход" noIndex />
      <h1 className="page-title">Вход</h1>

      <form className="form" onSubmit={submit}>
        <input
          className="input"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="input"
          type="password"
          placeholder="Пароль"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="muted">
          <Link to="/forgot-password">Забыли пароль?</Link>
        </div>

        {err && <div className="error" role="alert" aria-live="polite">{err}</div>}

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Проверяем данные…" : "Войти"}
        </button>

        <div className="muted">
          Нет аккаунта? <Link to="/register">Регистрация</Link>
        </div>
      </form>
    </div>
  );
}