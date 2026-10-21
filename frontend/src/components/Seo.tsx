import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://millex.market";
const SITE_NAME = "MILLEX";
const DEFAULT_DESCRIPTION =
  "Каталог игрового софта MILLEX: читы и инструменты для популярных игр. Изучите описание, возможности и доступные предложения.";

type SeoProps = {
  title: string;
  description?: string;
  canonicalPath?: string;
  image?: string | null;
  noIndex?: boolean;
  type?: "website" | "article" | "product";
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
};

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.content = content;
}

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  image,
  noIndex = false,
  type = "website",
  structuredData,
}: SeoProps) {
  const location = useLocation();
  const structuredDataJson = structuredData
    ? JSON.stringify(structuredData)
    : "";

  useEffect(() => {
    const pageTitle = `${title} | ${SITE_NAME}`;
    const canonicalUrl = new URL(
      canonicalPath ?? location.pathname,
      SITE_URL,
    ).toString();
    let imageUrl: string | null = null;
    if (image) {
      try {
        const parsedImageUrl = new URL(image, SITE_URL);
        if (parsedImageUrl.protocol === "https:" || parsedImageUrl.protocol === "http:") {
          imageUrl = parsedImageUrl.toString();
        } else {
          console.warn("Ignoring unsupported SEO image URL:", image);
        }
      } catch (error) {
        console.warn("Ignoring invalid SEO image URL:", error);
      }
    }

    document.title = pageTitle;
    setMeta("name", "description", description);
    setMeta(
      "name",
      "robots",
      noIndex
        ? "noindex,follow"
        : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
    );
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:title", pageTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:locale", "ru_RU");
    setMeta("name", "twitter:card", imageUrl ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", pageTitle);
    setMeta("name", "twitter:description", description);

    if (imageUrl) {
      setMeta("property", "og:image", imageUrl);
      setMeta("property", "og:image:alt", title);
      setMeta("name", "twitter:image", imageUrl);
    } else {
      document.head
        .querySelector('meta[property="og:image"]')
        ?.remove();
      document.head
        .querySelector('meta[property="og:image:alt"]')
        ?.remove();
      document.head.querySelector('meta[name="twitter:image"]')?.remove();
    }

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    document.head
      .querySelectorAll('script[data-seo-jsonld="true"]')
      .forEach((script) => script.remove());

    if (structuredDataJson) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seoJsonld = "true";
      script.textContent = structuredDataJson.replace(/</g, "\\u003c");
      document.head.appendChild(script);
    }
  }, [
    canonicalPath,
    description,
    image,
    location.pathname,
    noIndex,
    structuredDataJson,
    title,
    type,
  ]);

  return null;
}
