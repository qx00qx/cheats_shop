import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo";
import { api } from "../api/client";
import { useAuth } from "../store/auth";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const { loadMe } = useAuth();
  const isTopUp = searchParams.get("type") === "topup";
  const reference = searchParams.get("reference");
  const [status, setStatus] = useState<"checking" | "confirmed" | "pending" | "failed" | "error">(
    isTopUp ? "checking" : "confirmed",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isTopUp) return;
    if (!reference) {
      setStatus("error");
      setMessage("В ссылке отсутствует номер пополнения. Проверьте баланс в личном кабинете.");
      return;
    }

    let active = true;
    let timeoutId: number | undefined;
    const deadline = Date.now() + 60_000;

    const checkTopUp = async () => {
      try {
        const response = await api.get("/payments/topup/latest", {
          params: { reference },
        });
        if (!active) return;

        if (response.data.status === "confirmed") {
          const balanceRefreshed = await loadMe();
          if (!active) return;
          setStatus("confirmed");
          if (!balanceRefreshed) {
            setMessage("Оплата подтверждена, но баланс не удалось обновить. Проверьте его в личном кабинете.");
          }
          return;
        }
        if (response.data.status === "failed" || response.data.status === "chargebacked") {
          setStatus("failed");
          setMessage("Пополнение не было зачислено. Если деньги списались, обратитесь в поддержку.");
          return;
        }
        if (Date.now() >= deadline) {
          setStatus("pending");
          setMessage("Платёж ещё обрабатывается. Баланс обновится после подтверждения провайдера.");
          return;
        }

        setStatus("checking");
        setMessage("Ожидаем подтверждение от платёжной системы.");
        timeoutId = window.setTimeout(checkTopUp, 3000);
      } catch (error: unknown) {
        if (!active) return;
        console.error("Failed to check returned balance top-up:", error);
        const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
        if ((statusCode === 502 || statusCode === 504) && Date.now() < deadline) {
          setMessage("Не удалось связаться с платёжной системой. Повторяем проверку...");
          timeoutId = window.setTimeout(checkTopUp, 3000);
          return;
        }
        setStatus("error");
        setMessage(
          statusCode === 401
            ? "Войдите в аккаунт, чтобы проверить зачисление. Затем откройте страницу баланса."
            : "Не удалось проверить статус пополнения. Проверьте баланс в личном кабинете позже.",
        );
      }
    };

    void checkTopUp();
    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [isTopUp, reference, loadMe]);

  const title = isTopUp
    ? status === "confirmed"
      ? "Баланс пополнен"
      : status === "failed"
        ? "Пополнение не завершено"
        : "Проверяем оплату"
    : "Оплата прошла";

  return (
    <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
      <Seo title={title} noIndex />
      <h1 className="page-title">
        {status === "confirmed" ? "✅" : status === "failed" ? "❌" : "⏳"} {title}
      </h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        {isTopUp
          ? message || (
            status === "confirmed"
              ? "Оплата подтверждена, баланс обновлён."
              : "Проверяем подтверждение платежа. Не оплачивайте пополнение повторно."
          )
          : "Заказ активирован. Загляните в личный кабинет."}
      </p>
      <Link to={isTopUp ? "/profile/balance" : "/profile"} className="btn-primary">
        {isTopUp ? "Перейти к балансу" : "Личный кабинет"}
      </Link>
    </div>
  );
}