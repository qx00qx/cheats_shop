import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../static/styles/components/domain-notice.css";

export default function DomainNoticeModal() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (location.pathname !== "/") return;

    const params = new URLSearchParams(location.search);
    if (
      params.get("utm_source")?.toLowerCase() !== "yandex" ||
      params.get("utm_campaign")?.toLowerCase() !== "domain_notice"
    ) {
      return;
    }

    setIsOpen(true);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="domain-notice-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
    >
      <section
        className="domain-notice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="domain-notice-title"
        aria-describedby="domain-notice-description"
      >
        <button
          className="domain-notice-close"
          type="button"
          aria-label="Закрыть уведомление"
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
        <span className="domain-notice-kicker">ОФИЦИАЛЬНОЕ ОБЪЯВЛЕНИЕ</span>
        <h2 id="domain-notice-title">МЫ ПЕРЕЕХАЛИ!</h2>
        <div className="domain-notice-copy" id="domain-notice-description">
          <p>
            Старый домен millex.xyz был украден мошенниками.
            <br />
            Наш новый официальный сайт:{" "}
            <strong className="domain-notice-domain">millex.market</strong>
          </p>
          <ul>
            <li>
              <span className="domain-notice-list-marker" aria-hidden="true" />
              Личные кабинеты и баланс перенесены
            </li>
            <li>
              <span className="domain-notice-list-marker" aria-hidden="true" />
              Ваши накопительные скидки сохранены
            </li>
            <li>
              <span className="domain-notice-list-marker" aria-hidden="true" />
              Автовыдача ключей активна
            </li>
          </ul>
        </div>
        <a
          className="domain-notice-telegram"
          href="https://t.me/millexnews/2187"
          target="_blank"
          rel="noreferrer"
        >
          <span>
            Подробности и доказательства
            <small>в нашем Telegram-канале</small>
          </span>
        </a>
        <Link
          to="/catalog"
          className="domain-notice-catalog"
          onClick={() => setIsOpen(false)}
        >
          Перейти в каталог
        </Link>
      </section>
    </div>
  );
}
