export function getCheatDiscountPercent(
  loyaltyDiscountPercent: number | null | undefined,
  promoDiscountPercent: number | null | undefined,
  promoExpiresAt?: string | null,
): number {
  const promoIsActive = Boolean(
    promoDiscountPercent &&
    promoExpiresAt &&
    Date.now() < new Date(promoExpiresAt).getTime()
  );
  const loyaltyDiscount = Math.min(10, Math.max(0, loyaltyDiscountPercent ?? 0));
  return Math.max(loyaltyDiscount, promoIsActive ? promoDiscountPercent ?? 0 : 0);
}

export function applyDiscount(price: number, discountPercent: number): number {
  return Math.round(price * (100 - discountPercent)) / 100;
}

export type CheatPromotion = {
  active: boolean;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
};
