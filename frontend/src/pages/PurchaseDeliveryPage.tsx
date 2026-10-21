import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { api } from "../api/client";
import "./PurchaseDeliveryPage.css";

type DeliveryStatus = {
  order_id: number;
  status: string;
  product: string | null;
  period: string | null;
  amount: number | null;
  currency: string;
  key_value: string | null;
  instruction_link: string | null;
};

function formatAmount(amount: number | null, currency: string) {
  if (amount === null) return "";
  return `${amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currency === "RUB" ? "₽" : currency}`;
}

function getInstructionHref(value: string | null) {
  const instruction = value?.trim();
  if (!instruction) return null;
  if (instruction.startsWith("/") && !instruction.startsWith("//")) {
    return { href: normalizeBlogPath(instruction), external: false };
  }
  if (/^https?:\/\//i.test(instruction)) {
    try {
      const url = new URL(instruction);
      const trustedHosts = new Set([
        window.location.hostname.toLowerCase(),
        "millex.market",
        "www.millex.market",
        "millex.xyz",
        "www.millex.xyz",
      ]);
      if (!trustedHosts.has(url.hostname.toLowerCase())) return null;
      return { href: normalizeBlogPath(`${url.pathname}${url.search}${url.hash}`), external: false };
    } catch {
      return null;
    }
  }
  if (/^blogs?\/[^/]+$/i.test(instruction)) {
    return { href: normalizeBlogPath(`/${instruction}`), external: false };
  }
  if (/^[a-z0-9_-]+$/i.test(instruction)) {
    return { href: `/blog/${encodeURIComponent(instruction)}`, external: false };
  }
  return null;
}

function normalizeBlogPath(path: string) {
  return path.replace(/^\/blogs?(?=\/|$)/i, "/blog");
}

export default function PurchaseDeliveryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderIdParam = searchParams.get("order_id") ?? "";
  const tokenRef = useRef(searchParams.get("token") ?? "");
  const token = tokenRef.current;
  const orderId = Number(orderIdParam);
  const validOrderId = Number.isSafeInteger(orderId) && orderId > 0;
  const [order, setOrder] = useState<DeliveryStatus | null>(null);
  const [requestError, setRequestError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);
  const [longWait, setLongWait] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!searchParams.has("token")) return;
    const cleanedParams = new URLSearchParams(searchParams);
    cleanedParams.delete("token");
    const cleanedSearch = cleanedParams.toString();
    navigate(
      {
        pathname: window.location.pathname,
        search: cleanedSearch ? `?${cleanedSearch}` : "",
      },
      { replace: true },
    );
  }, [navigate, searchParams]);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (!validOrderId || token.length < 32) {
      setAccessError("В ссылке на заказ отсутствуют данные для безопасного просмотра.");
      return;
    }

    let active = true;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        const response = await api.get<DeliveryStatus>(
          `/payments/bot-orders/${orderId}/status`,
          { headers: { "X-Order-Access-Token": token } },
        );
        if (!active) return;
        setOrder(response.data);
        setRequestError("");
        setAccessError("");
        if (
          response.data.status === "failed" ||
          response.data.status === "chargeback" ||
          (response.data.status === "completed" && response.data.key_value)
        ) {
          return;
        }
      } catch (error: unknown) {
        if (!active) return;
        if (isAxiosError(error) && error.response?.status === 404) {
          setAccessError("Заказ не найден или ссылка на его отслеживание недействительна.");
          return;
        }
        console.error("Failed to refresh purchase delivery status:", error);
        setRequestError("Не удалось обновить статус заказа. Повторяем проверку…");
      }

      if (!active) return;
      const elapsed = Date.now() - startedAt.current;
      if (elapsed >= 5 * 60 * 1000) setLongWait(true);
      timeoutId = window.setTimeout(poll, elapsed < 5 * 60 * 1000 ? 4000 : 12000);
    };

    void poll();
    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [orderId, token, validOrderId]);

  const instruction = useMemo(
    () => getInstructionHref(order?.instruction_link ?? null),
    [order?.instruction_link],
  );

  const statusHeading = (() => {
    if (accessError) return "Не удалось открыть заказ";
    if (!order) return "Проверяем статус платежа";
    if (order.status === "pending_payment") return "Ваш платеж проверяется";
    if (order.status === "new") return "Оплата подтверждена";
    if (order.status === "completed" && order.key_value) return "Ключ готов";
    if (order.status === "failed") return "Платёж не подтверждён";
    if (order.status === "chargeback") return "Платёж отменён";
    return "Обновляем статус заказа";
  })();

  const isWaiting = !accessError && (
    !order ||
    order.status === "pending_payment" ||
    order.status === "new" ||
    order.status === "completed"
  ) && !order?.key_value;

  const statusMessage = (() => {
    if (accessError) return accessError;
    if (order?.status === "pending_payment") {
      if (longWait) {
        return "Платёж проверяется дольше обычного. Не оплачивайте заказ повторно: мы продолжаем проверять подтверждение.";
      }
      return "В течение 5 минут вы автоматически получите ключ активации после подтверждения от платежной системы.";
    }
    if (order?.status === "new") {
      return "Платёж подтверждён. Заказ передан администратору, ключ появится здесь сразу после выдачи.";
    }
    if (order?.status === "completed" && order.key_value) {
      return "Ключ активации выдан. Скопируйте его и следуйте инструкции по установке.";
    }
    if (order?.status === "failed") {
      return "Платёж не был подтверждён. Если деньги списались, обратитесь в поддержку и укажите номер заказа.";
    }
    if (order?.status === "chargeback") {
      return "Платёж был отменён или возвращён. Для уточнения деталей обратитесь в поддержку.";
    }
    if (longWait) {
      return "Выдача занимает больше обычного. Заказ принят, статус продолжает обновляться; ключ также появится в «Моих покупках» и придёт на почту.";
    }
    return "Проверяем платёж. Не закрывайте страницу: статус заказа обновится автоматически.";
  })();

  const copyKey = async () => {
    if (!order?.key_value) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(order.key_value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Failed to copy activation key:", error);
      setCopyError("Не удалось скопировать ключ. Выделите его и скопируйте вручную.");
    }
  };

  return (
    <main className="purchase-delivery-page">
      <div className="purchase-delivery-backdrop" aria-hidden="true" />
      <section className="purchase-delivery-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-title">
        <Link className="purchase-delivery-close" to="/catalog" aria-label="Закрыть">×</Link>
        <div className="purchase-delivery-eyebrow">
          {order ? `Заказ #${order.order_id}` : validOrderId ? `Заказ #${orderId}` : "Заказ"}
          {order?.product ? ` · ${order.product}` : ""}
        </div>
        <h1 id="delivery-title">{statusHeading}</h1>
        <p className="purchase-delivery-lead">{statusMessage}</p>

        {order && (
          <div className="purchase-delivery-order">
            <div>
              <strong>{order.product || "Покупка"}</strong>
              <small>{[order.period, "Platega"].filter(Boolean).join(" · ")}</small>
            </div>
            {order.amount !== null && (
              <span className="purchase-delivery-amount">
                {formatAmount(order.amount, order.currency)}
              </span>
            )}
          </div>
        )}

        {requestError && <p className="purchase-delivery-error" role="alert">{requestError}</p>}

        <section className={`purchase-delivery-key${order?.key_value ? " is-issued" : ""}`}>
          <div className="purchase-delivery-key-heading">
            <strong>Выдача ключа</strong>
            <span className="purchase-delivery-key-state">
              {isWaiting && <span className="purchase-delivery-spinner" aria-hidden="true" />}
              {order?.key_value
                ? "Ключ выдан"
                : order?.status === "new"
                  ? "Ожидаем подтверждение платежа"
                  : order?.status === "failed" || order?.status === "chargeback"
                    ? "Выдача остановлена"
                    : "Ожидаем подтверждение оплаты"}
            </span>
          </div>
          {isWaiting && (
            <p className="purchase-delivery-key-message">
              {longWait
                ? "Проверка продолжается. Если ключ не появится, он будет доступен в личном кабинете после выдачи."
                : "Ключ будет выдан автоматически в течение 5 минут после подтверждения оплаты платёжным агрегатором. Он появится здесь, на почте и в разделе «Мои покупки»."}
            </p>
          )}
          {order?.key_value && (
            <div className="purchase-delivery-key-value">
              <div className="purchase-delivery-copy-row">
                <button className="purchase-delivery-copy" type="button" onClick={() => void copyKey()}>
                  {copied ? "Скопировано" : "Скопировать ключ"}
                </button>
              </div>
              <code>{order.key_value}</code>
              {copyError && <p className="purchase-delivery-error" role="alert">{copyError}</p>}
            </div>
          )}
        </section>

        {instruction && (
          <a
            className="purchase-delivery-guide"
            href={instruction.href}
            target={instruction.external ? "_blank" : undefined}
            rel={instruction.external ? "noreferrer" : undefined}
          >
            <span className="purchase-delivery-guide-label">
              <span className="purchase-delivery-guide-icon" aria-hidden="true">↗</span>
              Инструкция по установке {order?.product || "купленного чита"}
            </span>
            <span className="purchase-delivery-guide-arrow" aria-hidden="true">→</span>
          </a>
        )}

        <div className="purchase-delivery-note">
          <span className="purchase-delivery-check" aria-hidden="true">✓</span>
          <span>После выдачи ключ также придёт на вашу почту и будет доступен в личном кабинете в разделе «Мои покупки».</span>
        </div>
        <div className="purchase-delivery-actions">
          <Link to="/orders">Открыть «Мои покупки» →</Link>
          {order && <span>Заказ #{order.order_id}</span>}
        </div>
      </section>
    </main>
  );
}
