import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import heroImg from "../static/img/hero.png";
import FaqSection from "../components/faqsection/FaqSection";
import Seo from "../components/Seo";
import { applyDiscount, getCheatDiscountPercent, type CheatPromotion } from "../utils/cheatPromotion";
import { getMockItemSales } from "../utils/itemSalesMock";

interface GameCard {
  href: string;
  title: string;
  image: string;
  count: number;
  minPrice: number;
}

interface FeaturedCheat {
  id: number;
  name: string;
  alias: string;
  game_title: string | null;
  image: string | null;
  price: number | null;
  top: number;
  hit: number;
  undetected: number;
  security_status?: number | string;
  promo_discount_percent?: number;
  promo_expires_at?: string;
  feature_categories: { title: string }[];
}

interface RecentPurchase {
  alias: string;
  product: string;
  email: string;
  created_at: string;
}

function createMockRecentPurchases(cheats: FeaturedCheat[]): RecentPurchase[] {
  if (cheats.length === 0) return [];

  const purchasesByCheat = cheats.map((cheat) => ({
    cheat,
    purchases: getMockItemSales(cheat.alias, 16).sales,
    nextPurchaseIndex: 0,
  }));
  const purchases: RecentPurchase[] = [];
  let cheatIndex = 0;

  while (purchases.length < 16) {
    const source = purchasesByCheat[cheatIndex % purchasesByCheat.length];
    const remaining = 16 - purchases.length;
    const groupSize = remaining === 4
      ? 2
      : Math.min(2 + (cheatIndex % 2), remaining);

    for (let index = 0; index < groupSize; index += 1) {
      const purchase = source.purchases[source.nextPurchaseIndex];
      if (!purchase) break;

      purchases.push({
        alias: source.cheat.alias,
        product: source.cheat.name,
        email: purchase.email,
        created_at: purchase.created_at,
      });
      source.nextPurchaseIndex += 1;
    }

    cheatIndex += 1;
  }

  return purchases.sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  );
}

function getCheatStatus(cheat: FeaturedCheat): 1 | 2 | 3 {
  const status = Number(cheat.security_status);
  if (status === 1 || status === 2 || status === 3) return status;
  return cheat.undetected === 1 ? 1 : 2;
}

const cheatStatusLabels: Record<1 | 2 | 3, { text: string; title: string }> = {
  1: { text: "Undetected", title: "Undetected" },
  2: { text: "On Updated", title: "On Updated" },
  3: { text: "Risk", title: "Risk" },
};

function formatPurchaseAge(createdAt: string): string {
  const elapsedHours = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / (60 * 60 * 1000)),
  );
  if (elapsedHours < 1) return "меньше часа назад";

  if (elapsedHours >= 24) {
    const days = Math.floor(elapsedHours / 24);
    const lastTwoDigits = days % 100;
    const lastDigit = days % 10;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${days} дней назад`;
    if (lastDigit === 1) return `${days} день назад`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${days} дня назад`;
    return `${days} дней назад`;
  }

  const lastTwoDigits = elapsedHours % 100;
  const lastDigit = elapsedHours % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${elapsedHours} часов назад`;
  }
  if (lastDigit === 1) return `${elapsedHours} час назад`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${elapsedHours} часа назад`;
  return `${elapsedHours} часов назад`;
}

export default function HomePage() {
  const [featuredCheats, setFeaturedCheats] = useState<FeaturedCheat[]>([]);
  const [promotion, setPromotion] = useState<CheatPromotion | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [recentPurchasesPage, setRecentPurchasesPage] = useState(0);
  const recentPurchasesPerPage = 4;
  const recentPurchasesPageCount = Math.ceil(recentPurchases.length / recentPurchasesPerPage);

  const changeRecentPurchasesPage = (direction: -1 | 1) => {
    setRecentPurchasesPage((page) =>
      (page + direction + recentPurchasesPageCount) % recentPurchasesPageCount,
    );
  };

  useEffect(() => {
    fetch("/api/catalog/home-items")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<FeaturedCheat[]>;
      })
      .then(setFeaturedCheats)
      .catch((error) => {
        console.error("Failed to load homepage featured cheats:", error);
      });

    fetch("/api/catalog/promotion")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<CheatPromotion>;
      })
      .then((result) => {
        setPromotion(result);
      })
      .catch((error) => {
        console.error("Failed to load homepage promotion:", error);
      });

  }, []);

  useEffect(() => {
    setRecentPurchases(createMockRecentPurchases(featuredCheats));
    setRecentPurchasesPage(0);
  }, [featuredCheats]);

  const promotionDiscountPercent = promotion?.active &&
    Date.now() < new Date(promotion.ends_at).getTime()
    ? promotion.discount_percent
    : 0;

  const popularGames: GameCard[] = [
    {
      href: "/catalog/cs2",
      title: "CS2",
      image: "/static/img/games/cs2.jpg",
      count: 15,
      minPrice: 500,
    },
    {
      href: "/catalog/rust",
      title: "RUST",
      image: "/static/img/games/rust.jpg",
      count: 12,
      minPrice: 800,
    },
    {
      href: "/catalog/gta5",
      title: "GTA 5 RP",
      image: "/static/img/games/gta5rp.jpg",
      count: 8,
      minPrice: 1200,
    },
    {
      href: "/catalog/fortnite",
      title: "Fortnite",
      image: "/static/img/games/fortnite.jpg",
      count: 20,
      minPrice: 300,
    },
    {
      href: "/catalog/apex",
      title: "Apex Legends",
      image: "/static/img/games/apex.jpg",
      count: 10,
      minPrice: 600,
    },
    {
      href: "/catalog/valorant",
      title: "Valorant",
      image: "/static/img/games/valorant.jpg",
      count: 18,
      minPrice: 450,
    },
  ];

  const cheatCountSuffix = (count: number): string => {
    const lastTwo = count % 100;
    const lastOne = count % 10;
    
    if (lastTwo >= 11 && lastTwo <= 19) return "предложений";
    if (lastOne === 1) return "предложение";
    if (lastOne >= 2 && lastOne <= 4) return "предложения";
    return "предложений";
  };

  const formatPrice = (price: number): string => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  return (
    <div className="newhome-root">
      <Seo
        title="Читы для игр и игровой софт"
        description="Каталог игрового софта MILLEX: читы и инструменты для популярных игр. Изучите описание, возможности и доступные предложения."
        image={heroImg}
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "MILLEX",
            url: "https://millex.market/",
            logo: "https://millex.market/favicon.png",
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "MILLEX",
            url: "https://millex.market/",
            inLanguage: "ru-RU",
          },
        ]}
      />
      <div className="background-fx">
        <div className="orb-primary"></div>
        <div className="orb-secondary"></div>
      </div>

      <main className="container">
        {/* Hero Section */}
        <section className="newhome-hero">
          <div className="newhome-hero-content">
            <div className="newhome-hero-badge">
              <i></i>
              <span>Market</span>
            </div>
            <h1 className="newhome-hero-title">
              ВАШИ ПОБЕДЫ НАЧИНАЮТСЯ ЗДЕСЬ
            </h1>
            <p className="newhome-hero-text">
              Маркетплейс уникальных читов для улучшения ваших результатов в играх.
              Безопасные, проверенные и эффективные решения от лучших разработчиков.
            </p>
          </div>

          <div className="newhome-hero-visual">
            <img src={heroImg} alt="MILLEX" />
          </div>
          
          <div className="newhome-hero-character-secondary"></div>
          
        </section>

        {/* CTA Section */}
        <section className="newhome-cta">
          <div className="newhome-cta-panel">
            <div className="newhome-cta-glow"></div>
            
            <div className="newhome-cta-stats">
              <div className="newhome-cta-stat">
                <div className="newhome-cta-stat-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div className="newhome-cta-stat-body">
                  <strong>40 000+</strong>
                  <span>пользователей</span>
                </div>
              </div>
              
              <div className="newhome-cta-stat">
                <div className="newhome-cta-stat-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M2 12h20"/>
                  </svg>
                </div>
                <div className="newhome-cta-stat-body">
                  <strong>450 000+</strong>
                  <span>товаров продано</span>
                </div>
              </div>
              
              <div className="newhome-cta-stat">
                <div className="newhome-cta-stat-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div className="newhome-cta-stat-body">
                  <strong>100%</strong>
                  <span>гарантия возврата</span>
                </div>
              </div>
            </div>

            <div className="newhome-cta-main">
              <div className="newhome-cta-body">
                <div className="newhome-cta-copy">
                  <div className="newhome-cta-head">
                    <div className="newhome-cta-eyebrow">
                      <span className="newhome-cta-badge">HOT</span>
                      <span>Персональная скидка до 10%</span>
                    </div>
                    <h2 className="newhome-cta-title">
                      Скидка растет с каждым заказом
                    </h2>
                    <p className="newhome-cta-text">
                      Регистрируйтесь и получайте персональную скидку. Каждый оплаченный заказ
                      увеличивает её на 1%, максимум — 10%.
                    </p>
                  </div>
                  <ul className="newhome-cta-benefits">
                    <li>Кумулятивная система</li>
                    <li>Без ограничений по времени</li>
                    <li>Автоматическое начисление</li>
                  </ul>
                  <div className="newhome-cta-actions">
                    <Link to="/register" className="newhome-cta-btn">
                      Получить скидку
                    </Link>
                  </div>
                </div>

                <div className="newhome-cta-visual">
                  <div className="newhome-cta-phone-orbit"></div>
                  <div className="newhome-cta-phone-wrap">
                    <div className="newhome-cta-phone">
                      <div className="newhome-cta-phone-notch"></div>
                      <div className="newhome-cta-phone-screen">
                        <div className="newhome-cta-phone-top">
                          <div className="newhome-cta-phone-logo">
                            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#00ff94' }}>M</span>
                          </div>
                          <span className="newhome-cta-phone-balance">Баланс: 0 ₽</span>
                        </div>
                        <div className="newhome-cta-phone-card">
                          <span className="newhome-cta-phone-card-label">Ваша скидка</span>
                          <div className="newhome-cta-phone-card-metric">
                            <strong>7%</strong>
                          </div>
                          <div className="newhome-cta-phone-bar" style={{ '--bar-w': '70%' } as React.CSSProperties}>
                            <span></span>
                          </div>
                          <p className="newhome-cta-phone-hint">До 10% осталось 3 заказа</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Grid Section */}
        <section className="newhome-grid">
          <a
            href="https://t.me/millexnews"
            target="_blank"
            rel="noopener noreferrer"
            className="newhome-grid-item newhome-grid-item--large"
          >
            <div className="newhome-grid-item__overlay"></div>
            <div className="newhome-grid-item__content">
              <p className="newhome-grid-item__title">Присоединяйтесь к нашему каналу</p>
              <p className="newhome-grid-item__subtitle">Следите за новостями, акциями и обновлениями в Telegram</p>
            </div>
            <div className="newhome-grid-item__link">
              <span>t.me/millexnews</span>
            </div>
          </a>

          <div className="newhome-grid-item newhome-grid-item--small-group">
            <Link to="/catalog" className="newhome-grid-item__catalog">
              <div className="newhome-grid-item__catalog-header">
                <span className="newhome-grid-item__catalog-count">150+ предложений</span>
                <div className="newhome-grid-item__catalog-line"></div>
              </div>
              <div className="newhome-grid-item__catalog-footer">
                <span className="newhome-grid-item__catalog-title">В каталог</span>
                <div className="newhome-grid-item__catalog-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
              </div>
            </Link>

            <div className="newhome-grid-item__social">
              <a href="https://t.me/millexchat" target="_blank" rel="noopener noreferrer" className="newhome-grid-item__social-btn">
                <svg width="20" height="20" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <path fill="currentColor" d="M88.723,12.142C76.419,17.238,23.661,39.091,9.084,45.047c-9.776,3.815-4.053,7.392-4.053,7.392 s8.345,2.861,15.499,5.007c7.153,2.146,10.968-0.238,10.968-0.238l33.62-22.652c11.922-8.107,9.061-1.431,6.199,1.431 c-6.199,6.2-16.452,15.975-25.036,23.844c-3.815,3.338-1.908,6.199-0.238,7.63c6.199,5.246,23.129,15.976,24.082,16.691 c5.037,3.566,14.945,8.699,16.452-2.146c0,0,5.961-37.435,5.961-37.435c1.908-12.637,3.815-24.321,4.053-27.659 C97.307,8.804,88.723,12.142,88.723,12.142z"></path>
                </svg>
              </a>
              <button className="newhome-grid-item__social-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53S48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53S91.08,65.69,84.69,65.69Z"/>
                </svg>
              </button>
            </div>
          </div>
        </section>

    
        {/* Popular Games */}
        <section className="newhome-section">
          <div className="newhome-section__header">
            <h2 className="newhome-section__title">Популярные игры</h2>
          </div>

          <div className="newhome-popular-wrap">
            <div className="newhome-popular-games">
              {popularGames.map((game) => (
                <Link key={game.href} to={game.href} className="game-card">
                  <img
                    src={game.image}
                    alt={game.title}
                    className="game-card-image"
                    loading="lazy"
                  />
                  <div className="game-card-overlay"></div>
                  <div className="game-card-content">
                    <h3 className="game-card-title">{game.title}</h3>
                    <div className="game-card-info">
                      <div className="game-card-offers">
                        <span className="game-card-offers-count">{game.count}</span>
                        <span className="game-card-offers-text">{cheatCountSuffix(game.count)}</span>
                      </div>
                      {game.minPrice > 0 && (
                        <div className="game-card-price">
                          <span className="game-card-price-label">от</span>
                          {promotionDiscountPercent > 0 && (
                            <del className="game-card-price-old">{formatPrice(game.minPrice)} ₽</del>
                          )}
                          <span className="game-card-price-value">
                            {formatPrice(promotionDiscountPercent
                              ? applyDiscount(game.minPrice, promotionDiscountPercent)
                              : game.minPrice)} ₽
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="game-card-action">
                      <div className="game-card-line"></div>
                      <span className="game-card-text">Перейти</span>
                    </div>
                  </div>
                  <div className="game-card-border"></div>
                </Link>
              ))}
            </div>
            <div className="newhome-popular-fade" aria-hidden="true"></div>
          </div>

          <div className="newhome-section__footer">
            <Link to="/catalog" className="newhome-view-more">
              <span>Смотреть больше</span>
              <svg className="newhome-view-more__arrow" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Link>
          </div>
        </section>

        {recentPurchases.length > 0 && (
          <section className="newhome-section recent-purchases-section" aria-labelledby="recent-purchases-title">
            <div className="newhome-section__header">
              <h2 className="newhome-section__title" id="recent-purchases-title">
                Последние покупки
              </h2>
              {recentPurchases.length > recentPurchasesPerPage && (
                <div className="recent-purchases-controls" aria-label="Переключение покупок">
                  <span className="recent-purchases-controls__count" aria-live="polite">
                    {recentPurchasesPage + 1} / {recentPurchasesPageCount}
                  </span>
                  <button
                    type="button"
                    aria-label="Предыдущие покупки"
                    onClick={() => changeRecentPurchasesPage(-1)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Следующие покупки"
                    onClick={() => changeRecentPurchasesPage(1)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="recent-purchases-grid recent-purchases-grid--page" key={recentPurchasesPage}>
              {recentPurchases
                .slice(
                  recentPurchasesPage * recentPurchasesPerPage,
                  (recentPurchasesPage + 1) * recentPurchasesPerPage,
                )
                .map((purchase, index) => (
                <Link
                  key={`${purchase.alias}-${purchase.created_at}-${index}`}
                  className="recent-purchase-card"
                  to={`/item/${encodeURIComponent(purchase.alias)}`}
                >
                  <strong className="recent-purchase-card__product">{purchase.product}</strong>
                  <span className="recent-purchase-card__email">{purchase.email}</span>
                  <span className="recent-purchase-card__age">
                    {formatPurchaseAge(purchase.created_at)}
                  </span>
                </Link>
                ))}
            </div>
          </section>
        )}

        {/* Best Cheats */}
        <section className="newhome-section">
          <div className="newhome-section__header">
            <h2 className="newhome-section__title">Лучшие читы</h2>
          </div>
          <div className="newhome-cheats">
            {featuredCheats.map((cheat) => (
              <div key={cheat.id} className="content__cheats-item">
                <Link to={`/item/${cheat.alias}`}>
                  <div className="content__cheats-image-wrapper">
                    <img src={cheat.image || heroImg} alt={cheat.name} />
                  </div>
                  <div className="content__cheats-badges">
                    <span
                      className={`content__cheats-badge content__cheats-badge--status-${getCheatStatus(cheat)}`}
                      title={cheatStatusLabels[getCheatStatus(cheat)].title}
                      aria-label={cheatStatusLabels[getCheatStatus(cheat)].title}
                    >
                      {cheatStatusLabels[getCheatStatus(cheat)].text}
                    </span>
                    {cheat.hit === 1 && (
                      <span className="content__cheats-badge">Хит продаж</span>
                    )}
                    {cheat.top === 1 && (
                      <span className="content__cheats-badge">Популярный</span>
                    )}
                  </div>
                  <div className="content__cheats-features">
                    {cheat.feature_categories.slice(0, 3).map((category) => (
                      <span key={category.title} className="feature-tag">
                        {category.title}
                      </span>
                    ))}
                  </div>
                  <div className="content__cheats-footer">
                    <span className="content__cheats-name">
                      {cheat.name}
                      {cheat.game_title && <small>{cheat.game_title}</small>}
                    </span>
                    {cheat.price != null && cheat.price > 0 && (() => {
                      const discountPercent = getCheatDiscountPercent(
                        0,
                        cheat.promo_discount_percent,
                        cheat.promo_expires_at,
                      );
                      const currentPrice = discountPercent
                        ? applyDiscount(cheat.price, discountPercent)
                        : cheat.price;
                      return (
                        <div className="content__cheats-price">
                          <span className="content__cheats-price-label">От</span>
                          <strong>{formatPrice(currentPrice)} ₽</strong>
                          {discountPercent > 0 && (
                            <>
                              <small className="content__cheats-price-discount">
                                -{discountPercent}%
                              </small>
                              <del>{formatPrice(cheat.price)} ₽</del>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </Link>
              </div>
            ))}
            {featuredCheats.length === 0 && (
              <p className="muted">Пока нет читов, отмеченных для главной страницы.</p>
            )}
          </div>

          <div className="newhome-section__footer">
            <Link to="/catalog" className="newhome-view-more">
              <span>Смотреть все</span>
              <svg className="newhome-view-more__arrow" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Link>
          </div>
        </section>

        <FaqSection />
      </main>
    </div>
  );
}
