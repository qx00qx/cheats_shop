import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useModalStore } from "../hooks/useModal";
import PurchaseModalContent from "../components/PurchaseModalContent";
import Seo from "../components/Seo";

type Account = {
  id: number;
  title: string;
  price: number;
  stock: number;
  in_stock: boolean;
  type: string;
  game_key: string;
  game_name: string;
};

type Game = {
  key: string;
  label: string;
};

export default function AccountsPage() {
  const [searchParams] = useSearchParams();
  const { openModal } = useModalStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [gameFilter, setGameFilter] = useState(searchParams.get("game") || "");
  const [sortBy, setSortBy] = useState("default");

  useEffect(() => {
    let cancelled = false;
    const loadAccounts = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await api.get<Account[]>("/accounts");
        if (!cancelled) setAccounts(response.data);
      } catch (error) {
        if (!cancelled) {
          setLoadError("Не удалось загрузить аккаунты. Попробуйте обновить страницу.");
          console.error("Failed to load accounts:", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setGameFilter(searchParams.get("game") || "");
    setSearchTerm(searchParams.get("search") || "");
  }, [searchParams]);

  const availableGames = useMemo(() => {
    const games = new Map<string, Game>();
    for (const account of accounts) {
      if (account.game_key && account.game_name) {
        games.set(account.game_key, {
          key: account.game_key,
          label: account.game_name.toUpperCase(),
        });
      }
    }
    return [...games.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [accounts]);

  const formatPrice = (price: number): string => {
    return `${price.toLocaleString("ru-RU")} ₽`;
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.title?.toLowerCase().includes((searchTerm || "").toLowerCase()) ?? false;
    return matchesSearch && (!gameFilter || acc.game_key === gameFilter);
  });

  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    if (sortBy === "price_asc") return a.price - b.price;
    if (sortBy === "price_desc") return b.price - a.price;
    if (sortBy === "stock") return (b.in_stock ? 1 : 0) - (a.in_stock ? 1 : 0);
    return 0;
  });

  const handleBuy = (account: Account) => {
    openModal(
      <PurchaseModalContent
        item={{ name: account.title, alias: account.type }}
        tariff={{
          id: account.id,
          title: "Аккаунт",
          duration_days: null,
          price: account.price,
          old_price: null,
        }}
        accountId={account.id}
      />,
      "Покупка аккаунта"
    );
  };

  return (
    <main className="acc-catalog">
      <Seo
        title="Магазин игровых аккаунтов"
        description="Каталог игровых аккаунтов MILLEX: выбирайте игру, сравнивайте предложения и смотрите наличие и цены."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Магазин игровых аккаунтов MILLEX",
          url: "https://millex.market/accounts",
          inLanguage: "ru-RU",
        }}
      />
      <div className="acc-container">
        <div className="acc-hero">
          <h1 className="acc-title">Магазин аккаунтов</h1>
          <p className="acc-subtitle">Готовые NFA-аккаунты с моментальной автовыдачей после оплаты с баланса.</p>
        </div>
      </div>

      <div className="acc-container acc-layout">
        <aside className="acc-sidebar">
          <div className="acc-filter-block">
            <label className="acc-filter-label">Игра</label>
            <select 
              className="acc-select" 
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
            >
              <option value="">Все игры</option>
              {availableGames.map(game => (
                <option key={game.key} value={game.key}>{game.label}</option>
              ))}
            </select>
          </div>
          <div className="acc-filter-block">
            <label className="acc-filter-label">Сортировка</label>
            <select 
              className="acc-select" 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="default">По умолчанию</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
              <option value="stock">Сначала в наличии</option>
            </select>
          </div>
          <div className="acc-filter-block">
            <label className="acc-filter-label">Быстрый выбор</label>
            <div className="acc-chips">
              <a href="/accounts" className={`acc-chip ${gameFilter === "" ? "is-active" : ""}`}>Все</a>
              {availableGames.map(game => (
                <a 
                  key={game.key} 
                  href={`/accounts?game=${game.key}`} 
                  className={`acc-chip ${gameFilter === game.key ? "is-active" : ""}`}
                >
                  {game.label}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="acc-main">
          <div className="acc-search-wrap">
            <svg className="acc-search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input 
              type="text" 
              className="acc-search-input" 
              placeholder="Поиск по названию аккаунта…" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="acc-empty">
              <p>Загрузка...</p>
            </div>
          ) : loadError ? (
            <div className="acc-empty">
              <p>{loadError}</p>
              <button className="acc-btn acc-btn-buy" type="button" onClick={() => window.location.reload()}>
                Обновить
              </button>
            </div>
          ) : sortedAccounts.length === 0 ? (
            <div className="acc-empty">
              <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
              </svg>
              <p>Нет доступных товаров</p>
            </div>
          ) : (
            <div className="acc-grid">
              {sortedAccounts.map(account => (
                <div key={account.id} className="acc-card">
                  <div className="acc-card-head">
                    <span className="acc-card-icon">
                      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01"/>
                      </svg>
                    </span>
                    <span className="acc-nfa-tag">NFA</span>
                    {!account.in_stock && <span className="acc-badge acc-badge-out">Нет в наличии</span>}
                  </div>
                  <div className="acc-card-body">
                    <h3 className="acc-card-title">{account.title}</h3>
                    <div className="acc-card-meta">
                      {account.in_stock ? (
                        <span className="acc-stock acc-stock-in">
                           В наличии: {account.stock}
                        </span>
                      ) : (
                        <span className="acc-stock acc-stock-out">
                           Нет в наличии
                        </span>
                      )}
                    </div>
                    <div className="acc-card-footer">
                      <span className="acc-price">{formatPrice(account.price)}</span>
                      {account.in_stock ? (
                        <button
                          className="acc-btn acc-btn-buy"
                          type="button"
                          onClick={() => handleBuy(account)}
                        >
                          Купить
                        </button>
                      ) : (
                        <button className="acc-btn acc-btn-disabled" disabled>Недоступно</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="acc-content-section">
        <div className="acc-container">
          <section className="acc-info">
            <h2 className="acc-info-title">Об аккаунтах</h2>
            <div className="acc-info-content">
              <p><strong>NFA (No Full Access)</strong> — аккаунт с логином и паролем для входа в игру, но без доступа к смене пароля и привязке своей почты. Такие аккаунты дешевле и идеально подходят для теста читов и игры на втором профиле, чтобы не рисковать основным.</p>
              <p><strong>Как проходит покупка.</strong> Пополняете баланс, выбираете нужный аккаунт и покупаете в один клик — данные для входа выдаются <strong>автоматически и моментально</strong> прямо на сайте после списания с баланса. Никаких ожиданий и ручной выдачи.</p>
              <p><strong>Безопасность.</strong> Все аккаунты — актуальные и в наличии. Если данные не подошли или аккаунт не входит — напишите в поддержку, разберём каждый случай индивидуально.</p>
            </div>
          </section>

          <section className="acc-faq">
            <h2 className="acc-info-title">Частые вопросы</h2>
            <div className="acc-faq-list">
              <div className="acc-faq-item">
                <h4 className="acc-faq-q">Что такое NFA-аккаунт?</h4>
                <p className="acc-faq-a">NFA — аккаунт с ограниченными правами: есть вход в игру, но нельзя сменить пароль или привязать свою почту. Дешевле полного доступа и отлично подходит для теста читов и второго профиля.</p>
              </div>
              <div className="acc-faq-item">
                <h4 className="acc-faq-q">Как быстро приходят данные?</h4>
                <p className="acc-faq-a">Мгновенно. После оплаты с баланса данные для входа выдаются автоматически прямо на странице заказа — ждать письма не нужно.</p>
              </div>
              <div className="acc-faq-item">
                <h4 className="acc-faq-q">Как оплатить?</h4>
                <p className="acc-faq-a">Покупка идёт с внутреннего баланса. Пополните баланс удобным способом на странице пополнения, затем купите аккаунт в один клик.</p>
              </div>
              <div className="acc-faq-item">
                <h4 className="acc-faq-q">Что если аккаунт не подошёл?</h4>
                <p className="acc-faq-a">Напишите в поддержку с номером заказа. При подтверждённой проблеме выдадим замену или вернём средства на баланс.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
