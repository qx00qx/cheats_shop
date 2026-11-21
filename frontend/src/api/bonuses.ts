import { api } from "./client";

export type BonusSummary = {
  total_spent: number;
  discount_percent: number;
  next_discount_percent: number;
  amount_to_next_discount: number;
  progress_percent: number;
  referral_discount_percent: number;
  referral_discount_available: boolean;
  referral_discount_used: boolean;
  is_referred: boolean;
};

export const BonusesAPI = {
  me: () => api.get<BonusSummary>("/bonuses/me").then((response) => response.data),
};
