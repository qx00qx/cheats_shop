import { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ACCOUNT_RETURN_LOCATION_KEY } from "./AccountReturnLocationTracker";

type AccountSection = "profile" | "balance" | "history" | "referrals";

type AccountLayoutProps = {
  activeSection: AccountSection;
  children: ReactNode;
};

const accountLinks: { to: string; label: string; section: AccountSection }[] = [
  { to: "/profile", label: "Профиль", section: "profile" },
  { to: "/profile/balance", label: "Пополнить баланс", section: "balance" },
  { to: "/profile/history", label: "История покупок", section: "history" },
  { to: "/profile/referrals", label: "Реферальная программа", section: "referrals" },
];

export default function AccountLayout({
  activeSection,
  children,
}: AccountLayoutProps) {
  const returnLocation =
    window.sessionStorage.getItem(ACCOUNT_RETURN_LOCATION_KEY) || "/catalog";

  return (
    <div className="lk-wrap">
      <div className="lk-layout">
        <aside className="lk-sidebar" aria-label="Разделы личного кабинета">
          <nav className="lk-sidebar-menu">
            {accountLinks.map((link) => (
              <NavLink
                key={link.section}
                to={link.to}
                end={link.section === "profile"}
                className={`lk-sidebar-item${activeSection === link.section ? " active" : ""}`}
                aria-current={activeSection === link.section ? "page" : undefined}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="lk-card">
          <Link to={returnLocation} className="lk-back-button">
            <span aria-hidden="true">←</span> Назад
          </Link>
          {children}
        </main>
      </div>
    </div>
  );
}
