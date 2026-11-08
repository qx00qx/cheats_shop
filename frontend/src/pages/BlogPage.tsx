import { useEffect, useMemo, useState } from "react";
import BlogCard from "../components/blog/BlogCard";
import Seo from "../components/Seo";
import { getBlogArticles, getBlogCategories } from "../api/blog";
import type { BlogArticleListItem, BlogCategory } from "../types/blog";

export default function BlogPage() {
  const [articles, setArticles] = useState<BlogArticleListItem[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [articlesData, categoriesData] = await Promise.all([
          getBlogArticles(),
          getBlogCategories().catch(() => []),
        ]);

        if (cancelled) return;

        setArticles(articlesData);
        setCategories(categoriesData);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Ошибка загрузки блога");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const allCategories = useMemo(() => {
    if (categories.length > 0) {
      return [{ id: 0, alias: "all", name: "Все" }, ...categories];
    }

    const unique = new Map<string, BlogCategory>();
    for (const article of articles) {
      if (!unique.has(article.category_alias)) {
        unique.set(article.category_alias, {
          id: article.category_id,
          alias: article.category_alias,
          name: article.category_name,
        });
      }
    }

    return [{ id: 0, alias: "all", name: "Все" }, ...Array.from(unique.values())];
  }, [articles, categories]);

  const filteredArticles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return articles.filter((article) => {
      const matchesCategory =
        activeCategory === "all" || article.category_alias === activeCategory;

      const matchesSearch =
        !query ||
        article.name.toLowerCase().includes(query) ||
        article.excerpt.toLowerCase().includes(query) ||
        article.category_name.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [articles, activeCategory, search]);

  return (
    <div className="blog-page-shell">
      <Seo
        pageKey="blog"
        title="Блог об игровом софте и играх"
        description="Новости, инструкции и материалы об игровом софте, функциях и популярных играх от MILLEX."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Блог MILLEX",
          url: "https://millex.market/blog",
          inLanguage: "ru-RU",
          blogPost: articles.map((article) => ({
            "@type": "BlogPosting",
            headline: article.name,
            url: `https://millex.market/blog/${encodeURIComponent(article.alias)}`,
            datePublished: article.published_at ?? article.created_at,
          })),
        }}
      />
      <style>{`
        .blog-page-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(0, 255, 163, 0.07), transparent 24%),
            linear-gradient(180deg, rgba(6, 9, 8, 0.96), rgba(5, 7, 6, 1));
          color: var(--text-primary, #e7e7e7);
          padding: 32px 0 80px;
        }

        .blog-shell {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .blog-hero {
          position: relative;
          display: grid;
          grid-template-columns: 1.3fr 0.7fr;
          gap: 24px;
          padding: 30px 32px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(15, 20, 18, 0.92), rgba(10, 13, 11, 0.82));
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35);
          overflow: hidden;
        }

        .blog-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(0, 255, 163, 0.07), transparent 45%, rgba(0, 255, 163, 0.03));
          pointer-events: none;
        }

        .blog-hero__content {
          position: relative;
          z-index: 1;
        }

        .blog-hero__badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent-green, #00ffa3);
          opacity: 0.9;
          margin-bottom: 22px;
        }

        .blog-hero__badge::before {
          content: "";
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent-green, #00ffa3);
          box-shadow: 0 0 18px rgba(0, 255, 163, 0.65);
        }

        .blog-hero__title {
          margin: 0;
          font-size: clamp(2.5rem, 5vw, 5rem);
          line-height: 0.95;
          letter-spacing: -0.06em;
          font-weight: 800;
          color: #f3f5f4;
        }

        .blog-hero__text {
          margin-top: 18px;
          max-width: 760px;
          color: rgba(226, 232, 229, 0.74);
          font-size: 1.05rem;
          line-height: 1.7;
        }

        .blog-hero__stats {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 26px;
        }

        .blog-hero__stat {
          min-width: 120px;
          padding: 14px 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(7, 10, 9, 0.45);
        }

        .blog-hero__stat strong {
          display: block;
          font-size: 1.7rem;
          line-height: 1;
          color: var(--accent-green, #00ffa3);
          margin-bottom: 6px;
          font-weight: 700;
        }

        .blog-hero__stat span {
          font-size: 0.8rem;
          color: rgba(224, 232, 229, 0.72);
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .blog-hero__side {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: end;
          justify-content: center;
        }

        .blog-hero__panel {
          width: 100%;
          min-height: 170px;
          border: 1px solid rgba(0, 255, 163, 0.16);
          border-radius: 18px;
          background: rgba(7, 10, 9, 0.72);
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .blog-hero__panel-label {
          color: rgba(220, 229, 225, 0.6);
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .blog-hero__panel-value {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 700;
          color: #f3f5f4;
          line-height: 1;
        }

        .blog-hero__panel-note {
          color: rgba(219, 228, 224, 0.7);
          font-size: 0.82rem;
          line-height: 1.6;
        }

        .blog-toolbar {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .blog-toolbar__search {
          display: flex;
        }

        .blog-toolbar__search input {
          width: 100%;
          height: 58px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(7, 10, 9, 0.75);
          color: var(--text-primary, #e7e7e7);
          font-size: 1.02rem;
          padding: 0 18px;
          outline: none;
          box-shadow: inset 0 0 0 1px rgba(0, 255, 163, 0.02);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .blog-toolbar__search input:focus {
          border-color: rgba(0, 255, 163, 0.5);
          box-shadow: 0 0 0 3px rgba(0, 255, 163, 0.08);
        }

        .blog-toolbar__search input::placeholder {
          color: rgba(214, 221, 218, 0.5);
        }

        .blog-toolbar__filters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .blog-filter-btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(10, 13, 11, 0.72);
          color: rgba(234, 238, 236, 0.8);
          border-radius: 999px;
          padding: 10px 16px;
          font-size: 0.84rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .blog-filter-btn:hover {
          border-color: rgba(0, 255, 163, 0.26);
          color: #f0f5f1;
        }

        .blog-filter-btn.active {
          background: linear-gradient(135deg, rgba(0, 255, 163, 0.12), rgba(0, 255, 163, 0.04));
          border-color: rgba(0, 255, 163, 0.42);
          color: var(--accent-green, #00ffa3);
          box-shadow: 0 0 22px rgba(0, 255, 163, 0.08);
        }

        .blog-grid {
          margin-top: 24px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .blog-empty {
          grid-column: 1 / -1;
          padding: 42px 24px;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          background: rgba(10, 13, 11, 0.72);
        }

        .blog-empty h3 {
          margin: 0 0 8px;
          color: #f3f5f4;
          font-size: 1.65rem;
        }

        .blog-empty p {
          margin: 0;
          color: rgba(223, 232, 229, 0.74);
        }

        @media (max-width: 980px) {
          .blog-hero {
            grid-template-columns: 1fr;
          }

          .blog-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .blog-page-shell {
            padding-top: 18px;
          }

          .blog-shell {
            padding: 0 12px;
          }

          .blog-hero {
            padding: 22px 20px;
          }

          .blog-grid {
            grid-template-columns: 1fr;
          }

          .blog-hero__stats {
            gap: 12px;
          }

          .blog-hero__stat {
            flex: 1 1 calc(50% - 12px);
          }
        }
      `}</style>

      <div className="blog-shell">
        <section className="blog-hero">
          <div className="blog-hero__content">
            <span className="blog-hero__badge">MILLEX.MARKET</span>

            <h1 className="newhome-hero-title">Блог и инструкции</h1>

          </div>

          <div className="blog-hero__side">
            <div className="blog-hero__panel">
              <div className="blog-hero__panel-value">{filteredArticles.length}</div>
              <div className="blog-hero__panel-note">
                Статей в текущем результате поиска и фильтрации
              </div>
            </div>
          </div>
        </section>

        <section className="blog-toolbar">
          <div className="blog-toolbar__search">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по статьям..."
            />
          </div>

          <div className="blog-toolbar__filters">
            {allCategories.map((category) => (
              <button
                key={category.alias}
                type="button"
                className={`blog-filter-btn ${
                  activeCategory === category.alias ? "active" : ""
                }`}
                onClick={() => setActiveCategory(category.alias)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </section>

        <section className="blog-grid">
          {loading && (
            <div className="blog-empty">
              <h3>Загрузка...</h3>
            </div>
          )}

          {!loading && error && (
            <div className="blog-empty">
              <h3>Ошибка загрузки</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && filteredArticles.length > 0 && (
            filteredArticles.map((article) => (
              <BlogCard key={article.id} article={article} />
            ))
          )}

          {!loading && !error && filteredArticles.length === 0 && (
            <div className="blog-empty">
              <h3>Ничего не найдено</h3>
              <p>Попробуй изменить поиск или выбрать другую категорию.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}