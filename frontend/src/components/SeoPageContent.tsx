import { sanitizeBlogHtml } from "../utils/blogHtml";
import { useSeoPage } from "../utils/seoSettings";
import "./SeoPageContent.css";

type SeoHeadingProps = {
  pageKey: string;
  fallback: string;
  className?: string;
};

export function SeoHeading({ pageKey, fallback, className }: SeoHeadingProps) {
  const page = useSeoPage(pageKey);
  return <h1 className={className}>{page?.h1?.trim() || fallback}</h1>;
}

type SeoTextBlockProps = {
  pageKey?: string;
  content?: string | null;
  collapsible?: boolean;
  summary?: string;
};

export function SeoTextBlock({
  pageKey,
  content,
  collapsible = false,
  summary = "Подробное описание",
}: SeoTextBlockProps) {
  const page = useSeoPage(pageKey ?? null);
  const html = content ?? page?.seo_text ?? "";
  const sanitizedHtml = sanitizeBlogHtml(html);

  if (!sanitizedHtml.trim()) return null;

  if (collapsible) {
    return (
      <details className="seo-text-disclosure">
        <summary>
          <span>{summary}</span>
          <span className="seo-text-disclosure-actions" aria-hidden="true">
            <span className="seo-text-disclosure-open">Развернуть</span>
            <span className="seo-text-disclosure-close">Свернуть</span>
          </span>
        </summary>
        <div
          className="seo-text-block seo-text-content"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </details>
    );
  }

  return (
    <section
      className="seo-text-block seo-text-content"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
