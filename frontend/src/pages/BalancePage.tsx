import axios from "axios";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../store/auth";

export default function BalancePage() {
  const { user, loadMe } = useAuth();
  const location = useLocation();
  const [amount, setAmount] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<"sbp" | "card" | "crypto">("sbp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  const balanceRub = `${Number(user?.balance || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    const paymentResult = new URLSearchParams(location.search).get("payment");
    const paymentReference = new URLSearchParams(location.search).get("reference");

    void loadMe();

    if (paymentResult === "failed") {
      setPaymentNotice("Платёж не завершён. Средства не зачислены.");
      return () => {
        cancelled = true;
      };
    }

    if (paymentResult !== "return") {
      return () => {
        cancelled = true;
      };
    }

    const deadline = Date.now() + 60_000;
    setPaymentNotice("Проверяем подтверждение платежа. Обычно это занимает несколько секунд.");

    const checkPayment = async () => {
      try {
        const response = await api.get("/payments/topup/latest", {
          params: paymentReference ? { reference: paymentReference } : undefined,
        });
        if (cancelled) return;

        if (response.data.status === "confirmed") {
          const balanceRefreshed = await loadMe();
          if (!cancelled) {
            setPaymentNotice(
              balanceRefreshed
                ? "Оплата подтверждена, баланс обновлён."
                : "Оплата подтверждена, но баланс не удалось обновить. Перезагрузите страницу.",
            );
          }
          return;
        }

        if (response.data.status === "failed" || response.data.status === "chargebacked") {
          setPaymentNotice("Платёж не был зачислен. Проверьте его статус у платёжного провайдера.");
          return;
        }

        if (Date.now() >= deadline) {
          setPaymentNotice("Платёж ещё обрабатывается. Баланс обновится после подтверждения провайдера.");
          return;
        }

        timeoutId = window.setTimeout(checkPayment, 3000);
      } catch (requestError) {
        console.error("Failed to check returned top-up:", requestError);
        if (!cancelled) {
          const statusCode = axios.isAxiosError(requestError)
            ? requestError.response?.status
            : undefined;
          if ((statusCode === 502 || statusCode === 504) && Date.now() < deadline) {
            setPaymentNotice("Не удалось связаться с платёжной системой. Повторяем проверку...");
            timeoutId = window.setTimeout(checkPayment, 3000);
            return;
          }
          setPaymentNotice("Не удалось проверить статус пополнения. Обновите страницу позже.");
        }
      }
    };

    void checkPayment();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [location.search, loadMe]);

  const paymentMethods: {
    id: "sbp" | "card" | "crypto";
    name: string;
    desc: string;
    icon: string;
  }[] = [
    {
      id: "sbp",
      name: "СБП",
      desc: "Platega",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>',
    },
    {
      id: "card",
      name: "Банковская карта",
      desc: "Platega",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>',
    },
    {
      id: "crypto",
      name: "Криптовалюта",
      desc: "Platega",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    },
  ];

  const recentTopups: any[] = [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPaymentNotice(null);

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 50 || numericAmount > 50000) {
      setError("Укажите сумму от 50 до 50 000 ₽");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/payments/topup", {
        amount: numericAmount,
        currency: "RUB",
        payment_method: selectedMethod,
      });

      const paymentUrl = response.data.payment_url;
      if (paymentUrl) {
        window.location.href = paymentUrl;
        return;
      }

      setError("Platega не вернула ссылку на оплату");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Не удалось создать оплату");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lk-wrap">
      <div className="lk-layout">
        <div className="lk-sidebar">
          <div className="lk-sidebar-menu">
            <a href="/profile" className="lk-sidebar-item">Профиль</a>
            <a href="/profile/balance" className="lk-sidebar-item active">Пополнить баланс</a>
            <a href="/profile/history" className="lk-sidebar-item">История покупок</a>
          </div>
        </div>

        <div className="lk-card">
          <div className="lk-card-title">Пополнить баланс</div>
          <div className="lk-card-sub">Добавьте средства используя доступные способы оплаты</div>

          <div className="lk-topup-balances">
            <div className="lk-topup-balance">
              <div className="lk-topup-balance-label">Баланс RUB</div>
              <div className="lk-topup-balance-val">{balanceRub}</div>
            </div>
          </div>

          {paymentNotice && (
            <div role="status" aria-live="polite" style={{ marginBottom: 16 }}>
              {paymentNotice}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="lk-topup-amount-wrap">
              <label htmlFor="topupAmount">Сумма</label>
              <input
                type="number"
                id="topupAmount"
                min={50}
                max={50000}
                step={1}
                required
                placeholder="50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="lk-topup-hint">От 50 до 50 000 RUB</div>
            </div>

            <div className="lk-topup-promo">
              <label htmlFor="topupCode">Промокод</label>
              <input
                type="text"
                id="topupCode"
                placeholder="Введите промокод"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
              />
            </div>

            <div className="lk-card-sub" style={{ marginBottom: "12px" }}>Способ оплаты</div>
            <div className="lk-topup-methods">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  className={`lk-topup-method ${selectedMethod === method.id ? "active" : ""}`}
                  aria-pressed={selectedMethod === method.id}
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: method.icon }} />
                  <div className="lk-topup-method-name">{method.name}</div>
                  {method.desc && <div className="lk-topup-method-desc">{method.desc}</div>}
                </button>
              ))}
            </div>

            {error && <div style={{ color: "#ff7b7b", marginBottom: "12px" }}>{error}</div>}

            <button type="submit" className="lk-topup-submit" disabled={loading}>
              {loading ? "Создаём оплату..." : "Перейти к оплате"}
            </button>
          </form>

          {recentTopups.length > 0 && (
            <div className="lk-topup-history">
              <div className="lk-topup-history-title">Последние пополнения</div>
              {recentTopups.map((row) => (
                <div key={row.id} className="lk-topup-row">
                  <div className="lk-topup-row-main">
                    <div className="lk-topup-row-id">#{row.id}</div>
                    <div className="lk-topup-row-date">{row.aggregator}</div>
                  </div>
                  <div className="lk-topup-row-sum">
                    {row.currency === "usd" ? "$" : "₽"}
                    {row.sum}
                  </div>
                  {row.status === 1 ? (
                    <span className="lk-topup-status lk-topup-status--ok">Оплачено</span>
                  ) : (
                    <span className="lk-topup-status lk-topup-status--wait">Ожидание оплаты</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
