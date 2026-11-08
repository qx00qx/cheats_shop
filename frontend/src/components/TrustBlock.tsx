import { Link } from "react-router-dom";
import "./TrustBlock.css";

function DiamondIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 22 12 12 22 2 12 12 2Zm0 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
    </svg>
  );
}

export default function TrustBlock() {
  return (
    <section className="trust-block" aria-labelledby="trust-block-title">
      <header className="trust-block__heading">
        <h2 id="trust-block-title">Почему нас выбирают</h2>
        <p>Понятные условия, информация о товарах и поддержка, когда она нужна.</p>
      </header>

      <div className="trust-block__grid">
        <article className="trust-block__card trust-block__card--overview">
          <p className="trust-block__eyebrow">
            НАКОПИТЕЛЬНЫЕ <span>СКИДКИ</span>
          </p>
          <h3>Скидка за каждую покупку</h3>
          <p className="trust-block__copy">
            Скидка растёт с каждой покупкой: <strong>1 000 ₽ = 1%</strong> — до 10%.
          </p>
          <div className="trust-block__visual">
            {["1 000 ₽ = 1%", "Скидка растёт", "До 10%"].map((label) => (
              <div className="trust-block__step" key={label}>
                <span className="trust-block__step-icon">
                  <DiamondIcon />
                </span>
                {label}
              </div>
            ))}
          </div>
        </article>

        <article className="trust-block__card trust-block__card--terms">
          <p className="trust-block__eyebrow">ГАРАНТИЯ ВОЗВРАТА</p>
          <h3>Не работает — вернём деньги</h3>
          <p className="trust-block__copy">Без вопросов и бюрократии.</p>
          <Link className="trust-block__action" to="/user-agreement">
            Условия гарантии <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="trust-block__card trust-block__card--reviews">
          <p className="trust-block__eyebrow">ПОДДЕРЖКА 24/7</p>
          <h3>Ответим днём и ночью</h3>
          <p className="trust-block__copy">
            Решим вопрос оперативно, а не шаблонами.
          </p>
          <div className="trust-block__feature-icon" aria-hidden="true">☆</div>
          <a
            className="trust-block__action"
            href="https://t.me/Millex"
            target="_blank"
            rel="noopener noreferrer"
          >
            Написать в поддержку <span aria-hidden="true">→</span>
          </a>
        </article>

        <article className="trust-block__card trust-block__card--support">
          <div className="trust-block__support-content">
            <p className="trust-block__eyebrow">ОПЫТ И НАДЁЖНОСТЬ</p>
            <h3>45 000+ пользователей доверяют нам</h3>
            <p className="trust-block__copy">На рынке с 2022 года.</p>
          </div>
          <div className="trust-block__support-footer">
            <div className="trust-block__support-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <path d="M8 26v-4a16 16 0 0 1 32 0v4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M8 25h5v11h-2a3 3 0 0 1-3-3v-8Zm32 0h-5v11h2a3 3 0 0 0 3-3v-8Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M35 37a7 7 0 0 1-7 5h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="21" cy="42" r="2" fill="#00e98a" />
              </svg>
            </div>
            <Link className="trust-block__action" to="/catalog">
              Опыт с 2022 года <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>

        <article className="trust-block__card trust-block__card--community">
          <p className="trust-block__eyebrow">ПРОЗРАЧНЫЕ УСЛОВИЯ</p>
          <h3>Правила и тарифы до оплаты</h3>
          <p className="trust-block__copy">
            Все правила и тарифы видны до оплаты.
          </p>
          <div className="trust-block__contact-links trust-block__contact-links--community">
            <Link to="/user-agreement">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.7 4.4 18.5 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 13.6 1.1 12c-1.1-.3-1.1-1 .2-1.5L20.4 3c.9-.3 1.7.2 1.3 1.4Z" />
              </svg>
              Условия сервиса ↗
            </Link>
            <Link to="/catalog">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.7 5.3A18.2 18.2 0 0 0 15.2 4l-.6 1.2a16.7 16.7 0 0 0-5.2 0L8.8 4a18.2 18.2 0 0 0-4.5 1.3C1.5 9.5.7 13.6 1.1 17.7a18.4 18.4 0 0 0 5.5 2.8l1.2-1.9-1.9-.9.5-.4c3.7 1.7 7.6 1.7 11.2 0l.5.4-1.9.9 1.2 1.9a18.4 18.4 0 0 0 5.5-2.8c.5-4.7-.8-8.8-3.2-12.4ZM8.7 14.5c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 .9 2 2.2-.9 2.2-2 2.2Zm6.6 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 .9 2 2.2-.9 2.2-2 2.2Z" />
              </svg>
              Каталог тарифов ↗
            </Link>
          </div>
        </article>

        <article className="trust-block__card trust-block__card--open">
          <p className="trust-block__eyebrow">СООБЩЕСТВО</p>
          <h3>Живой чат игроков</h3>
          <p className="trust-block__copy">
            Делимся опытом, помогаем друг другу.
          </p>
          <div className="trust-block__open-list">
            <span>Общение игроков</span>
            <span>Обмен опытом</span>
          </div>
          <a
            className="trust-block__action"
            href="https://discord.gg/millex"
            target="_blank"
            rel="noopener noreferrer"
          >
            Вступить в чат <span aria-hidden="true">→</span>
          </a>
        </article>
      </div>
    </section>
  );
}
