export interface BlogCategory {
  id: number;
  alias: string;
  name: string;
}

export interface BlogArticleListItem {
  id: number;
  alias: string;
  name: string;
  excerpt: string;
  category_id: number;
  category_alias: string;
  category_name: string;
  cover_url?: string | null;
  created_at?: string;
  published_at?: string;
}

export interface BlogArticle extends BlogArticleListItem {
  content: string;
  updated_at?: string;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_h1?: string | null;
  seo_text?: string | null;
  seo_image?: string | null;
  seo_noindex?: boolean;
}