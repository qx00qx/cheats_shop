import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AccountLayout from "../components/AccountLayout";
import { BonusesAPI, type BonusSummary } from "../api/bonuses";

function formatRub(value: number) {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

export default function BonusesPage() {
  const [summary, setSummary] = useState<BonusSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    BonusesAPI.me()
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch(() => {
        if (active) setError("Не удалось загрузить информацию о бонусах.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AccountLayout activeSection="bonuses">
      <div className="referral-heading">
        <span className="referral-eyebrow">НАКОПИТЕЛЬНАЯ СКИДКА</span>
        <h1 className="lk-card-title">Бонусы</h1>
        <p className="referral-description">
          Каждые <strong>1 000 ₽</strong> потраченных на покупки дают <strong>+1% скидки</strong>.
          Максимум — 10% при тратах от 10 000 ₽.
        </p>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {!summary && !error && <div className="referral-loading" role="status">Загружаем ваши бонусы…</div>}

      {summary && (
        <>
          <section className="account-bonus-card" aria-labelledby="account-discount-title">
            <div className="account-bonus-card__heading">
              <div>
                <span className="account-bonus-card__label">Ваша скидка сейчас</span>
                <h2 id="account-discount-title">Накопительная скидка</h2>
              </div>
              <strong className="account-bonus-card__percent">{summary.discount_percent}%</strong>
            </div>

            <div
              className="account-bonus-progress"
              role="progressbar"
              aria-label="Прогресс накопительной скидки"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={summary.progress_percent}
            >
              <span style={{ width: `${summary.progress_percent}%` }} />
            </div>
            <div className="account-bonus-progress__labels">
              <span>Потрачено: <strong>{formatRub(summary.total_spent)}</strong></span>
              <span>10 000 ₽ = 10%</span>
            </div>

            <p className="account-bonus-next">
              {summary.discount_percent >= 10
                ? "У вас максимальная скидка 10%. Она применяется автоматически к новым покупкам."
                : `Ещё ${formatRub(summary.amount_to_next_discount)} покупок — и скидка вырастет до ${summary.next_discount_percent}%.`}
            </p>
          </section>

          <div className="account-bonus-facts">
            <article>
              <span>За каждые</span>
              <strong>1 000 ₽</strong>
              <p>потраченных на заказы</p>
            </article>
            <article>
              <span>Добавляется</span>
              <strong>+1%</strong>
              <p>к вашей накопительной скидке</p>
            </article>
            <article>
              <span>Максимум</span>
              <strong>10%</strong>
              <p>при тратах от 10 000 ₽</p>
            </article>
          </div>

          <section className={`account-referral-bonus${summary.referral_discount_available ? " is-active" : ""}`}>
            <div>
              <span className="account-bonus-card__label">По реферальной ссылке</span>
              <h2>{summary.referral_discount_percent}% на первую покупку</h2>
              {summary.is_referred ? (
                <p>
                  {summary.referral_discount_available
                    ? "Скидка доступна и применится автоматически при оформлении первого заказа."
                    : summary.referral_discount_used
                      ? "Скидка на первую покупку использована. Дальше действует ваша накопительная скидка."
                      : "Скидка действует только на первую покупку нового пользователя."}
                </p>
              ) : (
                <p>Новые пользователи, которые зарегистрируются по вашей ссылке, получат 5% на первую покупку.</p>
              )}
            </div>
            {summary.referral_discount_available ? (
              <span className="account-referral-bonus__status">Доступна</span>
            ) : (
              <Link to="/profile/referrals" className="account-referral-bonus__link">Моя реферальная ссылка →</Link>
            )}
          </section>
        </>
      )}
    </AccountLayout>
  );
}
