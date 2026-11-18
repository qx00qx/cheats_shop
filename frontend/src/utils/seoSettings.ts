import { useEffect, useState } from "react";
import { api } from "../api/client";

export type SeoSettings = {
  site_name: string;
  home_title: string;
  home_description: string;
  default_description: string;
  default_image: string;
};

export type SeoPageSettings = {
  key: string;
  path: string;
  label: string;
  title: string;
  description: string;
  h1: string;
  seo_text: string;
  image: string;
  noindex: boolean;
};

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  site_name: "MILLEX",
  home_title: "",
  home_description: "",
  default_description:
    "Каталог игрового софта MILLEX: читы и инструменты для популярных игр. Изучите описание, возможности и доступные предложения.",
  default_image: "",
};

let cachedSettings: SeoSettings | null = null;
let settingsRequest: Promise<SeoSettings> | null = null;
const cachedPages = new Map<string, SeoPageSettings>();
const pageRequests = new Map<string, Promise<SeoPageSettings>>();

export function getCachedSeoSettings(): SeoSettings {
  return cachedSettings ?? DEFAULT_SEO_SETTINGS;
}

export function loadSeoSettings(): Promise<SeoSettings> {
  if (cachedSettings) return Promise.resolve(cachedSettings);
  if (settingsRequest) return settingsRequest;

  settingsRequest = api
    .get<SeoSettings>("/seo/settings")
    .then(({ data }) => {
      cachedSettings = data;
      return data;
    })
    .catch((error: unknown) => {
      settingsRequest = null;
      throw error;
    });
  return settingsRequest;
}

export function cacheSeoSettings(settings: SeoSettings): void {
  cachedSettings = settings;
  settingsRequest = Promise.resolve(settings);
}

export function getCachedSeoPage(pageKey: string): SeoPageSettings | null {
  return cachedPages.get(pageKey) ?? null;
}

export function loadSeoPage(pageKey: string): Promise<SeoPageSettings> {
  const cachedPage = cachedPages.get(pageKey);
  if (cachedPage) return Promise.resolve(cachedPage);
  const existingRequest = pageRequests.get(pageKey);
  if (existingRequest) return existingRequest;

  const request = api
    .get<SeoPageSettings>(`/seo/pages/${encodeURIComponent(pageKey)}`)
    .then(({ data }) => {
      cachedPages.set(pageKey, data);
      pageRequests.delete(pageKey);
      return data;
    })
    .catch((error: unknown) => {
      pageRequests.delete(pageKey);
      throw error;
    });
  pageRequests.set(pageKey, request);
  return request;
}

export function cacheSeoPage(page: SeoPageSettings): void {
  cachedPages.set(page.key, page);
  pageRequests.set(page.key, Promise.resolve(page));
}

export function useSeoPage(pageKey: string | null): SeoPageSettings | null {
  const [page, setPage] = useState<SeoPageSettings | null>(
    () => pageKey ? getCachedSeoPage(pageKey) : null,
  );

  useEffect(() => {
    if (!pageKey) {
      setPage(null);
      return;
    }

    let active = true;
    setPage(getCachedSeoPage(pageKey));
    loadSeoPage(pageKey)
      .then((loadedPage) => {
        if (active) setPage(loadedPage);
      })
      .catch((error: unknown) => {
        console.error(`Failed to load SEO settings for page "${pageKey}":`, error);
      });

    return () => {
      active = false;
    };
  }, [pageKey]);

  return page?.key === pageKey ? page : null;
}
