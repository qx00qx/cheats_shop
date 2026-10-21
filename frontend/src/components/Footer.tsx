import { Link } from "react-router-dom";
import { useState } from "react";
import SupportModal from "./SupportModal";
import headerLogo from "../static/img/header__logo.svg";

export default function Footer() {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <footer className="footer">
        <div className="container">
          <div className="footer__global">
            <div className="footer__brand">
              <img src={headerLogo} alt="Millex"></img>
              <p>Мы рады приветствовать вас в нашем магазине, где вы найдете уникальные и приватные читы, которые помогут вам улучшить свои результаты в игре и достигнуть новых высот!</p>
            </div>
            <div className="footer__links">
              <h3>Навигация</h3>
              <ul>
                <li><Link to="/catalog">Каталог</Link></li>
                <li><a href="#support" onClick={(e) => { e.preventDefault(); setSupportOpen(true); }}>Поддержка</a></li>
                <li><Link to="/blogs">Блог</Link></li>
                <li><Link to="/accounts">Аккаунты</Link></li>
                <li><Link to="/status">Статусы</Link></li>
              </ul>
            </div>
            <div className="footer__links">
              <h3>Другое</h3>
              <ul>
                <li><a href="https://t.me/Millex" target="_blank" rel="noopener noreferrer">Telegram</a></li>
                <li><a href="https://discord.gg/millex" target="_blank" rel="noopener noreferrer">Discord</a></li>
              </ul>
            </div>
            <div className="footer__links">
              <h3>Политика</h3>
              <ul>
                <li><Link to="/privacy">Политика конфиденциальности</Link></li>
                <li><Link to="/user-agreement">Пользовательское соглашение</Link></li>
              </ul>
            </div>
          </div>
          <hr />
          <div className="footer__copy">
            <span>millex.market © 2022-2026. Все права защищены</span>
            <span>
              <ul>
                <li><a href="https://t.me/Millex" target="_blank" rel="noopener noreferrer">Telegram</a></li>
                <li><a href="https://discord.gg/millex" target="_blank" rel="noopener noreferrer">Discord</a></li>
              </ul>
            </span>
          </div>
        </div>
      </footer>
      <SupportModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
