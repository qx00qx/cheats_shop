import { api } from "./client";

export type ReferralSummary = {
  code: string;
  link: string;
  commission_percent: number;
  invited_count: number;
  purchases_count: number;
  earned_total: number;
  invited_by: string | null;
  invitees: {
    username: string;
    created_at: string | null;
    purchases_count: number;
    earned_total: number;
  }[];
};

export const ReferralsAPI = {
  me: () => api.get<ReferralSummary>("/referrals/me").then((response) => response.data),
};
