import { api } from "./client";
import type { CheatPromotion } from "../utils/cheatPromotion";

const CATALOG_REQUEST_CACHE_MS = 30_000;

type CachedRequest<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

function getCachedJson<T>(
  cache: { current?: CachedRequest<T> },
  path: string,
): Promise<T> {
  const cached = cache.current;
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const request: CachedRequest<T> = {
    expiresAt: Number.POSITIVE_INFINITY,
    promise: fetch(path).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<T>;
    }),
  };
  cache.current = request;

  request.promise = request.promise
    .then((data) => {
      request.expiresAt = Date.now() + CATALOG_REQUEST_CACHE_MS;
      return data;
    })
    .catch((error: unknown) => {
      if (cache.current === request) cache.current = undefined;
      throw error;
    });

  return request.promise;
}

export type FeaturedCheat = {
  id: number;
  name: string;
  alias: string;
  game_title: string | null;
  image: string | null;
  price: number | null;
  top: number;
  hit: number;
  undetected: number;
  security_status?: number | string;
  promo_discount_percent?: number;
  promo_expires_at?: string;
  feature_categories: { title: string }[];
};

const homeItemsCache: { current?: CachedRequest<FeaturedCheat[]> } = {};
const promotionCache: { current?: CachedRequest<CheatPromotion> } = {};

export const getHomeItems = () =>
  getCachedJson<FeaturedCheat[]>(homeItemsCache, "/api/catalog/home-items");

export const getCheatPromotion = () =>
  getCachedJson<CheatPromotion>(promotionCache, "/api/catalog/promotion");

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