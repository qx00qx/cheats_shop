import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

type Payout = {
  id: number;
  amount_rub: number;
  card_last4: string;
  status: string;
  provider_transaction_id: string | null;
  provider_status: string | null;
  error_message: string | null;
  created_at: string | null;
};

type PayoutList = { items: Payout[] };

const statusLabels: Record<string, string> = {
  processing: "Обрабатывается",
  submitted: "Передана Platega",
  failed: "Отклонена",
  unknown: "Требует проверки у Platega",
};

function apiErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "detail" in error.response.data &&
    typeof error.response.data.detail === "string"
  ) {
    return error.response.data.detail;
  }
  return error instanceof Error ? error.message : "Не удалось выполнить выплату";
}

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [cardNumber, setCardNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const response = await api.get<PayoutList>("/admin/payouts", {
        params: { limit: 50 },
      });
      setPayouts(response.data.items);
    } catch (loadError) {
      console.error("Failed to load admin payouts:", loadError);
      setError("Не удалось загрузить историю выплат.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayouts();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountRub = Number(amount);
    if (!Number.isInteger(amountRub) || amountRub < 1) {
      setError("Укажите сумму выплаты в целых рублях.");
      return;
    }
    const normalizedCard = cardNumber.replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(normalizedCard)) {
      setError("Номер карты должен содержать от 13 до 19 цифр.");
      return;
    }

    const confirmed = window.confirm(
      `Отправить ${amountRub.toLocaleString("ru-RU")} ₽ на карту, оканчивающуюся на ${normalizedCard.slice(-4)}? Операция отправит реальные средства.`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setNotice("");
    const currentRequestId = requestId || crypto.randomUUID();
    setRequestId(currentRequestId);
    try {
      const response = await api.post<Payout>("/admin/payouts", {
        card_number: normalizedCard,
        amount_rub: amountRub,
        request_id: currentRequestId,
      });
      setPayouts((current) => [
        response.data,
        ...current.filter((payout) => payout.id !== response.data.id),
      ].slice(0, 50));
      setCardNumber("");
      setRequestId(null);
      if (response.data.status === "unknown") {
        setNotice(`Выплата #${response.data.id} требует проверки в Platega. Не отправляйте её повторно до проверки статуса.`);
      } else if (response.data.status === "failed") {
        setError(response.data.error_message || "Platega отклонила выплату.");
      } else {
        setNotice(`Выплата #${response.data.id} принята к обработке Platega.`);
      }
    } catch (submitError) {
      console.error("Failed to submit payout:", submitError);
      setError(apiErrorMessage(submitError));
      await loadPayouts();
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU");
  };

  return (
    <div>
      <h1 className="page-title">Выплаты</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Ручная выплата RUB на банковскую карту через Platega. Номер карты не сохраняется — только последние 4 цифры.
      </p>

      <form
        onSubmit={handleSubmit}
        className="admin-payouts__form"
      >
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>Номер карты</span>
          <input
            required
            autoComplete="off"
            inputMode="numeric"
            maxLength={19}
            pattern="[0-9]{13,19}"
            value={cardNumber}
            onChange={(event) => setCardNumber(event.target.value.replace(/\D/g, "").slice(0, 19))}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              color: "#fff",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
            }}
          />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>Сумма, ₽</span>
          <input
            required
            type="number"
            min={1}
            max={1_000_000}
            step={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              color: "#fff",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
            }}
          />
        </label>
        <button className="btn-ghost" type="submit" disabled={submitting}>
          {submitting ? "Отправка..." : "Отправить выплату"}
        </button>
      </form>

      <p className="muted" style={{ marginBottom: 16 }}>
        Выплата инициирует реальный перевод. При неизвестном ответе провайдера проверьте операцию у Platega до повторной отправки.
      </p>
      {error && <p role="alert" style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#fff", marginBottom: 16 }}>{notice}</p>}

      <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["ID", "Сумма", "Карта", "Статус", "ID Platega", "Создана"].map((heading) => (
                <th key={heading} style={{ padding: "12px 16px", color: "rgba(255,255,255,0.7)" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Загрузка...</td></tr>
            ) : payouts.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Выплат пока нет</td></tr>
            ) : payouts.map((payout) => (
              <tr key={payout.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: "12px 16px" }}>#{payout.id}</td>
                <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                  {payout.amount_rub.toLocaleString("ru-RU")} ₽
                </td>
                <td style={{ padding: "12px 16px" }}>•••• {payout.card_last4}</td>
                <td style={{ padding: "12px 16px" }}>
                  {statusLabels[payout.status] || payout.status}
                  {payout.provider_status && <div className="muted" style={{ fontSize: 12 }}>{payout.provider_status}</div>}
                  {payout.error_message && <div style={{ color: "#ff8a8a", fontSize: 12 }}>{payout.error_message}</div>}
                </td>
                <td style={{ padding: "12px 16px" }}>{payout.provider_transaction_id || "—"}</td>
                <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>{formatDate(payout.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
