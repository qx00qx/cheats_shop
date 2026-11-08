import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const TELEGRAM_URL = "https://t.me/Millex";
const VISIBLE_UNTIL_KEY = "contact-promo-visible-until";
const DISMISSED_KEY = "contact-promo-dismissed";
const DISPLAY_DURATION_MS = 5 * 60 * 1000;

export default function ContactPromoBanner() {
  const { pathname } = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISSED_KEY) === "true") {
      setIsDismissed(true);
      return;
    }

    const visibleUntil = Number(window.localStorage.getItem(VISIBLE_UNTIL_KEY));
    const remainingTime = visibleUntil - Date.now();

    if (remainingTime > 0) {
      setIsVisible(true);
      const hideTimeout = window.setTimeout(() => {
        setIsVisible(false);
        window.localStorage.removeItem(VISIBLE_UNTIL_KEY);
      }, remainingTime);
      return () => window.clearTimeout(hideTimeout);
    }

    window.localStorage.removeItem(VISIBLE_UNTIL_KEY);
    let hideTimeout: number;
    const showTimeout = window.setTimeout(() => {
      window.localStorage.setItem(
        VISIBLE_UNTIL_KEY,
        String(Date.now() + DISPLAY_DURATION_MS),
      );
      setIsVisible(true);
      hideTimeout = window.setTimeout(() => {
        setIsVisible(false);
        window.localStorage.removeItem(VISIBLE_UNTIL_KEY);
      }, DISPLAY_DURATION_MS);
    }, 20000 + Math.random() * 10000);
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, []);

  const isExcludedPage =
    pathname.startsWith("/asdnrwe") || pathname === "/login" || pathname === "/register";

  if (!isVisible || isDismissed || isExcludedPage) {
    return null;
  }

  return (
    <aside className="contact-promo" role="status" aria-label="Связаться с администратором">
      <span className="contact-promo__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M3 10v4h4l5 4V6l-5 4H3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <p className="contact-promo__message">
        Кусается комиссия или нету нужного метода? Напишите администратору:{" "}
        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">@Millex</a>
      </p>
      <a
        className="contact-promo__button"
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Подробнее
        <span aria-hidden="true">›</span>
      </a>
      <button
        className="contact-promo__close"
        type="button"
        aria-label="Закрыть уведомление"
        onClick={() => {
          window.localStorage.setItem(DISMISSED_KEY, "true");
          window.localStorage.removeItem(VISIBLE_UNTIL_KEY);
          setIsDismissed(true);
        }}
      >
        ×
      </button>
    </aside>
  );
}
