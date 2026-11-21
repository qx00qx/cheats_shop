import Seo from "../components/Seo";
import {
  BonusBottomCta,
  BonusHero,
  BonusHeroCard,
  BonusInfoCards,
  BonusProgramCard,
  BonusSectionHeading,
  BonusSteps,
} from "../components/BonusBlocks";

const mediaSteps = [
  {
    number: "01",
    title: "Напиши в @millex",
    text: "Отправь нам сообщение в Telegram и расскажи, что хочешь создавать контент вместе с Millex.",
  },
  {
    number: "02",
    title: "Покажи свои работы",
    text: "Укажи ссылку на канал или соцсети и добавь примеры работ. Мы свяжемся с каждым кандидатом.",
  },
  {
    number: "03",
    title: "Создавай и зарабатывай",
    text: "Получай ключи для записи видео, оплату за просмотры на YouTube и привилегии участника медиа-команды.",
  },
];

const mediaEvents = [
  { number: "01", title: "Ключи для записи видео", text: "Продукты Millex для твоего контента", reward: "0 ₽" },
  { number: "02", title: "Скидка на весь каталог", text: "Персональная выгода для участников", reward: "25%" },
  { number: "03", title: "Выделение в Telegram", text: "Кастомная роль в нашем чате", reward: "Роль" },
];

const applicationDetails = [
  {
    number: "01",
    title: "Личное сообщение",
    text: "Напиши нам в Telegram: @millex. Расскажи, почему хочешь вступить в медиа-команду Millex.",
  },
  {
    number: "02",
    title: "Канал или соцсети",
    text: "Добавь ссылку на свой YouTube-канал или другую площадку, где публикуешь контент.",
  },
  {
    number: "03",
    title: "Примеры работ",
    text: "Покажи несколько своих материалов. Мы посмотрим заявку и свяжемся с каждым кандидатом.",
  },
];

const priorityGames = [
  "Valorant",
  "Rust",
  "Escape from Tarkov",
  "Arena Breakout",
  "War Dogs",
  "Другие популярные проекты",
];

const applicationLink = (
  <a href="https://t.me/millex" target="_blank" rel="noreferrer" className="bonus-text-link">
    Подать заявку в @millex <span aria-hidden="true">↗</span>
  </a>
);

export default function PartnershipPage() {
  return (
    <div className="bonus-page partnership-page">
      <Seo
        pageKey="partnership"
        title="Партнёрство и медиа-команда"
        description="Вступай в медиа-команду Millex: бесплатные ключи для видео, оплата от 750 до 1 000 ₽ за 1 000 просмотров на YouTube и скидка 25%."
        canonicalPath="/partnership"
      />

      <BonusHero
        kicker="Millex media team"
        title={<>Медиа-команда<br /><span>Millex</span></>}
        lead="Создавай контент о любимых играх вместе с Millex. Мы даём продукты для записи видео, платим за просмотры и открываем особые привилегии для авторов."
        actions={(
          <>
            <a href="https://t.me/millex" target="_blank" rel="noreferrer" className="catalog-hero-button">
              Подать заявку <span aria-hidden="true">↗</span>
            </a>
            <a href="#media-team" className="bonus-button btn-ghost">Что мы предлагаем</a>
          </>
        )}
        visual={(
          <BonusHeroCard
            media
            label="Для авторов контента"
            status="Набор открыт"
            rate="750–1 000 ₽"
            rateText={<>за каждые 1 000 просмотров<br />на YouTube</>}
            events={mediaEvents}
            ariaLabel="Условия для медиа-команды Millex"
          />
        )}
        stats={[
          { value: "750–1 000 ₽", label: "за 1 000 просмотров на YouTube" },
          { value: "Ключи", label: "бесплатно для записи видео" },
          { value: "25%", label: "скидка на весь каталог Millex" },
        ]}
      />

      <section className="bonus-section bonus-container">
        <BonusSectionHeading
          kicker="Как вступить"
          title="Три шага в медиа-команду"
          description="Расскажи о своём канале и покажи, что уже умеешь."
        />
        <BonusSteps steps={mediaSteps} />
      </section>

      <section className="bonus-section bonus-container" id="media-team">
        <BonusSectionHeading
          kicker="Что мы предлагаем"
          title="Условия для авторов"
          description="Поддержка для твоего контента и выгода как для участника команды Millex."
        />
        <div className="bonus-program-grid">
          <BonusProgramCard
            accent
            label="Доход и продукты"
            title="Зарабатывай на своём контенте"
            text="Записывай видео о продуктах Millex и получай оплату за просмотры на YouTube."
            highlight={<><strong>750–1 000 ₽</strong><span>за каждые 1 000 просмотров<br />на YouTube</span></>}
            items={[
              "Бесплатные ключи на продукты для записи видео",
              "Оплата от 750 до 1 000 ₽ за каждую 1 000 просмотров на YouTube",
            ]}
            link={applicationLink}
          />
          <BonusProgramCard
            label="Привилегии команды"
            title="Больше выгоды с Millex"
            text="Участники медиа-команды получают постоянную скидку и особое выделение в сообществе."
            highlight={<><strong>25%</strong><span>скидка на весь каталог<br />Millex</span></>}
            items={[
              "Скидка 25% на весь каталог Millex",
              "Кастомная роль с выделением в нашем Telegram-чате",
            ]}
            link={(
              <a href="#application" className="bonus-text-link">
                Как подать заявку <span aria-hidden="true">↓</span>
              </a>
            )}
          />
        </div>

        <div className="media-games">
          <div>
            <span className="bonus-card-label">Приоритетный контент</span>
            <h3>Игры для твоих видео</h3>
            <p>Можно предложить и другой популярный проект — расскажи о своей идее в заявке.</p>
          </div>
          <div className="media-games__list">
            {priorityGames.map((game) => <span key={game}>{game}</span>)}
          </div>
        </div>
      </section>

      <section className="bonus-section bonus-container" id="application">
        <BonusSectionHeading kicker="Как подать заявку" title="Что отправить нам" />
        <BonusInfoCards items={applicationDetails} />
      </section>

      <BonusBottomCta
        kicker="Millex media"
        title={<>Создавай контент.<br />Зарабатывай на том, что любишь.</>}
        text="Отправь ссылку на канал и примеры работ — мы рассмотрим заявку и свяжемся с тобой."
        action={(
          <a href="https://t.me/millex" target="_blank" rel="noreferrer" className="catalog-hero-button">
            Написать @millex <span aria-hidden="true">↗</span>
          </a>
        )}
      />
    </div>
  );
}
