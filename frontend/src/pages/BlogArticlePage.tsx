import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBlogArticleBySlug } from "../api/blog";
import Seo from "../components/Seo";
import type { BlogArticle } from "../types/blog";
import { sanitizeBlogHtml } from "../utils/blogHtml";


function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await getBlogArticleBySlug(slug!);
        if (cancelled) return;

        setArticle(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Ошибка загрузки статьи");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="blog-page-shell">
        <Seo title="Загрузка статьи" noIndex />
        <style>{`
          .blog-page-shell { min-height: 100vh; background: #060908; color: #e7e7e7; padding: 32px 0 80px; }
          .blog-shell { max-width: 960px; margin: 0 auto; padding: 0 20px; }
          .blog-article-empty { padding: 32px; border: 1px solid rgba(255,255,255,0.08); background: rgba(10,13,11,0.8); border-radius: 18px; text-align: center; }
          .blog-article-empty h3 { margin: 0 0 8px; color: #f3f5f4; }
          .blog-article-empty p { margin: 0; color: rgba(223,232,229,0.7); }
        `}</style>
        <div className="blog-shell">
          <section className="blog-article-empty">
            <h3>Загрузка...</h3>
            <p>Подгружаем статью.</p>
          </section>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="blog-page-shell">
        <Seo title="Статья не найдена" noIndex />
        <style>{`
          .blog-page-shell { min-height: 100vh; background: #060908; color: #e7e7e7; padding: 32px 0 80px; }
          .blog-shell { max-width: 960px; margin: 0 auto; padding: 0 20px; }
          .blog-article-empty { padding: 32px; border: 1px solid rgba(255,255,255,0.08); background: rgba(10,13,11,0.8); border-radius: 18px; text-align: center; }
          .blog-article-empty h3 { margin: 0 0 8px; color: #f3f5f4; }
          .blog-article-empty p { margin: 0 0 16px; color: rgba(223,232,229,0.7); }
          .blog-card__button { display: inline-flex; align-items: center; justify-content: center; min-height: 38px; padding: 0 16px; border-radius: 999px; border: 1px solid rgba(0,255,163,0.35); background: rgba(0,255,163,0.06); color: #00ffa3; text-decoration: none; }
        `}</style>
        <div className="blog-shell">
          <section className="blog-article-empty">
            <h3>Статья не найдена</h3>
            <p>{error ?? "Материал отсутствует в базе данных."}</p>
            <Link to="/blogs" className="blog-card__button">
              Вернуться к блогу
            </Link>
          </section>
        </div>
      </div>
    );
  }

  const date = formatDate(article.published_at ?? article.created_at);

  return (
    <div className="blog-page-shell">
      <Seo
        title={article.seo_title || article.name}
        description={article.seo_description || article.excerpt || `Материал из блога MILLEX: ${article.name}.`}
        canonicalPath={`/blog/${encodeURIComponent(article.alias)}`}
        image={article.cover_url}
        type="article"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.name,
          description: article.seo_description || article.excerpt,
          url: `https://millex.market/blog/${encodeURIComponent(article.alias)}`,
          datePublished: article.published_at ?? article.created_at,
          dateModified: article.updated_at ?? article.published_at ?? article.created_at,
          articleSection: article.category_name || undefined,
          inLanguage: "ru-RU",
          author: { "@type": "Organization", name: "MILLEX" },
          publisher: { "@type": "Organization", name: "MILLEX" },
        }}
      />
      <style>{`
        .blog-page-shell { min-height: 100vh; background: radial-gradient(circle at top left, rgba(0,255,163,0.06), transparent 22%), #060908; color: #e7e7e7; padding: 32px 0 80px; }
        .blog-shell { max-width: 960px; margin: 0 auto; padding: 0 20px; }
        .blog-article { padding: 26px 28px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(180deg, rgba(15,20,18,0.94), rgba(10,13,11,0.8)); border-radius: 20px; box-shadow: 0 18px 38px rgba(0,0,0,0.26); }
        .blog-article__header { margin-bottom: 24px; }
        .blog-article__back { display: inline-flex; align-items: center; margin-bottom: 18px; color: #00ffa3; text-decoration: none; font-weight: 600; }
        .blog-article__meta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 18px; }
        .blog-article__meta .blog-card__category, .blog-article__meta .blog-card__date { font-size: 0.72rem; }
        .blog-article__title { margin: 0 0 10px; font-size: clamp(2.2rem, 4vw, 4rem); line-height: 1; letter-spacing: -0.06em; color: #f5f7f4; }
        .blog-article__excerpt { margin: 0; color: rgba(226,232,229,0.72); line-height: 1.7; font-size: 1.02rem; }
        .blog-article__content { color: rgba(235,241,239,0.88); line-height: 1.9; font-size: 1rem; }
        .blog-article__content > * { margin-bottom: 1.2em; }
        .blog-article__content h2, .blog-article__content h3 { color: #f5f7f4; margin-top: 1.5em; margin-bottom: 0.8em; letter-spacing: -0.04em; }
        .blog-article__content p { margin: 0 0 1em; }
        .blog-article__content blockquote,
        .blog-article__content blockquote + p { color: #fff; }
        .blog-article__content ul, .blog-article__content ol { padding-left: 1.25rem; }
        .blog-article__content a { color: #00ffa3; }
        .blog-article__content blockquote { border-left: 3px solid rgba(0,255,163,0.5); padding-left: 1rem; color: rgba(226,232,229,0.8); }
        @media (max-width: 640px) { .blog-article { padding: 18px 18px 22px; } .blog-article__title { font-size: 2.2rem; } }
      `}</style>

      <div className="blog-shell">
        <section className="blog-article">
          <div className="blog-article__header">
            <Link to="/blogs" className="blog-article__back">
              ← К блогу
            </Link>

            <div className="blog-article__meta">
              <span className="blog-card__category">{article.category_name}</span>
              <span className="blog-card__date">{date}</span>
            </div>

            <h1 className="blog-article__title">{article.name}</h1>

            <p className="blog-article__excerpt">{article.excerpt}</p>
          </div>

          <div
            className="blog-article__content"
            dangerouslySetInnerHTML={{
              __html: sanitizeBlogHtml(article.content || ""),
            }}
          />
        </section>
      </div>
    </div>
  );
}