import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import heroImage from "../static/img/hero.png";
import { getGameImage } from "../utils/gameCatalog";
import { applyDiscount, getCheatDiscountPercent } from "../utils/cheatPromotion";
import Seo from "../components/Seo";

type Game = { 
  id: number; 
  slug: string; 
  title: string; 
  image?: string;
  product_count?: number;
  min_price?: number;
  promo_discount_percent?: number;
  promo_expires_at?: string;
};

export default function CatalogPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(15);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
  const loadGames = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/catalog/games");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: Game[] = await response.json();
      setGames(data);
    } catch (error) {
      console.error("Failed to load games:", error);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  loadGames();
}, []);

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

  const getGameType = (game: Game): string => {
    const nameLower = game.title?.toLowerCase() ?? "";

    // Мобильные игры
    const mobileGames = ['pubg mobile', 'mobile legends', 'free fire', 'cod mobile', 'call of duty mobile', 'standoff 2'];
    for (const mobileName of mobileGames) {
      if (nameLower.includes(mobileName)) {
        return 'mobile';
      }
    }
    
    // Спуферы
    if (nameLower.includes('spoofer') || nameLower.includes('спуфер') || nameLower.includes('hwid')) {
      return 'spoofer';
    }
    
    return 'pc';
  };

  const filteredGames = games.filter(game => {
    const gameName = game.title?.toLowerCase() ?? "";
    const gameType = getGameType(game);

    const matchesSearch = gameName.includes((searchTerm || "").toLowerCase());
    const matchesCategory = activeCategory === 'all' || gameType === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const visibleGames = filteredGames.slice(0, visibleCount);
  const hasMore = filteredGames.length > visibleCount;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 15);
  };

  return (
    <div className="catalog-page">
      <Seo
        pageKey="catalog"
        title="Каталог читов для игр — описания и цены"
        description="Каталог читов MILLEX для популярных игр. Смотрите описание, функции, статусы и цены, выбирайте подходящий игровой софт."
        image={heroImage}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Каталог читов и игрового софта MILLEX",
          url: "https://millex.market/catalog",
          inLanguage: "ru-RU",
          mainEntity: {
            "@type": "ItemList",
            itemListElement: games.map((game, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: game.title,
              url: `https://millex.market/catalog/${encodeURIComponent(game.slug)}`,
            })),
          },
        }}
      />
      <div className="container">
        <div className="breadcrumbs">
          <span onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>Главная</span>
          <span>/</span>
          <span className="active">Каталог</span>
        </div>

        <div className="catalog-hero">
          <div className="catalog-hero-content">
            <span className="catalog-hero-badge">Ассортимент игр</span>
            <h1 className="catalog-hero-title">Каталог наших игр</h1>
            <p className="catalog-hero-subtitle">Начните пользоваться MILLEX прямо сейчас</p>
            <a href="#games-section" className="catalog-hero-button">Все игры</a>
          </div>
          <div className="catalog-hero-image">
            <img src={heroImage} alt="MILLEX Hero" />
          </div>
          <div className="catalog-hero-bg-text">Каталог</div>
          <div className="catalog-hero-overlay"></div>
        </div>

        <div className="search-section" id="games-section">
          <div className="search-wrapper">
            <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Поиск игр и предложений" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              ref={searchInputRef}
            />
          </div>

          <div className="category-buttons">
            <button 
              className={`category-btn ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              Все игры
            </button>
            <button 
              className={`category-btn ${activeCategory === 'mobile' ? 'active' : ''}`}
              onClick={() => setActiveCategory('mobile')}
            >
              Мобильные игры
            </button>
            <button 
              className={`category-btn ${activeCategory === 'spoofer' ? 'active' : ''}`}
              onClick={() => setActiveCategory('spoofer')}
            >
              Спуферы
            </button>
          </div>
        </div>

        <div className="accounts-cta">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '240px' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '0.75rem', background: 'rgba(0,255,140,0.14)', flexShrink: 0 }}>
              <svg width="22" height="22" fill="none" stroke="#00ff8c" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>Готовые аккаунты</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#00ff8c', background: 'rgba(0,255,140,0.14)', border: '1px solid rgba(0,255,140,0.3)', padding: '0.15rem 0.45rem', borderRadius: '0.4rem' }}>NEW</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', marginTop: '0.15rem' }}>Прокаченные аккаунты с моментальной выдачей</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            <a href="/accounts?game=battlefield-6" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.6rem 1.1rem', borderRadius: '0.75rem', background: '#111', border: '1px solid rgba(0,255,140,0.22)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none', transition: 'all 0.25s' }} onMouseOver={(e) => { e.currentTarget.style.background = '#00ff8c'; e.currentTarget.style.color = '#000'; }} onMouseOut={(e) => { e.currentTarget.style.background = '#111'; e.currentTarget.style.color = '#fff'; }}>BATTLEFIELD 6</a>
            <a href="/accounts?game=dayz" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.6rem 1.1rem', borderRadius: '0.75rem', background: '#111', border: '1px solid rgba(0,255,140,0.22)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none', transition: 'all 0.25s' }} onMouseOver={(e) => { e.currentTarget.style.background = '#00ff8c'; e.currentTarget.style.color = '#000'; }} onMouseOut={(e) => { e.currentTarget.style.background = '#111'; e.currentTarget.style.color = '#fff'; }}>DAYZ</a>
            <a href="/accounts?game=rust" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.6rem 1.1rem', borderRadius: '0.75rem', background: '#111', border: '1px solid rgba(0,255,140,0.22)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none', transition: 'all 0.25s' }} onMouseOver={(e) => { e.currentTarget.style.background = '#00ff8c'; e.currentTarget.style.color = '#000'; }} onMouseOut={(e) => { e.currentTarget.style.background = '#111'; e.currentTarget.style.color = '#fff'; }}>RUST</a>
            <a href="/accounts" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.6rem 1.1rem', borderRadius: '0.75rem', background: '#00ff8c', color: '#000', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none' }}>Все аккаунты →</a>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Загрузка...</div>
        ) : (
          <>
            <div className="games-grid" id="gamesGrid">
              {visibleGames.map((game) => {
                const fallbackImage = getGameImage(game.slug, game.title);
                const gameImage = game.image || fallbackImage;
                return (
                  <Link 
                    key={game.id} 
                    to={`/catalog/${game.slug}`} 
                    className="game-card" 
                    data-game-name={game.title}
                    data-game-type={getGameType(game)}
                  >
                  {gameImage && (
                    <img
                      src={gameImage}
                      alt={game.title}
                      className="game-card-image"
                      onError={(event) => {
                        if (!fallbackImage || event.currentTarget.dataset.fallbackApplied) return;
                        event.currentTarget.dataset.fallbackApplied = "true";
                        event.currentTarget.src = fallbackImage;
                      }}
                    />
                  )}
                  <div className="game-card-overlay"></div>
                  <div className="game-card-content">
                    <h3 className="game-card-title">{game.title}</h3>
                    <div className="game-card-info">
                      <div className="game-card-offers">
                        <span className="game-card-offers-count">{game.product_count || 0}</span>
                        <span className="game-card-offers-text">{cheatCountSuffix(game.product_count || 0)}</span>
                      </div>
                      {(game.min_price || 0) > 0 && (() => {
                        const discountPercent = getCheatDiscountPercent(
                          0,
                          game.promo_discount_percent,
                          game.promo_expires_at,
                        );
                        return (
                          <div className="game-card-price">
                            <span className="game-card-price-label">от</span>
                            {discountPercent > 0 && (
                              <del className="game-card-price-old">
                                {formatPrice(game.min_price || 0)}
                              </del>
                            )}
                            <span className="game-card-price-value">
                              {formatPrice(discountPercent
                                ? applyDiscount(game.min_price || 0, discountPercent)
                                : game.min_price || 0)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="game-card-action">
                      <div className="game-card-line"></div>
                      <span className="game-card-text">Перейти</span>
                    </div>
                  </div>
                  <div className="game-card-border"></div>
                  </Link>
                );
              })}
            </div>

            {visibleGames.length === 0 && (
              <div className="no-results">
                <div className="no-results-icon">
                  <svg width="32" height="32" fill="none" stroke="rgba(255,255,255,0.1)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                <p className="no-results-title">Игры не найдены</p>
                <p className="no-results-text">Попробуйте изменить запрос</p>
              </div>
            )}

            {hasMore && (
              <div className="load-more-wrapper">
                <button className="load-more-btn" onClick={handleLoadMore}>
                  <span>Смотреть больше</span>
                  <svg className="load-more-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
