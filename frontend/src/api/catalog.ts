import { api } from "./client";

export type Game = {
  id: number;
  slug: string;
  title: string;
  cover_url?: string;
  image?: string;
  product_count?: number;
  min_price?: number;
};
export type Category = { id: number; slug: string; title: string };

export const CatalogAPI = {
  games: () => api.get<Game[]>("/catalog/games").then((r) => r.data),
  categories: () => api.get<Category[]>("/catalog/categories").then((r) => r.data),
};