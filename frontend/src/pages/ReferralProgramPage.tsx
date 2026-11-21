import { Link } from "react-router-dom";
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

const referralSteps = [
  {
    number: "01",
    title: "Получите свою ссылку",
    text: "В личном кабинете закреплена персональная реферальная ссылка. Поделитесь ею с друзьями или своей аудиторией.",
  },
  {
    number: "02",
    title: "Друг регистрируется",
    text: "После регистрации по ссылке новый пользователь закрепляется за вами. Его успешные заказы будут учитываться в программе.",
  },
  {
    number: "03",
    title: "Получайте вознаграждение",
    text: "С каждой успешной покупки приглашённого пользователя вам начисляется 5% на баланс аккаунта.",
  },
];

const referralEvents = [
  { number: "01", title: "Друг перешёл по ссылке", text: "Регистрация завершена", reward: "Готово" },
  { number: "02", title: "Заказ успешно оплачен", text: "Покупка друга засчитана", reward: "+5%" },
  { number: "03", title: "Награда на балансе", text: "Используйте её для новых покупок", reward: "↗" },
];

const referralDetails = [
  {
    number: "01",
    title: "Привязка по ссылке",
    text: "Пользователь закрепляется за вами при регистрации по персональной ссылке. Начислить себе комиссию с собственных покупок нельзя.",
  },
  {
    number: "02",
    title: "Один заказ — одна награда",
    text: "Комиссия начисляется один раз за каждую успешную покупку. Повторное начисление за тот же заказ исключено.",
  },
  {
    number: "03",
    title: "Возврат заказа",
    text: "Если покупка отменяется и оплата возвращается, реферальная комиссия за этот заказ списывается с баланса.",
  },
];

const cabinetLink = (label: string) => (
  <Link to="/profile/referrals" className="bonus-text-link">
    {label} <span aria-hidden="true">→</span>
  </Link>
);

export default function ReferralProgramPage() {
  return (
    <div className="bonus-page referral-program-page">
      <Seo
        pageKey="referrals"
        title="Реферальная программа"
        description="Приглашайте друзей в Millex по своей ссылке и получайте 5% с каждой их успешной покупки на баланс аккаунта."
        canonicalPath="/referrals"
      />

      <BonusHero
        kicker="Millex referrals"
        title={<>Реферальная<br /><span>программа</span></>}
        lead="Делитесь Millex с друзьями: вы получаете 5% с каждой их успешной покупки, а друг получает скидку 5% на свой первый заказ."
        actions={(
          <>
            <Link to="/profile/referrals" className="catalog-hero-button">
              Получить ссылку <span aria-hidden="true">↗</span>
            </Link>
            <a href="#how-referrals-work" className="bonus-button btn-ghost">Как это работает</a>
          </>
        )}
        visual={(
          <BonusHeroCard
            label="Вознаграждение"
            status="Программа активна"
            rate="5%"
            rateText={<>вам с каждой покупки друга<br />и другу на первый заказ</>}
            events={referralEvents}
            ariaLabel="Пример работы реферальной программы"
          />
        )}
        stats={[
          { value: "5% вам", label: "с каждой покупки друга" },
          { value: "5% другу", label: "скидка на первую покупку" },
          { value: "На баланс", label: "начисление в личном кабинете" },
        ]}
      />

      <section className="bonus-section bonus-container" id="how-referrals-work">
        <BonusSectionHeading
          kicker="Как это работает"
          title="Три шага до первой награды"
          description="Персональная ссылка и вся статистика уже доступны в личном кабинете."
        />
        <BonusSteps steps={referralSteps} />
      </section>

      <section className="bonus-section bonus-container">
        <BonusSectionHeading
          kicker="Ваша выгода"
          title="Приглашайте и зарабатывайте"
          description="Никаких сложных условий: друг покупает, вы получаете вознаграждение."
        />
        <div className="bonus-program-grid">
          <BonusProgramCard
            accent
            label="Вознаграждение"
            title="5% с каждой покупки"
            text="Получайте вознаграждение за успешные заказы всех пользователей, которые зарегистрировались по вашей ссылке."
            highlight={<><strong>5%</strong><span>от суммы успешного заказа<br />на ваш баланс</span></>}
            items={[
              "Комиссия начисляется с каждой успешной покупки",
              "Друг получает скидку 5% на первую покупку",
              "Награда поступает на баланс аккаунта",
            ]}
            link={cabinetLink("Перейти к своей ссылке")}
          />
          <BonusProgramCard
            label="Статистика"
            title="Результаты всегда под рукой"
            text="В личном кабинете видно, кого вы пригласили и какой доход принесли их покупки."
            highlight={<><strong>Кабинет</strong><span>приглашения, заказы<br />и начисления</span></>}
            items={[
              "Количество приглашённых пользователей",
              "Число учтённых покупок и общий доход",
              "Отдельная статистика по каждому другу",
            ]}
            link={cabinetLink("Открыть статистику")}
          />
        </div>
      </section>

      <section className="bonus-section bonus-container">
        <BonusSectionHeading kicker="Важные детали" title="Прозрачные условия" />
        <BonusInfoCards items={referralDetails} />
      </section>

      <BonusBottomCta
        kicker="Ваша ссылка уже готова"
        title={<>Пригласите друга.<br />Получите первую награду.</>}
        text="Скопируйте персональную ссылку в личном кабинете и поделитесь ею."
        action={(
          <Link to="/profile/referrals" className="catalog-hero-button">
            Открыть кабинет <span aria-hidden="true">→</span>
          </Link>
        )}
      />
    </div>
  );
}
