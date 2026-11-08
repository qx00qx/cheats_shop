import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const ACCOUNT_RETURN_LOCATION_KEY = "millex_account_return_location";

const nonReturnablePaths = [
  /^\/(?:profile|orders)(?:\/|$)/,
  /^\/(?:login|register|forgot-password|reset-password|2fa)(?:\/|$)/,
  /^\/asdnrwe(?:\/|$)/,
];

export default function AccountReturnLocationTracker() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (nonReturnablePaths.some((pattern) => pattern.test(pathname))) return;

    window.sessionStorage.setItem(
      ACCOUNT_RETURN_LOCATION_KEY,
      `${pathname}${search}${hash}`,
    );
  }, [pathname, search, hash]);

  return null;
}
