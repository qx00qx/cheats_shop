import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import {
  BonusBottomCta,
  BonusHero,
  BonusSectionHeading,
  BonusSteps,
} from "../components/BonusBlocks";

const discountLevels = [
  { number: "01", name: "Старт", threshold: "Первая покупка", percent: 0, note: "Скидка начнёт расти после покупок" },
  { number: "02", name: "Первый процент", threshold: "1 000 ₽ покупок", percent: 1, note: "+1% за каждую полную тысячу" },
  { number: "03", name: "На полпути", threshold: "5 000 ₽ покупок", percent: 5, note: "Скидка 5% на следующие заказы" },
  { number: "04", name: "Максимум", threshold: "10 000 ₽ покупок", percent: 10, note: "Максимальная скидка достигнута" },
];

const loyaltySteps = [
  {
    number: "01",
    title: "Покупаете",
    text: "Выбирайте товары и оплачивайте заказы как обычно. В прогресс идёт фактически потраченная сумма.",
  },
  {
    number: "02",
    title: "Копите сумму покупок",
    text: "Каждая полная 1 000 ₽ добавляет 1% к вашей накопительной скидке. Ничего активировать не нужно.",
  },
  {
    number: "03",
    title: "Экономите автоматически",
    text: "Скидка сама применяется к следующим заказам. При тратах от 10 000 ₽ она достигает максимума — 10%.",
  },
];

const loyaltyFaq = [
  {
    question: "Как увеличить накопительную скидку?",
    answer: "Просто совершайте покупки. Каждые полные 1 000 ₽ из фактически потраченной суммы добавляют 1%. Например, при тратах 2 500 ₽ ваша скидка составит 2%.",
  },
  {
    question: "Нужно ли вводить промокод?",
    answer: "Нет. Накопительная скидка применяется автоматически при оформлении заказа для авторизованного пользователя.",
  },
  {
    question: "Когда будет максимальная скидка?",
    answer: "Когда сумма ваших покупок достигнет 10 000 ₽. После этого скидка составит 10% и не будет зависеть от количества отдельных заказов.",
  },
  {
    question: "Где посмотреть текущий прогресс?",
    answer: "В личном кабинете откройте раздел «Бонусы». Там видны потраченная сумма, текущий процент и сумма до следующего процента.",
  },
];

export default function LoyaltyPage() {
  return (
    <div className="bonus-page loyalty-page">
      <Seo
        pageKey="loyalty"
        title="Накопительная скидка"
        description="Каждые 1 000 ₽ покупок в Millex добавляют 1% к накопительной скидке. Максимум 10% при тратах от 10 000 ₽."
        canonicalPath="/loyalty"
      />

      <BonusHero
        kicker="Millex loyalty"
        title={<>Больше покупок.<br /><span>Больше скидка</span></>}
        lead="Каждые 1 000 ₽, потраченные на заказы, добавляют 1% к вашей скидке. Она растёт до 10% и автоматически применяется к новым покупкам."
        actions={(
          <>
            <Link to="/profile/bonuses" className="catalog-hero-button">
              Мой прогресс <span aria-hidden="true">↗</span>
            </Link>
            <a href="#loyalty-levels" className="bonus-button btn-ghost">Как растёт скидка</a>
          </>
        )}
        visual={(
          <div className="loyalty-example" aria-label="Пример накопительной скидки">
            <div className="loyalty-example__heading">
              <span>Пример прогресса</span>
              <span className="loyalty-example__badge">Автоматически</span>
            </div>
            <div className="loyalty-example__balance">
              <span>Потрачено на покупки: 4 000 ₽</span>
              <strong>4<small>%</small></strong>
              <span className="loyalty-example__rate">Скидка на следующие заказы</span>
            </div>
            <div className="loyalty-example__conversion">
              <span>Заказ на 500 ₽</span><i>=</i><strong>Экономия 20 ₽</strong>
            </div>
            <div className="loyalty-example__footer">
              <span>До скидки 5%</span>
              <strong>Ещё 1 000 ₽</strong>
              <div><i style={{ width: "40%" }} /></div>
            </div>
          </div>
        )}
        stats={[
          { value: "1 000 ₽ = 1%", label: "за каждую полную тысячу" },
          { value: "10 000 ₽ = 10%", label: "максимальная скидка" },
          { value: "Автоматически", label: "без промокода при оформлении" },
        ]}
      />

      <section className="bonus-section bonus-container">
        <BonusSectionHeading
          kicker="Как это работает"
          title="Скидка растёт вместе с покупками"
          description="Ваш прогресс всегда можно проверить в разделе «Бонусы»."
        />
        <BonusSteps steps={loyaltySteps} />
      </section>

      <section className="bonus-section bonus-container" id="loyalty-levels">
        <BonusSectionHeading
          row
          kicker="Шкала скидки"
          title="Каждая тысяча добавляет процент"
          description="Учитывается вся фактически потраченная сумма. Для роста не важно, один это заказ или несколько."
        />
        <div className="loyalty-levels">
          {discountLevels.map((level) => (
            <article className="loyalty-level" key={level.name}>
              <div className="loyalty-level__top">
                <span>{level.number}</span>
                <span className="loyalty-level__mark" aria-hidden="true">◆</span>
              </div>
              <h3>{level.name}</h3>
              <p>{level.threshold}</p>
              <strong className="loyalty-level__percent">{level.percent}<span>%</span></strong>
              <span className="loyalty-level__caption">накопительная скидка</span>
              <div className="loyalty-level__reward">
                <strong>{level.note}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bonus-section bonus-container">
        <BonusSectionHeading kicker="Простой расчёт" title="Как скидка работает на практике" />
        <div className="loyalty-spend-grid">
          <article className="loyalty-spend-card">
            <span className="bonus-card-label">Накопление</span>
            <h3>2 500 ₽ потрачено</h3>
            <p>Две полные тысячи дают 2%. Оставшиеся 500 ₽ не пропадают и учитываются на пути к следующему проценту.</p>
            <div className="loyalty-spend-card__example">
              <span>Текущая скидка</span><strong>2%</strong>
            </div>
          </article>
          <article className="loyalty-spend-card">
            <span className="bonus-card-label">Применение</span>
            <h3>Заказ на 1 000 ₽</h3>
            <p>При накопительной скидке 2% новый заказ автоматически станет дешевле. Отдельно активировать её не нужно.</p>
            <div className="loyalty-spend-card__example">
              <span>К оплате</span><strong>980 ₽ вместо 1 000 ₽</strong>
            </div>
          </article>
        </div>
        <div className="loyalty-notice">
          <strong>Важно знать</strong>
          <ul>
            <li>Учитывается сумма успешно оплаченных покупок.</li>
            <li>Каждая полная 1 000 ₽ добавляет 1% к скидке.</li>
            <li>Скидка применяется автоматически для авторизованного пользователя.</li>
            <li>Максимальная накопительная скидка — 10% при тратах от 10 000 ₽.</li>
          </ul>
        </div>
      </section>

      <section className="bonus-section bonus-container">
        <BonusSectionHeading kicker="Вопросы и ответы" title="Коротко о главном" />
        <div className="loyalty-faq">
          {loyaltyFaq.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>{item.question}<span aria-hidden="true">+</span></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <BonusBottomCta
        kicker="Ваши бонусы"
        title={<>Проверьте, сколько осталось<br />до следующего процента</>}
        text="В личном кабинете видны текущая скидка, потраченная сумма и прогресс до максимума."
        action={(
          <Link to="/profile/bonuses" className="catalog-hero-button">
            Открыть раздел «Бонусы» <span aria-hidden="true">→</span>
          </Link>
        )}
      />
    </div>
  );
}
