import { useState, useEffect } from "react";
import { EmailerAPI, Emailer, EmailerCreate, EmailerServiceStatus } from "../api/emailer";
import { createPortal } from "react-dom";

export default function AdminEmailer() {
  const [emailers, setEmailers] = useState<Emailer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [serviceStatus, setServiceStatus] = useState<EmailerServiceStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<EmailerCreate>({
    subject: "",
    from_email: "",
    to_email: null,
    cc_email: null,
    body: "",
  });

  useEffect(() => {
    setMounted(true);
    loadEmailers();
    loadServiceStatus();
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!emailers.some((emailer) => emailer.send_status === "sending")) return;
    const intervalId = window.setInterval(loadEmailers, 2000);
    return () => window.clearInterval(intervalId);
  }, [emailers]);

  const loadEmailers = async () => {
    try {
      const data = await EmailerAPI.list();
      setEmailers(data);
    } catch (err) {
      console.error("Failed to load emailers:", err);
    }
  };

  const loadServiceStatus = async () => {
    try {
      setServiceStatus(await EmailerAPI.status());
    } catch (err) {
      console.error("Failed to load Amazon SES status:", err);
      setErrorMessage("Не удалось загрузить состояние Amazon SES.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await EmailerAPI.create(formData);
      setShowModal(false);
      setFormData({
        subject: "",
        from_email: "",
        to_email: null,
        cc_email: null,
        body: "",
      });
      loadEmailers();
    } catch (err) {
      console.error("Failed to create emailer:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (
    id: number,
    subject: string,
    toEmail: string | null,
  ) => {
    const recipientCount = toEmail ? 1 : serviceStatus?.active_recipient_count ?? 0;
    if (!window.confirm(
      `Отправить «${subject}» на ${recipientCount} адресов активных пользователей?`,
    )) {
      return;
    }

    setSendingId(id);
    try {
      await EmailerAPI.send(id);
      setErrorMessage("");
      loadEmailers();
    } catch (err) {
      console.error("Failed to send emailer:", err);
      setErrorMessage(err instanceof Error ? err.message : "Не удалось запустить рассылку.");
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить рассылку?")) return;
    try {
      await EmailerAPI.delete(id);
      loadEmailers();
    } catch (err) {
      console.error("Failed to delete emailer:", err);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Не отправлено";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div className="admin-emailer__header">
        <h1 className="page-title">Рассылки</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Создать рассылку
        </button>
      </div>

      <div
        role="status"
        style={{
          padding: "14px 16px",
          marginBottom: 18,
          border: `1px solid ${serviceStatus?.configured ? "rgba(0,255,148,0.24)" : "rgba(255,193,7,0.3)"}`,
          borderRadius: 10,
          background: serviceStatus?.configured ? "rgba(0,255,148,0.06)" : "rgba(255,193,7,0.06)",
          color: "rgba(255,255,255,0.82)",
          fontSize: 13,
        }}
      >
        <strong>
          Amazon SES: {serviceStatus?.configured ? "настроен" : "не настроен"}
        </strong>
        {serviceStatus?.region && <span> · Регион: {serviceStatus.region}</span>}
        {serviceStatus?.configured && (
          <span> · Активных получателей: {serviceStatus.active_recipient_count}</span>
        )}
        {!serviceStatus?.configured && (
          <div style={{ marginTop: 5, color: "rgba(255,255,255,0.6)" }}>
            Укажите регион и AWS credentials в окружении backend. Транзакционные письма продолжают отправляться через прежний сервис.
          </div>
        )}
      </div>

      {errorMessage && (
        <p role="alert" style={{ marginBottom: 16, color: "#ff7777" }}>
          {errorMessage}
        </p>
      )}

      <div
        className="admin-emailer__table"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "12px",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>ID</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Тема</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>От</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Аудитория</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Статус</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Дата отправки</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {emailers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                  Нет рассылок
                </td>
              </tr>
            ) : (
              emailers.map((emailer) => (
                <tr key={emailer.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{emailer.id}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{emailer.subject}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{emailer.from_email}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    {emailer.to_email || "Все активные пользователи"}
                    {emailer.recipient_count > 0 && (
                      <small style={{ display: "block", marginTop: 4, color: "rgba(255,255,255,0.55)" }}>
                        {emailer.sent_count} из {emailer.recipient_count}
                        {emailer.failed_count > 0 && ` · ошибок: ${emailer.failed_count}`}
                      </small>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: 12,
                        background: emailer.send_status === "sent"
                          ? "rgba(0, 255, 148, 0.15)"
                          : emailer.send_status === "failed" || emailer.send_status === "partial"
                            ? "rgba(255, 92, 92, 0.15)"
                            : emailer.send_status === "sending"
                              ? "rgba(77, 179, 255, 0.15)"
                              : "rgba(255, 193, 7, 0.15)",
                        color: emailer.send_status === "sent"
                          ? "#00ff94"
                          : emailer.send_status === "failed" || emailer.send_status === "partial"
                            ? "#ff7777"
                            : emailer.send_status === "sending"
                              ? "#70c5ff"
                              : "#ffc107",
                      }}
                    >
                      {{
                        draft: "Черновик",
                        sending: "Отправляется",
                        sent: "Отправлено",
                        partial: "Отправлено частично",
                        failed: "Ошибка отправки",
                      }[emailer.send_status] ?? "Неизвестный статус"}
                    </span>
                    {emailer.last_error && (
                      <small style={{ display: "block", marginTop: 5, color: "#ff7777" }}>
                        {emailer.last_error}
                      </small>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{formatDate(emailer.last_send)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {emailer.send_status === "draft" && (
                        <button
                          className="btn-ghost"
                          disabled={!serviceStatus?.configured || sendingId !== null}
                          onClick={() => handleSend(
                            emailer.id,
                            emailer.subject,
                            emailer.to_email,
                          )}
                          style={{ padding: "4px 8px", fontSize: 12 }}
                        >
                          Отправить всем
                        </button>
                      )}
                      <button
                        className="btn-ghost"
                        onClick={() => handleDelete(emailer.id)}
                        style={{ padding: "4px 8px", fontSize: 12, color: "#ff5c5c" }}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && mounted && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "rgba(15, 17, 20, 0.98)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              padding: "28px 26px 24px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 20, color: "#fff" }}>
              Новая рассылка
            </h2>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  Тема *
                </label>
                <input
                  className="input"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  От (email) *
                </label>
                <input
                  className="input"
                  type="email"
                  value={formData.from_email}
                  onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  required
                />
              </div>

              <div>
                <div
                  style={{
                    padding: "12px 14px",
                    border: "1px solid rgba(0,255,148,0.2)",
                    borderRadius: 9,
                    background: "rgba(0,255,148,0.05)",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  Аудитория: все активные пользователи
                  {serviceStatus && ` (${serviceStatus.active_recipient_count})`}
                  . Каждому пользователю отправляется отдельное письмо, адреса получателей не раскрываются.
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  Копия (email)
                </label>
                <input
                  className="input"
                  type="email"
                  value={formData.cc_email || ""}
                  onChange={(e) => setFormData({ ...formData, cc_email: e.target.value || null })}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  Текст письма (HTML) *
                </label>
                <textarea
                  className="input"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  rows={8}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Создание..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
