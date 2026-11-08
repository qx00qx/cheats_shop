import { useEffect, useState } from "react";
import { getHomeItems } from "../api/catalog";
import { getMockItemSales } from "../utils/itemSalesMock";

interface RecentPurchase {
  product: string;
  email: string;
  created_at: string;
}

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

export default function RecentPurchaseToast() {
  const [purchases, setPurchases] = useState<RecentPurchase[]>([]);
  const [purchaseIndex, setPurchaseIndex] = useState(0);

  useEffect(() => {
    getHomeItems()
      .then((items) => {
        const recentPurchases = items
          .flatMap((item) =>
            getMockItemSales(item.alias, 16).sales.map((sale) => ({
              product: item.name,
              email: sale.email,
              created_at: sale.created_at,
            })),
          )
          .sort(
            (first, second) =>
              new Date(second.created_at).getTime() -
              new Date(first.created_at).getTime(),
          );
        setPurchases(recentPurchases);
        setPurchaseIndex(0);
      })
      .catch((error: unknown) => {
        console.error("Failed to load recent purchase notification data:", error);
      });
  }, []);

  useEffect(() => {
    if (purchases.length < 2) return;

    const intervalId = window.setInterval(() => {
      setPurchaseIndex((index) => (index + 1) % purchases.length);
    }, 6500 + Math.random() * 3500);
    return () => window.clearInterval(intervalId);
  }, [purchases.length]);

  const purchase = purchases[purchaseIndex];
  if (!purchase) return null;

  return (
    <aside
      key={`${purchase.created_at}-${purchaseIndex}`}
      className="recent-purchase-toast"
      role="status"
      aria-live="polite"
    >
      <div className="recent-purchase-toast__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="m5 12 4 4L19 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="recent-purchase-toast__content">
        <span className="recent-purchase-toast__eyebrow">Недавняя покупка</span>
        <strong className="recent-purchase-toast__product">{purchase.product}</strong>
        <span className="recent-purchase-toast__details">
          {purchase.email}
          <span aria-hidden="true"> · </span>
          {formatPurchaseAge(purchase.created_at)}
        </span>
      </div>
    </aside>
  );
}
