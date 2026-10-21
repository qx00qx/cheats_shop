import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import Seo from "./Seo";
import { useAuth } from "../store/auth";

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/" replace />;

  return (
    <>
      <Seo title="Личный кабинет" noIndex />
      {children}
    </>
  );
}