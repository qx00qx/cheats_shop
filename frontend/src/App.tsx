import { useEffect } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import AccountsPage from "./pages/AccountsPage";
import StatusPage from "./pages/StatusPage";
import PrivacyPage from "./pages/PrivacyPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import BalancePage from "./pages/BalancePage";
import OrderHistoryPage from "./pages/OrderHistoryPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentFailPage from "./pages/PaymentFailPage";
import TwoFactorPage from "./pages/TwoFactorPage";
import BlogPage from "./pages/BlogPage";
import CookiePage from "./pages/CookiePage";
import NotFoundPage from "./pages/NotFoundPage";
import BlogArticlePage from "./pages/BlogArticlePage";

import { useAuth } from "./store/auth";
import AdminLayout from "./admin/AdminLayout";
import GamePage from "./pages/GamePage";
import ItemPage from "./pages/ItemPage";
import PurchaseDeliveryPage from "./pages/PurchaseDeliveryPage";
import { Modal } from "./components";
import YandexMetrikaTracker from "./components/YandexMetrikaTracker";
import PromotionModal from "./components/PromotionModal";
import DomainNoticeModal from "./components/DomainNoticeModal";
import ScrollToTop from "./components/ScrollToTop";
import RecentPurchaseToast from "./components/RecentPurchaseToast";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import UserAgreement from "./pages/UserAgreement";

function LegacyBlogArticleRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/blog/${encodeURIComponent(slug ?? "")}`} replace />;
}

export default function App() {
  const { loadMe } = useAuth();
  useEffect(() => {
    loadMe();
  }, [loadMe]);

  return (
    <>
      <YandexMetrikaTracker />
      <ScrollToTop />
      <Modal />
      <PromotionModal />
      <DomainNoticeModal />
      <RecentPurchaseToast />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          {/* <Route path="/catalog/:slug" element={<ProductPage />} /> */}
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/balance"
            element={
              <ProtectedRoute>
                <BalancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <OrderHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/history"
            element={
              <ProtectedRoute>
                <OrderHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/2fa"
            element={
              <ProtectedRoute>
                <TwoFactorPage />
              </ProtectedRoute>
            }
          />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/fail" element={<PaymentFailPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blogs" element={<Navigate to="/blog" replace />} />
          <Route path="/blog/:slug" element={<BlogArticlePage />} />
          <Route path="/blogs/:slug" element={<LegacyBlogArticleRedirect />} />
          <Route path="/cookie" element={<CookiePage />} />
          <Route path="/catalog/:slug" element={<GamePage />} />
          <Route path="/item/:alias" element={<ItemPage />} />
          <Route path="/purchase/delivery" element={<PurchaseDeliveryPage />} />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/user-agreement" element={<UserAgreement />} />
        </Route>
      </Routes>
    </>
  );
}