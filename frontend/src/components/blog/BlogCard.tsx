import { Link } from "react-router-dom";
import type { BlogArticleListItem } from "../../types/blog";

interface BlogCardProps {
  article: BlogArticleListItem;
}

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

export default function BlogCard({ article }: BlogCardProps) {
  const date = formatDate(article.published_at ?? article.created_at);

  return (
    <>
      <style>{`
        .blog-card {
          display: flex;
          flex-direction: column;
          min-height: 260px;
          padding: 20px 20px 18px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(10, 13, 11, 0.9), rgba(10, 13, 11, 0.7));
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .blog-card:hover {
          transform: translateY(-4px);
          border-color: rgba(0, 255, 163, 0.24);
          box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28), 0 0 20px rgba(0, 255, 163, 0.05);
        }

        .blog-card__top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 18px;
        }

        .blog-card__category {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--accent-green, #00ffa3);
        }

        .blog-card__category::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent-green, #00ffa3);
          box-shadow: 0 0 12px rgba(0, 255, 163, 0.7);
        }

        .blog-card__date {
          font-size: 0.74rem;
          color: rgba(224, 228, 226, 0.58);
        }

        .blog-card__title {
          margin: 0 0 12px;
          color: #f5f7f4;
          font-size: clamp(1.25rem, 1.8vw, 1.85rem);
          line-height: 1.2;
          letter-spacing: -0.04em;
        }

        .blog-card__excerpt {
          margin: 0;
          color: rgba(228, 234, 231, 0.78);
          line-height: 1.75;
          font-size: 0.96rem;
          flex: 1;
        }

        .blog-card__footer {
          margin-top: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .blog-card__meta {
          color: rgba(224, 232, 229, 0.54);
          font-size: 0.76rem;
          letter-spacing: 0.08em;
          text-transform: lowercase;
        }

        .blog-card__button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid rgba(0, 255, 163, 0.35);
          background: rgba(0, 255, 163, 0.06);
          color: var(--accent-green, #00ffa3);
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .blog-card__button:hover {
          background: rgba(0, 255, 163, 0.12);
          box-shadow: 0 0 18px rgba(0, 255, 163, 0.1);
          text-decoration: none;
        }
      `}</style>

      <article className="blog-card">
        <div className="blog-card__top">
          <span className="blog-card__category">{article.category_name}</span>
          <span className="blog-card__date">{date}</span>
        </div>

        <h3 className="blog-card__title">{article.name}</h3>

        <p className="blog-card__excerpt">{article.excerpt}</p>

        <div className="blog-card__footer">
          <span className="blog-card__meta">#{article.category_alias}</span>

          <Link to={`/blogs/${article.alias}`} className="blog-card__button">
            Читать
          </Link>
        </div>
      </article>
    </>
  );
}