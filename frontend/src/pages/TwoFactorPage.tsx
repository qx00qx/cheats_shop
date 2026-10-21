import { useState } from "react";
import { AuthAPI } from "../api/auth";

export default function TwoFactorPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function setup() {
    try {
      const r = await AuthAPI.setup2fa();
      setSecret(r.secret);
      setUri(r.uri);
    } catch {
      setMsg("Не удалось настроить 2FA");
    }
  }

  async function verify() {
    try {
      await AuthAPI.verify2fa(code);
      setMsg("2FA подключена ✅");
    } catch {
      setMsg("Неверный код");
    }
  }

  return (
    <div className="container" style={{ maxWidth: 520, paddingTop: 40 }}>
      <h1 className="page-title">Google Authenticator</h1>

      {!secret ? (
        <button className="btn-primary" onClick={setup}>
          Настроить
        </button>
      ) : (
        <div className="card">
          <p className="muted">Секрет:</p>
          <code style={{ wordBreak: "break-all" }}>{secret}</code>
          <p className="muted" style={{ marginTop: 12 }}>
            Добавьте в Google Authenticator по URI:
          </p>
          <code style={{ wordBreak: "break-all" }}>{uri}</code>

          <input
            className="input"
            placeholder="Код из приложения"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ marginTop: 12 }}
          />
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={verify}>
            Проверить
          </button>
        </div>
      )}

      {msg && <div className="muted" style={{ marginTop: 16 }}>{msg}</div>}
    </div>
  );
}