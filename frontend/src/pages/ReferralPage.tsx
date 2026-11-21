import { useEffect, useState } from "react";
import AccountLayout from "../components/AccountLayout";
import { ReferralsAPI, ReferralSummary } from "../api/referrals";

function formatReferralDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(date);
}

export default function ReferralPage() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    ReferralsAPI.me()
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch(() => {
        if (active) setError("Не удалось загрузить данные реферальной программы.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function copyLink() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.link);
      setCopyMessage("Ссылка скопирована.");
    } catch {
      setCopyMessage("Не удалось скопировать ссылку. Скопируйте её вручную.");
    }
  }

  return (
    <AccountLayout activeSection="referrals">
      <div className="referral-heading">
        <span className="referral-eyebrow">БОНУС НА БАЛАНС</span>
        <h1 className="lk-card-title">Реферальная программа</h1>
        <p className="referral-description">
          Делитесь ссылкой с друзьями и получайте{" "}
          <strong>{summary?.commission_percent ?? 5}%</strong> с каждой их успешной
          покупки.
        </p>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {!summary && !error && (
        <div className="referral-loading" role="status">Загружаем данные программы…</div>
      )}

      {summary && (
        <>
          {summary.invited_by && (
            <section className="referral-inviter" aria-label="Ваш пригласивший">
              <span className="referral-inviter-mark" aria-hidden="true">↗</span>
              <div>
                <span className="referral-inviter-label">Вас пригласил</span>
                <strong>{summary.invited_by}</strong>
              </div>
            </section>
          )}

          {summary.invited_by && (
            <section className={`account-referral-bonus${summary.first_purchase_discount_available ? " is-active" : ""}`}>
              <div>
                <span className="account-bonus-card__label">Бонус за регистрацию по ссылке</span>
                <h2>{summary.first_purchase_discount_percent}% на первую покупку</h2>
                <p>
                  {summary.first_purchase_discount_available
                    ? "Скидка доступна и применится автоматически при оформлении первого заказа."
                    : "Скидка на первую покупку использована. Ваши реферальные начисления за приглашения продолжают работать."}
                </p>
              </div>
              <span className="account-referral-bonus__status">
                {summary.first_purchase_discount_available ? "Доступна" : "Использована"}
              </span>
            </section>
          )}

          <section className="referral-link-card" aria-labelledby="referral-link-title">
            <div className="referral-card-heading">
              <div>
                <h2 id="referral-link-title">Ваша ссылка</h2>
                <p>Друг зарегистрируется по ней — приглашение закрепится за вами.</p>
              </div>
              <span className="referral-rate">{summary.commission_percent}%</span>
            </div>
            <div className="referral-link-row">
              <input
                id="referral-link"
                type="text"
                readOnly
                value={summary.link}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Ваша персональная реферальная ссылка"
              />
              <button className="referral-copy-button" type="button" onClick={copyLink}>
                <span aria-hidden="true">↗</span> Скопировать
              </button>
            </div>
            {copyMessage && (
              <p className="referral-copy-status" role="status">{copyMessage}</p>
            )}
          </section>

          <section className="referral-stats" aria-label="Результаты приглашений">
            <article className="referral-stat-card">
              <span className="referral-stat-label">Приглашено</span>
              <strong className="referral-stat-value">{summary.invited_count}</strong>
              <span className="referral-stat-caption">пользователей</span>
            </article>
            <article className="referral-stat-card">
              <span className="referral-stat-label">Покупки</span>
              <strong className="referral-stat-value">{summary.purchases_count}</strong>
              <span className="referral-stat-caption">успешных заказов</span>
            </article>
            <article className="referral-stat-card referral-stat-card--earned">
              <span className="referral-stat-label">Ваш доход</span>
              <strong className="referral-stat-value">
                {summary.earned_total.toFixed(2)} ₽
              </strong>
              <span className="referral-stat-caption">зачислено на баланс</span>
            </article>
          </section>

          <section className="referral-invitees" aria-labelledby="referral-invitees-title">
            <div className="referral-list-heading">
              <div>
                <h2 id="referral-invitees-title">Ваши приглашённые</h2>
                <p>Начисления и покупки по каждому участнику программы.</p>
              </div>
              <span>{summary.invitees.length}</span>
            </div>
            {summary.invitees.length ? (
              <div className="referral-table-wrap">
                <table className="referral-table">
                  <thead>
                    <tr>
                      <th scope="col">Пользователь</th>
                      <th scope="col">Регистрация</th>
                      <th scope="col">Покупки</th>
                      <th scope="col">Ваш доход</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.invitees.map((invitee) => (
                      <tr key={invitee.username}>
                        <th scope="row">
                          <span className="referral-user-avatar" aria-hidden="true">
                            {invitee.username.charAt(0).toUpperCase()}
                          </span>
                          {invitee.username}
                        </th>
                        <td>{formatReferralDate(invitee.created_at)}</td>
                        <td>{invitee.purchases_count}</td>
                        <td className="referral-table-earned">
                          {invitee.earned_total.toFixed(2)} ₽
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="referral-empty-state">
                <span className="referral-empty-icon" aria-hidden="true">↗</span>
                <strong>Пока никого нет</strong>
                <p>Поделитесь своей ссылкой — новые участники появятся здесь.</p>
              </div>
            )}
          </section>
        </>
      )}
    </AccountLayout>
  );
}
