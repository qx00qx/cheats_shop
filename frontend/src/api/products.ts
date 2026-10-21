import { api } from "./client";
import type { Game } from "./catalog";

export type Plan = {
  id: number;
  label: string;
  duration_days: number | null;
  price: number;
  old_price: number | null;
  discount_badge: string | null;
};

export type ProductShort = {
  id: number;
  slug: string;
  title: string;
  subtitle?: string | null;
  rating: number;
  reviews_count: number;
  price?: number;
  image?: string;
  description?: string;
};

export type ProductFull = ProductShort & {
  description?: string | null;
  features?: string[] | null;
  requirements?: Record<string, string> | null;
  game: Game;
  plans: Plan[];
  image?: string;
  screenshots?: string[];
};

export type Review = {
  id: number;
  user_id: number;
  rating: number;
  text: string | null;
  created_at: string;
};

export const ProductsAPI = {
  list: (params: { game?: string; search?: string } = {}) =>
    api.get<ProductShort[]>("/catalog/games", { params }).then((r) => r.data),

  get: (slug: string) =>
    api.get<ProductFull>(`/catalog/games/${slug}`).then((r) => r.data),

  // отзывы временно выключаем
  reviews: (_slug: string) => Promise.resolve([] as Review[]),
  addReview: (_slug: string, _rating: number, _text?: string) =>
    Promise.reject(new Error("Reviews API disabled for MVP")),
};