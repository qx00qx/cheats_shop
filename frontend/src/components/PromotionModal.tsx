import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCheatPromotion } from "../api/catalog";
import { type CheatPromotion } from "../utils/cheatPromotion";

const DISMISSED_KEY = "millex_black_friday_2026_dismissed";

export default function PromotionModal() {
  const [promotion, setPromotion] = useState<CheatPromotion | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;

    let active = true;
    getCheatPromotion()
      .then((result) => {
        if (!active) return;
        setPromotion(result);
        setIsOpen(
          result.active &&
          result.discount_percent > 0 &&
          Date.now() < new Date(result.ends_at).getTime(),
        );
      })
      .catch((error) => {
        console.error("Failed to load promotion notice:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setIsOpen(false);
  };

  if (!isOpen || !promotion) return null;

  return (
    <div
      className="home-promo-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <section
        className="home-promo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-promo-title"
      >
        <button
          className="home-promo-close"
          type="button"
          aria-label="Закрыть уведомление"
          onClick={dismiss}
        >
          ×
        </button>
        <span className="home-promo-kicker">Только до 14 ноября!</span>
        <div className="home-promo-value">−{promotion.discount_percent}%</div>
        <h2 id="home-promo-title">−20% В ЧЁРНУЮ ПЯТНИЦУ ДЛЯ ВСЕХ!</h2>
        <p>
          Скидка действует на ВСЁ, включая аккаунты! Твоя накопительная скидка сохраняется и
          продолжит расти, но применится уже после окончания акции.
        </p>
        <span className="home-promo-until">до 14.11.2026</span>
        <Link to="/catalog" className="home-promo-action" onClick={dismiss}>
          Выбрать товар
        </Link>
      </section>
    </div>
  );
}
