import { useState, useEffect } from "react";
import { EmailerAPI, Emailer, EmailerCreate } from "../api/emailer";
import { createPortal } from "react-dom";

export default function AdminEmailer() {
  const [emailers, setEmailers] = useState<Emailer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState<EmailerCreate>({
    subject: "",
    from_email: "",
    to_email: "",
    cc_email: null,
    body: "",
  });

  useEffect(() => {
    setMounted(true);
    loadEmailers();
    return () => setMounted(false);
  }, []);

  const loadEmailers = async () => {
    try {
      const data = await EmailerAPI.list();
      setEmailers(data);
    } catch (err) {
      console.error("Failed to load emailers:", err);
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
        to_email: "",
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

  const handleSend = async (id: number) => {
    try {
      await EmailerAPI.send(id);
      loadEmailers();
    } catch (err) {
      console.error("Failed to send emailer:", err);
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
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Кому</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Статус</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Дата отправки</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {emailers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                  Нет рассылок
                </td>
              </tr>
            ) : (
              emailers.map((emailer) => (
                <tr key={emailer.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{emailer.id}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{emailer.subject}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{emailer.from_email}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{emailer.to_email}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: 12,
                        background: emailer.is_sent
                          ? "rgba(0, 255, 148, 0.15)"
                          : "rgba(255, 193, 7, 0.15)",
                        color: emailer.is_sent ? "#00ff94" : "#ffc107",
                      }}
                    >
                      {emailer.is_sent ? "Отправлено" : "Не отправлено"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{formatDate(emailer.last_send)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!emailer.is_sent && (
                        <button
                          className="btn-ghost"
                          onClick={() => handleSend(emailer.id)}
                          style={{ padding: "4px 8px", fontSize: 12 }}
                        >
                          Отправить
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
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  Кому (email) *
                </label>
                <input
                  className="input"
                  type="email"
                  value={formData.to_email}
                  onChange={(e) => setFormData({ ...formData, to_email: e.target.value })}
                  required
                />
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
