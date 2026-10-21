import { useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Seo from "../components/Seo";
import { AuthAPI } from "../api/auth";

declare global {
  interface Window {
    __millexPasswordResetToken?: string;
    __millexPasswordResetRoute?: boolean;
  }
}

export default function ResetPasswordPage() {
  const [token] = useState(
    () =>
      window.__millexPasswordResetToken ??
      window.sessionStorage.getItem("millex_password_reset_token") ??
      new URLSearchParams(window.location.search).get("token") ??
      "",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    window.sessionStorage.removeItem("millex_password_reset_token");
    delete window.__millexPasswordResetToken;
    delete window.__millexPasswordResetRoute;
    const url = new URL(window.location.href);
    if (url.searchParams.has("token")) {
      url.searchParams.delete("token");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setMessage(null);

    if (!token) {
      setError("В ссылке отсутствует токен восстановления. Запросите новую ссылку.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await AuthAPI.confirmPasswordReset(token, password);
      setMessage(response.message);
      setPassword("");
      setConfirmPassword("");
    } catch (requestError: unknown) {
      const detail = axios.isAxiosError(requestError)
        ? requestError.response?.data?.detail
        : null;
      setError(
        typeof detail === "string"
          ? detail
          : "Не удалось изменить пароль. Запросите новую ссылку и попробуйте ещё раз.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
      <Seo title="Новый пароль" noIndex />
      <h1 className="page-title">Новый пароль</h1>

      {message ? (
        <div className="form">
          <p className="muted" role="status" aria-live="polite">{message}</p>
          <Link className="btn-primary" to="/login">Перейти ко входу</Link>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <input
            className="input"
            type="password"
            placeholder="Новый пароль"
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Повторите новый пароль"
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {error && <div className="error" role="alert" aria-live="polite">{error}</div>}
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Сохраняем…" : "Изменить пароль"}
          </button>
        </form>
      )}
    </div>
  );
}
