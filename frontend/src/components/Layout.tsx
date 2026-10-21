import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { ToastContainer } from "./Toast";
import { Modal } from "./Modal";
import JivoChat from "./JivoChat";
import ContactPromoBanner from "./ContactPromoBanner";

export default function Layout() {
  const location = useLocation();
  const hideFooter = location.pathname === "/login" || location.pathname === "/register" || location.pathname.startsWith("/admin");
  const hideJivo = location.pathname === "/login" || location.pathname === "/register" || location.pathname === "/reset-password" || location.pathname.startsWith("/admin");

  return (
    <div className="app">
      {!hideJivo && <JivoChat />}
      <Header />
      <main>
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
      <ToastContainer />
      <Modal />
      <ContactPromoBanner />
    </div>
  );
}