import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import { useModalStore } from "../hooks/useModal";
import { applyDiscount, getCheatDiscountPercent } from "../utils/cheatPromotion";

type Tariff = {
  id: number;
  title: string;
  duration_days: number | null;
  price: number;
  old_price: number | null;
  promo_discount_percent?: number;
  promo_expires_at?: string;
};

type Item = {
  name: string;
  alias: string;
};

type Props = {
  item: Item;
  tariff: Tariff;
  accountId?: number;
};

type PaymentMode = "balance" | "topup";
type TopUpMethod = "sbp" | "card" | "crypto";

function formatRub(value: number) {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

function getApiError(error: any, fallback: string) {
  return error?.response?.data?.detail || fallback;
}

export default function PurchaseModalContent({ item, tariff, accountId }: Props) {
  const { closeModal } = useModalStore();
  const { user, loadMe } = useAuth();
  const navigate = useNavigate();
  const balance = Math.max(0, Number(user?.balance ?? 0));
  const discountPercent = getCheatDiscountPercent(
    user?.discount_percent,
    tariff.promo_discount_percent,
    tariff.promo_expires_at,
  );
  const price = applyDiscount(tariff.price, discountPercent);
  const shortfall = Math.max(0, Math.ceil(price - balance));
  const minimumTopUp = Math.max(50, shortfall);

  const [mode, setMode] = useState<PaymentMode>(balance >= price ? "balance" : "topup");
  const [method, setMethod] = useState<TopUpMethod>("sbp");
  const [amount, setAmount] = useState(String(minimumTopUp));
  const [guestEmail, setGuestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const topUpMethods: { value: TopUpMethod; label: string }[] = [
    { value: "sbp", label: "СБП" },
    { value: "card", label: "Карта" },
    { value: "crypto", label: "Криптовалюта" },
  ];

  const requireLogin = () => {
    if (user) return true;
    closeModal();
    navigate("/login");
    return false;
  };

  const payFromBalance = async () => {
    setError(null);
    if (!requireLogin()) return;
    if (balance < price) {
      setMode("topup");
      setError(`Не хватает ${formatRub(shortfall)}. Пополни баланс на эту сумму или больше.`);
      return;
    }

    setLoading(true);
    try {
      const response = accountId
        ? await api.post(`/accounts/${accountId}/purchase`)
        : await api.post("/payments/buy", {
            item_alias: item.alias,
            tariff_id: tariff.id,
            payment_method: "balance",
          });
      if (!accountId && response.data.delivery_url) {
        void loadMe().catch((refreshError) => {
          console.error("Failed to refresh user after balance purchase:", refreshError);
        });
        closeModal();
        navigate(response.data.delivery_url);
        return;
      }
      setCreatedOrderId(response.data.order_id);
      setDelivery(response.data.delivery ?? null);
      await loadMe();
    } catch (requestError) {
      setError(getApiError(requestError, "Не удалось оплатить покупку с баланса"));
    } finally {
      setLoading(false);
    }
  };

  const topUpBalance = async () => {
    setError(null);
    if (!requireLogin()) return;

    const topUpAmount = Number(amount);
    if (!Number.isFinite(topUpAmount) || topUpAmount < 50 || topUpAmount > 50000) {
      setError("Укажи сумму от 50 до 50 000 ₽");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/payments/topup", {
        amount: topUpAmount,
        currency: "RUB",
        payment_method: method,
      });
      const paymentUrl = response.data.payment_url;
      if (!paymentUrl) throw new Error("Platega не вернула ссылку на оплату");
      window.location.assign(paymentUrl);
    } catch (requestError) {
      setError(getApiError(requestError, "Не удалось создать пополнение"));
      setLoading(false);
    }
  };

  const payAsGuest = async () => {
    setError(null);
    const normalizedEmail = guestEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Укажи корректный email для заказа");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/payments/buy", {
        item_alias: item.alias,
        tariff_id: tariff.id,
        payment_method: method,
        email: normalizedEmail,
      });
      const paymentUrl = response.data.payment_url;
      if (!paymentUrl) throw new Error("Platega не вернула ссылку на оплату");
      window.location.assign(paymentUrl);
    } catch (requestError) {
      setError(getApiError(requestError, "Не удалось создать оплату"));
      setLoading(false);
    }
  };

  const downloadAccountFile = async () => {
    if (createdOrderId === null) return;
    setDownloadError(null);
    setDownloadLoading(true);
    try {
      const response = await api.get(
        `/accounts/purchases/${createdOrderId}/download`,
        { responseType: "blob" },
      );
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `millex-account-${createdOrderId}.exe`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      console.error("Failed to download account purchase:", requestError);
      setDownloadError("Не удалось скачать файл. Его также можно найти в истории заказов.");
    } finally {
      setDownloadLoading(false);
    }
  };

  if (createdOrderId !== null) {
    return (
      <div className="purchase-modal purchase-modal--success">
        <div className="purchase-modal-success-mark" aria-hidden="true">✓</div>
        <h3>{accountId ? "Аккаунт выдан" : "Заказ принят"}</h3>
        <p>Списано с баланса: <strong>{formatRub(price)}</strong></p>
        {delivery ? (
          <pre className="purchase-modal-delivery">{delivery}</pre>
        ) : accountId ? (
          <p className="purchase-modal-muted">
            Файл сохранён в заказе. Скачайте его сейчас или позже из истории покупок. Уведомление также будет отправлено на email, если почта настроена.
          </p>
        ) : (
          <p className="purchase-modal-muted">
            Заказ №{createdOrderId} отправлен на выдачу. После выдачи ключ придёт на вашу почту и появится в личном кабинете в разделе «Мои покупки». Проверьте также папку «Спам».
          </p>
        )}
        {accountId && (
          <button
            className="purchase-modal-primary"
            type="button"
            disabled={downloadLoading}
            onClick={() => void downloadAccountFile()}
          >
            {downloadLoading ? "Подготавливаем файл…" : "Скачать файл аккаунта"}
          </button>
        )}
        {downloadError && <p className="purchase-modal-error" role="alert">{downloadError}</p>}
        <p className="purchase-modal-muted">Номер заказа: #{createdOrderId}</p>
        <button className="purchase-modal-primary" type="button" onClick={closeModal}>
          Ок
        </button>
      </div>
    );
  }

  return (
    <div className="purchase-modal">
      {!user && (
        <div className="purchase-modal-benefits">
          <strong>{accountId ? "Войдите для покупки аккаунта" : "С аккаунтом выгоднее"}</strong>
          <span>
            {accountId
              ? "Чтобы оплатить и получить данные аккаунта, войдите или зарегистрируйтесь."
              : "Экономь до 10% на покупках и получай 5% кэшбэка с каждой оплаты. Гостевой заказ можно оформить по email."}
          </span>
          <Link to={accountId ? "/login" : "/register"} onClick={closeModal}>
            {accountId ? "Войти" : "Создать аккаунт"}
          </Link>
        </div>
      )}

      <div className="purchase-modal-item">
        <div className="purchase-modal-item-copy">
          <span className="purchase-modal-label">Товар</span>
          <strong>{item.name}</strong>
          <span className="purchase-modal-period">{tariff.title}</span>
        </div>
        <div className="purchase-modal-price">
          <span className="purchase-modal-label">К оплате</span>
          {discountPercent > 0 && (
            <del>{formatRub(tariff.price)}</del>
          )}
          <strong>{formatRub(price)}</strong>
          {discountPercent > 0 && (
            <span className="purchase-modal-discount">−{discountPercent}%</span>
          )}
        </div>
      </div>

      {user ? (
        <>
          <div className="purchase-modal-section-heading">Способ оплаты</div>
          <div className="purchase-modal-modes" role="tablist" aria-label="Способ оплаты">
            <button
              className={`purchase-modal-mode ${mode === "balance" ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={mode === "balance"}
              onClick={() => { setMode("balance"); setError(null); }}
            >
              <span className="purchase-modal-mode-icon" aria-hidden="true">₽</span>
              <span className="purchase-modal-mode-copy">
                <strong>С баланса</strong>
                <small>{formatRub(balance)} доступно</small>
              </span>
              <span className="purchase-modal-radio" aria-hidden="true" />
            </button>
            <button
              className={`purchase-modal-mode ${mode === "topup" ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={mode === "topup"}
              onClick={() => { setMode("topup"); setError(null); }}
            >
              <span className="purchase-modal-mode-icon purchase-modal-mode-icon--topup" aria-hidden="true">+</span>
              <span className="purchase-modal-mode-copy">
                <strong>Пополнить баланс</strong>
                <small>Через Platega</small>
              </span>
              <span className="purchase-modal-radio" aria-hidden="true" />
            </button>
          </div>

          {mode === "balance" ? (
        <div className="purchase-modal-balance-panel" role="tabpanel">
          {balance >= price ? (
          <p>
            {accountId
              ? "После списания с баланса данные аккаунта появятся здесь."
              : "После оплаты заказ сразу появится у администратора на выдачу."}
          </p>
          ) : (
            <>
              <p>
                Не хватает <strong>{formatRub(shortfall)}</strong> для оплаты этого тарифа.
              </p>
              <button
                className="purchase-modal-text-button"
                type="button"
                onClick={() => { setAmount(String(minimumTopUp)); setMode("topup"); setError(null); }}
              >
                Пополнить баланс на недостающую сумму
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="purchase-modal-topup-panel" role="tabpanel">
          <label className="purchase-modal-label" htmlFor="purchase-topup-amount">
            Сумма пополнения
          </label>
          <div className="purchase-modal-amount-input">
            <input
              id="purchase-topup-amount"
              type="number"
              min={50}
              max={50000}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <span>RUB</span>
          </div>
          <div className="purchase-modal-hint">
            Минимум 50 ₽. После зачисления вернитесь к аккаунту и подтвердите покупку с баланса.
          </div>

          <div className="purchase-modal-methods" role="group" aria-label="Метод пополнения">
            {topUpMethods.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`purchase-modal-method ${method === value ? "is-active" : ""}`}
                aria-pressed={method === value}
                onClick={() => setMethod(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
        </>
      ) : accountId ? (
        <div className="purchase-modal-topup-panel purchase-modal-guest-panel">
          <div className="purchase-modal-section-heading">Покупка аккаунта</div>
          <p>Покупка и выдача аккаунта доступны только авторизованным пользователям.</p>
        </div>
      ) : (
        <div className="purchase-modal-topup-panel purchase-modal-guest-panel">
          <div className="purchase-modal-section-heading">Оплата заказа</div>
          <label className="purchase-modal-label" htmlFor="guest-checkout-email">
            Email для заказа и связи
          </label>
          <input
            id="guest-checkout-email"
            className="purchase-modal-email-input"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={guestEmail}
            onChange={(event) => setGuestEmail(event.target.value)}
            required
          />
          <div className="purchase-modal-hint">
            На этот адрес будет привязан заказ. Оплата с баланса доступна только после входа в аккаунт.
          </div>
          <div className="purchase-modal-methods" role="group" aria-label="Метод оплаты">
            {topUpMethods.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`purchase-modal-method ${method === value ? "is-active" : ""}`}
                aria-pressed={method === value}
                onClick={() => setMethod(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="purchase-modal-error" role="alert">{error}</div>}

      <div className="purchase-modal-footer">
        <button className="purchase-modal-secondary" type="button" onClick={closeModal} disabled={loading}>
          Отмена
        </button>
        {!user && accountId ? (
          <button
            className="purchase-modal-primary"
            type="button"
            onClick={() => { closeModal(); navigate("/login"); }}
          >
            Войти для покупки
          </button>
        ) : !user ? (
          <button
            className="purchase-modal-primary"
            type="button"
            onClick={payAsGuest}
            disabled={loading || !guestEmail.trim()}
          >
            {loading ? "Создаём оплату…" : "Перейти к оплате"}
          </button>
        ) : mode === "balance" ? (
          <button
            className="purchase-modal-primary"
            type="button"
            onClick={payFromBalance}
            disabled={loading || balance < price || !user}
          >
            {loading ? "Оплачиваем…" : `Оплатить ${formatRub(price)}`}
          </button>
        ) : (
          <button
            className="purchase-modal-primary"
            type="button"
            onClick={topUpBalance}
            disabled={loading || !user}
          >
            {loading ? "Создаём оплату…" : "Перейти к пополнению"}
          </button>
        )}
      </div>
    </div>
  );
}