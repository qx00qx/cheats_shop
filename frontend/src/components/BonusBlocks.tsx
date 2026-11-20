import type { ReactNode } from "react";

type Stat = {
  value: string;
  label: string;
};

type Step = {
  number: string;
  title: string;
  text: string;
};

type HeroEvent = {
  number: string;
  title: string;
  text: string;
  reward: string;
};

export function BonusHero({
  kicker,
  title,
  lead,
  actions,
  visual,
  stats,
}: {
  kicker: string;
  title: ReactNode;
  lead: ReactNode;
  actions: ReactNode;
  visual: ReactNode;
  stats: Stat[];
}) {
  return (
    <section className="bonus-hero bonus-container">
      <div className="bonus-hero__content">
        <span className="bonus-kicker"><i /> {kicker}</span>
        <h1>{title}</h1>
        <p className="bonus-hero__lead">{lead}</p>
        <div className="bonus-hero__actions">{actions}</div>
      </div>
      {visual}
      <div className="bonus-hero__stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BonusHeroCard({
  label,
  status,
  rate,
  rateText,
  events,
  media = false,
  ariaLabel,
}: {
  label: string;
  status: string;
  rate: string;
  rateText: ReactNode;
  events: HeroEvent[];
  media?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="bonus-hero-card" aria-label={ariaLabel}>
      <div className="bonus-hero-card__top">
        <span>{label}</span>
        <span className="bonus-live"><i /> {status}</span>
      </div>
      <div className={`bonus-hero-card__rate${media ? " bonus-hero-card__rate--media" : ""}`}>
        <strong>{rate}</strong>
        <span>{rateText}</span>
      </div>
      <div className="bonus-hero-card__events">
        {events.map((event) => (
          <div key={event.number}>
            <span className="bonus-event-icon">{event.number}</span>
            <span>{event.title}<small>{event.text}</small></span>
            <b>{event.reward}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BonusSectionHeading({
  kicker,
  title,
  description,
  row = false,
}: {
  kicker: string;
  title: ReactNode;
  description?: string;
  row?: boolean;
}) {
  const heading = (
    <>
      <span className="bonus-kicker">{kicker}</span>
      <h2>{title}</h2>
    </>
  );

  return (
    <div className={`bonus-section-heading${row ? " bonus-section-heading--row" : ""}`}>
      {row ? <div>{heading}</div> : heading}
      {description && <p>{description}</p>}
    </div>
  );
}

export function BonusSteps({ steps }: { steps: Step[] }) {
  return (
    <div className="bonus-steps">
      {steps.map((step) => (
        <article className="bonus-step" key={step.number}>
          <span className="bonus-step__number">{step.number}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </article>
      ))}
    </div>
  );
}

export function BonusProgramCard({
  label,
  title,
  text,
  highlight,
  items,
  link,
  accent = false,
}: {
  label: string;
  title: string;
  text: string;
  highlight: ReactNode;
  items: string[];
  link: ReactNode;
  accent?: boolean;
}) {
  return (
    <article className={`bonus-program-card${accent ? " bonus-program-card--accent" : ""}`}>
      <span className="bonus-card-label">{label}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="bonus-program-card__highlight">{highlight}</div>
      <ul className="bonus-check-list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      {link}
    </article>
  );
}

export function BonusInfoCards({ items }: { items: Step[] }) {
  return (
    <div className="bonus-info-grid">
      {items.map((item) => (
        <article className="bonus-info-card" key={item.number}>
          <span>{item.number}</span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  );
}

export function BonusBottomCta({
  kicker,
  title,
  text,
  action,
}: {
  kicker: string;
  title: ReactNode;
  text: string;
  action: ReactNode;
}) {
  return (
    <section className="bonus-container bonus-bottom-cta">
      <div>
        <span className="bonus-kicker">{kicker}</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {action}
    </section>
  );
}
