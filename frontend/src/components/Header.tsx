import { Link, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import headerLogo from "../static/img/header__logo.svg";
import SupportModal from "./SupportModal";
import { useAuth } from "../store/auth";
import { api } from "../api/client";

type CheatSearchResult = {
  id: number;
  name: string;
  alias: string;
  price: number;
  game_title: string;
};

type AccountSearchResult = {
  id: number;
  title: string;
  type: string;
  price: number;
  game_name: string;
};

export default function Header() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [cheatResults, setCheatResults] = useState<CheatSearchResult[]>([]);
  const [accountResults, setAccountResults] = useState<AccountSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const langRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setSupportOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!searchOpen || query.length < 2) {
      setCheatResults([]);
      setAccountResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError("");
    const timeout = window.setTimeout(async () => {
      try {
        const [cheats, accounts] = await Promise.all([
          api.get<CheatSearchResult[]>("/catalog/search", { params: { q: query } }),
          api.get<AccountSearchResult[]>("/accounts", { params: { q: query } }),
        ]);
        if (!cancelled) {
          setCheatResults(cheats.data);
          setAccountResults(accounts.data.slice(0, 8));
        }
      } catch (error) {
        console.error("Failed to search catalog:", error);
        if (!cancelled) {
          setCheatResults([]);
          setAccountResults([]);
          setSearchError("Не удалось выполнить поиск. Попробуйте ещё раз.");
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchOpen, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    window.location.href = "/";
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="nx-header">
      <div className="nx-header__inner">
        <Link to="/" className="nx-logo">
          <img src={headerLogo} alt="Millex"></img>
          <span className="nx-logo__name">MILLEX<span>.MARKET</span></span>
        </Link>

        <nav className="nx-nav">
          <NavLink to="/catalog">Каталог</NavLink>
          <a href="#support" className="js-support-open" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); setSupportOpen(true); }}>Поддержка</a>
          <NavLink to="/blogs">Блог</NavLink>
          {/* <NavLink to="/accounts">Аккаунты</NavLink> */}
          <NavLink to="/status">Статусы</NavLink>
        </nav>

        <div className="nx-actions">
          <button
            type="button"
            className="nx-search-btn"
            title="Поиск"
            aria-label="Открыть поиск"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
          </button>

          {/* <div ref={langRef} className={`nx-lang ${langOpen ? 'open' : ''}`}>
            <button
              className="nx-lang-toggle"
              onClick={() => setLangOpen(!langOpen)}
              aria-expanded={langOpen}
            >
              <span>RU</span>
              <svg className="nx-lang-toggle__caret" width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            <div className="nx-lang-menu">
              <a href="#" className="is-active">
                <span className="nx-lang-menu__code">RU</span>
                <span>Русский</span>
                <span className="nx-lang-menu__currency">₽</span>
              </a>
              <a href="#">
                <span className="nx-lang-menu__code">EN</span>
                <span>English</span>
                <span className="nx-lang-menu__currency">$</span>
              </a>
            </div>
          </div> */}

          {user ? (
            <div className="nx-profile__menu">
              <Link to="/profile/balance" className="nx-profile__btn">
                {user.username}
              </Link>
              <button onClick={handleLogout} className="nx-profile__btn nx-profile__btn--logout">
                Выход
              </button>
            </div>
          ) : (
            <Link to="/login" className="nx-profile__btn nx-profile__btn--login">
              Вход
            </Link>
          )}

          <button
            className={`nx-burger${mobileMenuOpen ? " is-open" : ""}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={mobileMenuOpen}
            aria-controls="nx-mobile-menu"
            type="button"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
      </div>

      {searchOpen && (
        <section className="nx-search-panel" aria-label="Поиск по каталогу">
          <div className="nx-search-panel__input-wrap">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Найти чит или аккаунт"
              aria-label="Найти чит или аккаунт"
            />
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="Закрыть поиск">
              ×
            </button>
          </div>
          <div className="nx-search-panel__results" aria-live="polite">
            {searchTerm.trim().length < 2 ? (
              <p className="nx-search-panel__message">Введите минимум 2 символа</p>
            ) : searchLoading ? (
              <p className="nx-search-panel__message">Ищем в читах и аккаунтах…</p>
            ) : searchError ? (
              <p className="nx-search-panel__message nx-search-panel__message--error">{searchError}</p>
            ) : cheatResults.length === 0 && accountResults.length === 0 ? (
              <p className="nx-search-panel__message">Ничего не найдено</p>
            ) : (
              <>
                {cheatResults.length > 0 && (
                  <div className="nx-search-panel__group">
                    <h2>Читы</h2>
                    {cheatResults.map((cheat) => (
                      <Link
                        className="nx-search-panel__result"
                        key={`cheat-${cheat.id}`}
                        to={`/item/${encodeURIComponent(cheat.alias)}`}
                        onClick={() => setSearchOpen(false)}
                      >
                        <span>
                          <strong>{cheat.name}</strong>
                          {cheat.game_title && <small>{cheat.game_title}</small>}
                        </span>
                        <span className="nx-search-panel__price">{cheat.price.toLocaleString("ru-RU")} ₽</span>
                      </Link>
                    ))}
                  </div>
                )}
                {accountResults.length > 0 && (
                  <div className="nx-search-panel__group">
                    <h2>Аккаунты</h2>
                    {accountResults.map((account) => (
                      <Link
                        className="nx-search-panel__result"
                        key={`account-${account.id}`}
                        to={`/accounts?search=${encodeURIComponent(account.title)}`}
                        onClick={() => setSearchOpen(false)}
                      >
                        <span>
                          <strong>{account.title}</strong>
                          {account.game_name && <small>{account.game_name}</small>}
                        </span>
                        <span className="nx-search-panel__price">{account.price.toLocaleString("ru-RU")} ₽</span>
                      </Link>
                    ))}
                    <Link
                      className="nx-search-panel__all"
                      to={`/accounts?search=${encodeURIComponent(searchTerm.trim())}`}
                      onClick={() => setSearchOpen(false)}
                    >
                      Все аккаунты по запросу
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      <nav id="nx-mobile-menu" className={`nx-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <NavLink to="/catalog" onClick={closeMobileMenu}>Каталог</NavLink>
        <a href="#support" className="js-support-open" onClick={(e) => { e.preventDefault(); setSupportOpen(true); }}>Поддержка</a>
        <NavLink to="/blogs" onClick={closeMobileMenu}>Блог</NavLink>
        <NavLink to="/accounts" onClick={closeMobileMenu}>Аккаунты</NavLink>
        <NavLink to="/status" onClick={closeMobileMenu}>Статусы</NavLink>
        <button
          type="button"
          className="nx-mobile-search"
          onClick={() => {
            setSearchOpen(true);
            closeMobileMenu();
          }}
        >
          Поиск по читам и аккаунтам
        </button>
        <div className="nx-mobile-divider"></div>
        <div className={`nx-lang nx-lang--mobile${langOpen ? " open" : ""}`}>
          <button className="nx-lang-toggle" onClick={() => setLangOpen(!langOpen)} aria-expanded={langOpen}>
            <span>RU</span>
            <svg className="nx-lang-toggle__caret" width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <div className="nx-lang-menu">
            <a href="#" className="is-active">
              <span className="nx-lang-menu__code">RU</span>
              <span>Русский</span>
              <span className="nx-lang-menu__currency">₽</span>
            </a>
            <a href="#">
              <span className="nx-lang-menu__code">EN</span>
              <span>English</span>
              <span className="nx-lang-menu__currency">$</span>
            </a>
          </div>
        </div>
        <div className="nx-mobile-divider"></div>
        {user ? (
          <div className="nx-mobile-account">
            <Link to="/profile/balance" onClick={closeMobileMenu} className="nx-mobile-account__profile">
              {user.username}
            </Link>
            <button onClick={handleLogout} className="nx-mobile-account__logout" type="button">
              Выход
            </button>
          </div>
        ) : (
          <Link to="/login" onClick={closeMobileMenu} className="nx-mobile-account__profile">Вход</Link>
        )}
      </nav>

      <SupportModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} />
    </header>
  );
}
