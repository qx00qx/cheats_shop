import { api } from "./client";

export const PaymentsAPI = {
  rate: () => api.get<{ rate?: number; error?: string }>("/payments/rate").then((r) => r.data),
};