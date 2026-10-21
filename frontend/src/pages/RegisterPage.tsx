import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo";
import { useAuth } from "../store/auth";
import { getAuthErrorMessage } from "../utils/authErrorMessage";


export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErr(null);
    setSubmitting(true);

    try {
      await register(email.trim(), username.trim(), password);
      nav("/");
    } catch (e: any) {
      setErr(getAuthErrorMessage(e, "register"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
      <Seo title="Регистрация" noIndex />
      <h1 className="page-title">Регистрация</h1>

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
          placeholder="Никнейм"
          minLength={3}
          maxLength={32}
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="input"
          type="password"
          placeholder="Пароль"
          minLength={8}
          maxLength={256}
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && <div className="error" role="alert" aria-live="polite">{err}</div>}

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Создаём аккаунт…" : "Создать аккаунт"}
        </button>

        <div className="muted">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </form>
    </div>
  );
}