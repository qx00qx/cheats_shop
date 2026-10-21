import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Seo from "../components/Seo";
import { AuthAPI } from "../api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const response = await AuthAPI.requestPasswordReset(email.trim());
      setMessage(response.message);
    } catch (requestError: unknown) {
      const detail = axios.isAxiosError(requestError)
        ? requestError.response?.data?.detail
        : null;
      setError(
        typeof detail === "string"
          ? detail
          : "Не удалось отправить запрос. Попробуйте позже.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
      <Seo title="Восстановление пароля" noIndex />
      <h1 className="page-title">Восстановление пароля</h1>

      <form className="form forgot-password-form" onSubmit={submit}>
        <input
          className="input"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {error && <div className="error" role="alert" aria-live="polite">{error}</div>}
        {message && <div className="muted" role="status" aria-live="polite">{message}</div>}

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Отправляем…" : "Отправить ссылку"}
        </button>
        <div className="muted">
          <Link to="/login">Вернуться ко входу</Link>
        </div>
      </form>
    </div>
  );
}
