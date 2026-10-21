import type { BlogArticle, BlogArticleListItem, BlogCategory } from "../types/blog";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "/api";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function getBlogArticles() {
  return request<BlogArticleListItem[]>("/blog");
}

export function getBlogCategories() {
  return request<BlogCategory[]>("/blog/categories");
}

export function getBlogArticleBySlug(slug: string) {
  return request<BlogArticle>(`/blog/${encodeURIComponent(slug)}`);
}