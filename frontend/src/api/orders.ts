import { api } from "./client";

export type OrderItem = {
  id: number;
  product_id: number;
  plan_id: number;
  qty: number;
  price: number;
};

export type Order = {
  id: number;
  source: "store" | "catalog";
  status: string;
  total: number;
  payment_method: string;
  platega_url?: string | null;
  key_value?: string | null;
  delivery_file_available?: boolean;
  created_at: string;
  items: OrderItem[];
  product?: string | null;
  period?: string | null;
};

export const OrdersAPI = {
  async getMyOrders(): Promise<Order[]> {
    const res = await api.get<Order[]>("/orders");
    return res.data;
  },

  async list(): Promise<Order[]> {
    return this.getMyOrders();
  },

  async create(payload: any): Promise<Order> {
    const res = await api.post<Order>("/orders", payload);
    return res.data;
  },
};