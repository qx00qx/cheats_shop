import { api } from "./client";

export type ProductCreate = {
  slug: string;
  title: string;
  game_id: number;
  category_id: number | null;
  subtitle: string | null;
  description: string | null;
  features: string[] | null;
  requirements: Record<string, any> | null;
  rating: number;
  reviews_count: number;
  is_active: boolean;
};

export const AdminAPI = {
  createProduct: (data: ProductCreate) =>
    api.post("/products", data).then((r) => r.data),
};
