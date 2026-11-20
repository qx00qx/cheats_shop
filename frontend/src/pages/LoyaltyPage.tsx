import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import {
  BonusBottomCta,
  BonusHero,
  BonusSectionHeading,
  BonusSteps,
} from "../components/BonusBlocks";

const loyaltyLevels = [
  { number: "01", name: "Новичок", threshold: "С первой покупки", percent: 3, reward: 30 },
  { number: "02", name: "Игрок", threshold: "От 1 500 ₽ покупок", percent: 5, reward: 50 },
  { number: "03", name: "Ветеран", threshold: "От 5 000 ₽ покупок", percent: 7, reward: 70 },
  { number: "04", name: "Легенда", threshold: "От 15 000 ₽ покупок", percent: 10, reward: 100 },
];

const loyaltySteps = [
  {
    number: "01",
    title: "Покупаете",
    text: "Выбирайте нужный продукт и оплачивайте заказ как обычно. Сумма покупки учитывается в общем прогрессе уровня.",
  },
  {
    number: "02",
    title: "Получаете бонусы",
    text: "После успешной выдачи заказа на бонусный счёт возвращается от 3 до 10% его стоимости.",
  },
  {
    number: "03",
    title: "Тратите, когда хотите",
    text: "Используйте накопления при следующей оплате или продолжайте копить. Один бонус равен одному рублю.",
  },
];

const loyaltyFaq = [
  {
    question: "Сколько стоит один бонус?",
    answer: "1 бонус равен 1 ₽. Если на счёте 300 бонусов, ими можно уменьшить стоимость заказа на 300 ₽ с учётом ограничения на оплату бонусами.",
  },
  {
    question: "Можно получить и потратить бонусы в одном заказе?",
    answer: "Нет. При оплате вы выбираете один вариант: списать накопленные бонусы или получить новые за этот заказ.",
  },
  {
    question: "Учитываются ли прошлые покупки?",
    answer: "Для уровня учитывается общая сумма покупок за всё время. Чем больше сумма, тем выше процент начисления на следующие заказы.",
  },
  {
    question: "Можно вывести или передать бонусы?",
    answer: "Нет. Бонусы не являются денежными средствами: они предназначены только для оплаты части заказов на сайте.",
  },
];

export default function LoyaltyPage() {
  return (
    <div className="bonus-page loyalty-page">
      <Seo
        pageKey="loyalty"
        title="Бонусная система"
        description="Бонусная система Millex: получайте от 3 до 10% за покупки, повышайте уровень и оплачивайте бонусами следующие заказы."
        canonicalPath="/loyalty"
      />

      <BonusHero
        kicker="Millex loyalty"
        title={<>Покупки<br /><span>приносят бонусы</span></>}
        lead="Часть суммы заказа возвращается на ваш бонусный счёт. Повышайте уровень, копите бонусы и экономьте на следующих покупках."
        actions={(
          <>
            <Link to="/catalog" className="bonus-button bonus-button--primary">
              Перейти в каталог <span aria-hidden="true">↗</span>
            </Link>
            <a href="#loyalty-levels" className="bonus-button bonus-button--secondary">Посмотреть уровни</a>
          </>
        )}
        visual={(
          <div className="loyalty-example" aria-label="Пример начисления бонусов">
            <div className="loyalty-example__heading">
              <span>Пример начисления</span>
              <span className="loyalty-example__badge">Ветеран</span>
            </div>
            <div className="loyalty-example__balance">
              <span>За заказ на 1 000 ₽</span>
              <strong>+70 <small>бонусов</small></strong>
              <span className="loyalty-example__rate">Кэшбэк 7% на уровне «Ветеран»</span>
            </div>
            <div className="loyalty-example__conversion">
              <span>1 бонус</span><i>=</i><strong>1 ₽</strong>
            </div>
            <div className="loyalty-example__footer">
              <span>Следующий уровень</span>
              <strong>10% кэшбэк</strong>
              <div><i /></div>
            </div>
          </div>
        )}
        stats={[
          { value: "3–10%", label: "возврат с заказа" },
          { value: "1 бонус = 1 ₽", label: "простой расчёт выгоды" },
          { value: "До 50%", label: "заказа можно оплатить бонусами" },
        ]}
      />

      <section className="bonus-section bonus-container">
        <BonusSectionHeading
          kicker="Как это работает"
          title="Выгода после каждой покупки"
          description="Бонусы начисляются по вашему текущему уровню."
        />
        <BonusSteps steps={loyaltySteps} />
      </section>

      <section className="bonus-section bonus-container" id="loyalty-levels">
        <BonusSectionHeading
          row
          kicker="Четыре уровня"
          title="Больше покупок — выше кэшбэк"
          description="Уровень зависит от суммы всех ваших покупок. Прошлые заказы тоже учитываются."
        />
        <div className="loyalty-levels">
          {loyaltyLevels.map((level) => (
            <article className="loyalty-level" key={level.name}>
              <div className="loyalty-level__top">
                <span>{level.number}</span>
                <span className="loyalty-level__mark" aria-hidden="true">◆</span>
              </div>
              <h3>{level.name}</h3>
              <p>{level.threshold}</p>
              <strong className="loyalty-level__percent">{level.percent}<span>%</span></strong>
              <span className="loyalty-level__caption">кэшбэк бонусами</span>
              <div className="loyalty-level__reward">
                <strong>+{level.reward} бонусов</strong>
                <span>с заказа на 1 000 ₽</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bonus-section bonus-container">
        <BonusSectionHeading kicker="Копить или тратить" title="Выбор за вами при каждой оплате" />
        <div className="loyalty-spend-grid">
          <article className="loyalty-spend-card">
            <span className="bonus-card-label">Копить</span>
            <h3>+3–10% от суммы заказа</h3>
            <p>Оплатите полную стоимость без списания бонусов, и после выдачи заказа получите награду по своему уровню.</p>
            <div className="loyalty-spend-card__example">
              <span>Заказ на 1 000 ₽</span><strong>от +30 до +100 бонусов</strong>
            </div>
          </article>
          <article className="loyalty-spend-card">
            <span className="bonus-card-label">Тратить</span>
            <h3>До 50% заказа бонусами</h3>
            <p>Списывайте накопления для скидки. В заказе, где вы тратите бонусы, новые бонусы не начисляются.</p>
            <div className="loyalty-spend-card__example">
              <span>Заказ на 1 000 ₽</span><strong>до 500 ₽ бонусами</strong>
            </div>
          </article>
        </div>
        <div className="loyalty-notice">
          <strong>Важно знать</strong>
          <ul>
            <li>Бонусы действуют 60 дней с момента начисления.</li>
            <li>Сначала расходуются бонусы с самым ранним сроком начисления.</li>
            <li>Бонусы нельзя вывести на карту или передать другому пользователю.</li>
            <li>При списании бонусов новые бонусы за тот же заказ не начисляются.</li>
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
        kicker="Создаёшь контент?"
        title={<>Вступай в медиа-команду<br />Millex</>}
        text="Получай бесплатные ключи для видео, оплату за просмотры и скидку 25% на каталог."
        action={(
          <Link to="/partnership" className="bonus-button bonus-button--primary">
            Условия для авторов <span aria-hidden="true">→</span>
          </Link>
        )}
      />
    </div>
  );
}
