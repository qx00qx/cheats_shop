import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_SEO_SETTINGS,
  getCachedSeoSettings,
  getCachedSeoPage,
  loadSeoPage,
  loadSeoSettings,
  type SeoPageSettings,
  type SeoSettings,
} from "../utils/seoSettings";

const SITE_URL = "https://millex.market";

type SeoProps = {
  title: string;
  pageKey?: string;
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
  pageKey,
  description,
  canonicalPath,
  image,
  noIndex = false,
  type = "website",
  structuredData,
}: SeoProps) {
  const location = useLocation();
  const [settings, setSettings] = useState<SeoSettings>(getCachedSeoSettings);
  const [pageSettings, setPageSettings] = useState<SeoPageSettings | null>(
    () => pageKey ? getCachedSeoPage(pageKey) : null,
  );
  const structuredDataJson = structuredData
    ? JSON.stringify(structuredData)
    : "";

  useEffect(() => {
    let active = true;
    loadSeoSettings()
      .then((loadedSettings) => {
        if (active) setSettings(loadedSettings);
      })
      .catch((error: unknown) => {
        console.error("Failed to load public SEO settings:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setPageSettings(pageKey ? getCachedSeoPage(pageKey) : null);
    if (!pageKey) return;

    loadSeoPage(pageKey)
      .then((loadedPage) => {
        if (active) setPageSettings(loadedPage);
      })
      .catch((error: unknown) => {
        console.error(`Failed to load SEO settings for page "${pageKey}":`, error);
      });
    return () => {
      active = false;
    };
  }, [pageKey]);

  useEffect(() => {
    const isHomePage = location.pathname === "/";
    const pageTitleText = pageSettings?.title
      || (isHomePage && settings.home_title ? settings.home_title : title);
    const pageDescription = (
      pageSettings?.description
      || (isHomePage && settings.home_description
        ? settings.home_description
        : description?.trim())
    ) || settings.default_description || DEFAULT_SEO_SETTINGS.default_description;
    const pageImage = pageSettings?.image || image || settings.default_image;
    const siteName = settings.site_name || DEFAULT_SEO_SETTINGS.site_name;
    const pageTitle = `${pageTitleText} | ${siteName}`;
    const canonicalUrl = new URL(
      canonicalPath ?? location.pathname,
      SITE_URL,
    ).toString();
    let imageUrl: string | null = null;
    if (pageImage) {
      try {
        const parsedImageUrl = new URL(pageImage, SITE_URL);
        if (parsedImageUrl.protocol === "https:" || parsedImageUrl.protocol === "http:") {
          imageUrl = parsedImageUrl.toString();
        } else {
          console.warn("Ignoring unsupported SEO image URL:", pageImage);
        }
      } catch (error) {
        console.warn("Ignoring invalid SEO image URL:", pageImage, error);
      }
    }

    document.title = pageTitle;
    setMeta("name", "description", pageDescription);
    setMeta(
      "name",
      "robots",
      noIndex || Boolean(pageSettings?.noindex)
        ? "noindex,follow"
        : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
    );
    setMeta("property", "og:site_name", siteName);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:title", pageTitle);
    setMeta("property", "og:description", pageDescription);
    setMeta("property", "og:locale", "ru_RU");
    setMeta("name", "twitter:card", imageUrl ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", pageTitle);
    setMeta("name", "twitter:description", pageDescription);

    if (imageUrl) {
      setMeta("property", "og:image", imageUrl);
      setMeta("property", "og:image:alt", pageTitleText);
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
    pageSettings,
    settings,
    structuredDataJson,
    title,
    type,
  ]);

  return null;
}
