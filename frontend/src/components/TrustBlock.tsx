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
            ПОНЯТНЫЙ ВЫБОР <span>БЕЗ СЮРПРИЗОВ</span>
          </p>
          <h3>Всё важное — в карточке товара</h3>
          <p className="trust-block__copy">
            Перед покупкой можно изучить описание, функции, тарифы и инструкции — и выбрать
            подходящий вариант.
          </p>
          <div className="trust-block__visual">
            {["Описание и скриншоты", "Функции по категориям", "Тарифы и инструкции"].map((label) => (
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
          <p className="trust-block__eyebrow">УСЛОВИЯ ПОКУПКИ</p>
          <h3>Условия известны заранее</h3>
          <p className="trust-block__copy">
            Срок действия и стоимость тарифа указаны до оформления заказа.
          </p>
          <Link className="trust-block__action" to="/catalog">
            Как проходит покупка <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="trust-block__card trust-block__card--reviews">
          <p className="trust-block__eyebrow">ОТЗЫВЫ ПОКУПАТЕЛЕЙ</p>
          <h3>Выбирайте с опорой на опыт</h3>
          <p className="trust-block__copy">
            Изучите отзывы о товаре и сравните впечатления покупателей перед выбором.
          </p>
          <div className="trust-block__feature-icon" aria-hidden="true">☆</div>
          <Link className="trust-block__action" to="/catalog">
            Открыть каталог <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="trust-block__card trust-block__card--support">
          <div className="trust-block__support-content">
            <p className="trust-block__eyebrow">ПОДДЕРЖКА ПОКУПАТЕЛЕЙ</p>
            <h3>Поможем разобраться</h3>
            <p className="trust-block__copy">
              Если возник вопрос по заказу или работе сайта, свяжитесь с командой поддержки.
            </p>
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
            <a className="trust-block__action" href="https://t.me/Millex" target="_blank" rel="noopener noreferrer">
              Написать в поддержку <span aria-hidden="true">→</span>
            </a>
          </div>
        </article>

        <article className="trust-block__card trust-block__card--community">
          <p className="trust-block__eyebrow">КАНАЛЫ MILLEX</p>
          <h3>Новости и общение</h3>
          <p className="trust-block__copy">
            Следите за обновлениями и присоединяйтесь к сообществу в привычном канале.
          </p>
          <div className="trust-block__contact-links trust-block__contact-links--community">
            <a href="https://t.me/millexnews" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.7 4.4 18.5 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 13.6 1.1 12c-1.1-.3-1.1-1 .2-1.5L20.4 3c.9-.3 1.7.2 1.3 1.4Z" />
              </svg>
              Telegram ↗
            </a>
            <a href="https://discord.gg/millex" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.7 5.3A18.2 18.2 0 0 0 15.2 4l-.6 1.2a16.7 16.7 0 0 0-5.2 0L8.8 4a18.2 18.2 0 0 0-4.5 1.3C1.5 9.5.7 13.6 1.1 17.7a18.4 18.4 0 0 0 5.5 2.8l1.2-1.9-1.9-.9.5-.4c3.7 1.7 7.6 1.7 11.2 0l.5.4-1.9.9 1.2 1.9a18.4 18.4 0 0 0 5.5-2.8c.5-4.7-.8-8.8-3.2-12.4ZM8.7 14.5c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 .9 2 2.2-.9 2.2-2 2.2Zm6.6 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 .9 2 2.2-.9 2.2-2 2.2Z" />
              </svg>
              Discord ↗
            </a>
          </div>
        </article>

        <article className="trust-block__card trust-block__card--open">
          <p className="trust-block__eyebrow">ОТКРЫТЫЕ УСЛОВИЯ</p>
          <h3>Правила доступны всем</h3>
          <p className="trust-block__copy">
            Ознакомьтесь с условиями сервиса и правилами до оформления заказа.
          </p>
          <div className="trust-block__open-list">
            <span>Понятные правила</span>
            <span>Информация о заказе</span>
          </div>
          <Link className="trust-block__action" to="/user-agreement">
            Условия сервиса <span aria-hidden="true">→</span>
          </Link>
        </article>
      </div>
    </section>
  );
}
