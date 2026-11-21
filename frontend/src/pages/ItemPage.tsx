import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { useModalStore } from "../hooks/useModal";
import PurchaseModalContent from "../components/PurchaseModalContent";
import Seo from "../components/Seo";
import { SeoTextBlock } from "../components/SeoPageContent";
import { useAuth } from "../store/auth";
import { formatDuration, getGameImage } from "../utils/gameCatalog";
import { getVideoEmbedUrl, isDirectVideoUrl } from "../utils/media";
import { applyDiscount, getCheatDiscountPercent } from "../utils/cheatPromotion";
import { getMockItemSales } from "../utils/itemSalesMock";

type Tariff = {
  id: number;
  title: string;
  duration_days: number | null;
  price: number;
  old_price: number | null;
  sort_order: number;
};

type FeatureCategory = {
  category_id: number;
  title: string;
  features: string[];
};

type GalleryMedia = {
  type: "image" | "video";
  url: string;
  alt?: string;
};

type Item = {
  id: number;
  name: string;
  alias: string;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_h1?: string | null;
  seo_text?: string | null;
  seo_image?: string | null;
  seo_noindex?: boolean;
  text?: string | null;
  tabs?: string | null;
  systems?: string | null;
  platforms?: string | null;
  instruction?: string | null;
  advantages?: string | null;
  keys_text?: string | null;
  status?: number;
  undetected?: number;
  win10?: number;
  win11?: number;
  amd?: number;
  intel?: number;
  preview?: string | null;
  video?: string | null;
  gallery?: GalleryMedia[];
  tariffs?: Tariff[];
  feature_categories?: FeatureCategory[];
  game_alias?: string | null;
  game_title?: string | null;
  promo_discount_percent?: number;
  promo_expires_at?: string;
};

type SimilarCheat = {
  id: number;
  name: string;
  alias: string;
  image?: string | null;
  gallery?: GalleryMedia[];
  price?: number | null;
  promo_discount_percent?: number;
  promo_expires_at?: string;
};

type CatalogItemsResponse = {
  items: (SimilarCheat & { shared_features: string[] })[];
};

function parseTabs(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isSafeMediaUrl(value: string): boolean {
  try {
    const protocol = new URL(value, window.location.origin).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function formatSaleDate(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeFeature(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

function formatSharedCategoryCount(count: number): string {
  const remainder100 = count % 100;
  const remainder10 = count % 10;
  const noun = remainder10 === 1 && remainder100 !== 11
    ? "общая категория"
    : remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)
      ? "общие категории"
      : "общих категорий";
  return `${count} ${noun}`;
}

function formatSharedFeatureCount(count: number): string {
  const remainder100 = count % 100;
  const remainder10 = count % 10;
  const noun = remainder10 === 1 && remainder100 !== 11
    ? "общая функция"
    : remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)
      ? "общие функции"
      : "общих функций";
  return `${count} ${noun}`;
}

export default function ItemPage() {
  const { alias } = useParams<{ alias: string }>();
  const { openModal } = useModalStore();
  const { user } = useAuth();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTariffId, setSelectedTariffId] = useState<number | null>(null);
  const [expandedFeatureCategoryId, setExpandedFeatureCategoryId] = useState<number | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [similarCheats, setSimilarCheats] = useState<
    { cheat: SimilarCheat; sharedFeatures: string[] }[]
  >([]);
  const [similarCheatsLoading, setSimilarCheatsLoading] = useState(false);
  const similarCheatsTrackRef = useRef<HTMLDivElement>(null);
  const itemSalesTrackRef = useRef<HTMLDivElement>(null);
  const itemSales = item ? getMockItemSales(item.alias) : null;

  const scrollItemSales = (direction: -1 | 1) => {
    const track = itemSalesTrackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(".item-sales__row");
    const distance = card ? card.offsetWidth + 12 : track.clientWidth;
    track.scrollLeft += direction * distance;
  };

  const scrollSimilarCheats = (direction: -1 | 1) => {
    const track = similarCheatsTrackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(".similar-cheat-card");
    const distance = card ? card.offsetWidth + 16 : track.clientWidth;
    track.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (!alias) return;

        const res = await fetch(`/api/catalog/items/${alias}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        setItem(json);
        setActiveMediaIndex(0);

        if (json.tariffs?.length) {
          setSelectedTariffId(json.tariffs[0].id);
        }
      } catch (e) {
        console.error(e);
        setItem(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [alias]);

  useEffect(() => {
    if (!item) {
      setSimilarCheats([]);
      setSimilarCheatsLoading(false);
      return;
    }

    const controller = new AbortController();
    setSimilarCheats([]);
    setSimilarCheatsLoading(true);

    fetch(`/api/catalog/similar-items/${encodeURIComponent(item.alias)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<CatalogItemsResponse>;
      })
      .then(({ items }) => {
        setSimilarCheats(items.map(({ shared_features, ...cheat }) => ({
          cheat,
          sharedFeatures: shared_features,
        })));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to load similar cheats:", error);
        setSimilarCheats([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSimilarCheatsLoading(false);
        }
      });

    return () => controller.abort();
  }, [item?.alias, item?.feature_categories]);

  const tabs = useMemo(() => parseTabs(item?.tabs), [item?.tabs]);
  const cleanDescription = useMemo(
    () => DOMPurify.sanitize(item?.text || ""),
    [item?.text]
  );

  const tariffs = item?.tariffs ?? [];
  const selectedTariff =
    tariffs.find((t) => t.id === selectedTariffId) || null;
  const loyaltyDiscountPercent = Math.min(10, Math.max(0, user?.discount_percent ?? 0));
  const discountPercent = getCheatDiscountPercent(
    loyaltyDiscountPercent,
    item?.promo_discount_percent,
    item?.promo_expires_at,
    user?.referral_discount_available,
  );
  const discountedPrice = (price: number) => applyDiscount(price, discountPercent);

  const gameImage = getGameImage(item?.game_alias, item?.game_title);
  const gallery = item?.gallery
    ? item.gallery
    : [
        ...(item?.preview ? [{ type: "image" as const, url: item.preview, alt: item.name }] : []),
        ...(item?.video ? [{ type: "video" as const, url: item.video, alt: item.name }] : []),
      ];
  const activeMedia = gallery[activeMediaIndex];
  const activeVideoEmbedUrl =
    activeMedia?.type === "video" ? getVideoEmbedUrl(activeMedia.url, true) : null;
  const firstGalleryImage = gallery.find((media) => media.type === "image");

  const handleBuyClick = () => {
    if (!item || !selectedTariff) return;

    openModal(
      <PurchaseModalContent
        item={{ name: item.name, alias: item.alias }}
        tariff={{
          ...selectedTariff,
          promo_discount_percent: item.promo_discount_percent,
          promo_expires_at: item.promo_expires_at,
        }}
      />,
      "Подтверждение покупки"
    );
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 32 }}>
        <Seo title="Загрузка товара" noIndex />
        Загрузка...
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container" style={{ paddingTop: 32 }}>
        <Seo title="Товар не найден" noIndex />
        Чит не найден
      </div>
    );
  }

  const publicDiscountPercent = getCheatDiscountPercent(
    0,
    item.promo_discount_percent,
    item.promo_expires_at,
  );
  const seoPrices = tariffs
    .map((tariff) => applyDiscount(tariff.price, publicDiscountPercent))
    .filter((price) => Number.isFinite(price) && price > 0);
  const seoPriceText = seoPrices.length
    ? `Цены: ${Math.min(...seoPrices).toLocaleString("ru-RU")}–${Math.max(...seoPrices).toLocaleString("ru-RU")} ₽.`
    : "";
  const seoDescriptionText =
    cleanDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ||
    `Описание и функционал чита ${item.name} в каталоге MILLEX.`;
  const seoDescription = [
    seoDescriptionText.slice(0, Math.max(0, 157 - seoPriceText.length)).trim(),
    seoPriceText,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 160);
  const productOffers = tariffs
    .filter((tariff) => Number.isFinite(tariff.price) && tariff.price > 0)
    .map((tariff) => ({
      "@type": "Offer",
      name: tariff.title,
      price: applyDiscount(tariff.price, publicDiscountPercent),
      priceCurrency: "RUB",
      availability: "https://schema.org/InStock",
      url: `https://millex.market/item/${encodeURIComponent(item.alias)}`,
    }));
  const supportedSystems = [
    ...(item.win10 === 1 ? ["Windows 10"] : []),
    ...(item.win11 === 1 ? ["Windows 11"] : []),
  ];
  const systemsText = item.systems?.trim() || supportedSystems.join(" • ");
  const supportedProcessors = [
    ...(item.intel === 1 ? ["Intel"] : []),
    ...(item.amd === 1 ? ["AMD"] : []),
  ];
  const supportedClients = item.platforms?.trim();
  const hasSimilarFeatureMatches = similarCheats.some(
    ({ sharedFeatures }) => sharedFeatures.length > 0,
  );

  return (
    <div className="item-page">
      <Seo
        title={item.seo_title || `Чит ${item.name}${item.game_title ? ` для ${item.game_title}` : ""} — описание и цены читов`}
        description={item.seo_description || seoDescription}
        canonicalPath={`/item/${encodeURIComponent(item.alias)}`}
        image={item.seo_image || gameImage}
        noIndex={item.seo_noindex}
        type="product"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Главная", item: "https://millex.market/" },
              { "@type": "ListItem", position: 2, name: "Каталог", item: "https://millex.market/catalog" },
              ...(item.game_title
                ? [{
                    "@type": "ListItem",
                    position: 3,
                    name: item.game_title,
                    item: `https://millex.market/catalog/${encodeURIComponent(item.game_alias || "")}`,
                  }]
                : []),
              {
                "@type": "ListItem",
                position: item.game_title ? 4 : 3,
                name: item.name,
                item: `https://millex.market/item/${encodeURIComponent(item.alias)}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: item.name,
            description: seoDescription,
            sku: item.alias,
            brand: { "@type": "Brand", name: "MILLEX" },
            ...(productOffers.length ? { offers: productOffers } : {}),
          },
        ]}
      />
      <div className="container">
        <nav className="item-page__breadcrumbs" aria-label="Хлебные крошки">
          <Link to="/">Главная</Link>
          <span className="item-page__breadcrumbs__separator">/</span>
          <Link to="/catalog">Каталог</Link>
          {item.game_title && (
            <>
              <span className="item-page__breadcrumbs__separator">/</span>
              <Link to={`/catalog/${encodeURIComponent(item.game_alias || "")}`}>
                {item.game_title}
              </Link>
            </>
          )}
          <span className="item-page__breadcrumbs__separator">/</span>
          <span className="item-page__breadcrumbs__current">{item.name}</span>
        </nav>

        <div className="item-page__layout">
          <main className="item-page__main">
            {gallery.length > 0 && activeMedia && (
              <section className="item-gallery" aria-label={`Скриншоты и видео ${item.name}`}>
                <div className={`item-gallery__stage${activeMedia.type === "video" ? " is-video" : ""}`}>
                  {activeMedia.type === "image" ? (
                    <img
                      className="item-gallery__media"
                      src={activeMedia.url}
                      alt={activeMedia.alt || item.name}
                    />
                  ) : activeVideoEmbedUrl ? (
                    <iframe
                      className="item-gallery__media"
                      src={activeVideoEmbedUrl}
                      title={activeMedia.alt || `Видео: ${item.name}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : isSafeMediaUrl(activeMedia.url) && isDirectVideoUrl(activeMedia.url) ? (
                    <video
                      key={activeMedia.url}
                      className="item-gallery__media"
                      src={activeMedia.url}
                      poster={firstGalleryImage?.url}
                      autoPlay
                      muted
                      controls
                      playsInline
                    >
                      Ваш браузер не поддерживает воспроизведение видео.
                    </video>
                  ) : (
                    <span className="item-gallery__unsupported-video">
                      Поддерживаются YouTube, Vimeo, Kinescope и прямые ссылки MP4/WebM/OGG
                    </span>
                  )}

                  {gallery.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="item-gallery__nav item-gallery__nav--previous"
                        aria-label="Предыдущий слайд"
                        onClick={() => setActiveMediaIndex((activeMediaIndex - 1 + gallery.length) % gallery.length)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m15 18-6-6 6-6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="item-gallery__nav item-gallery__nav--next"
                        aria-label="Следующий слайд"
                        onClick={() => setActiveMediaIndex((activeMediaIndex + 1) % gallery.length)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </>
                  )}
                  <span className="item-gallery__count">
                    {activeMediaIndex + 1} / {gallery.length}
                  </span>
                </div>

                {gallery.length > 1 && (
                  <div className="item-gallery__thumbnails" aria-label="Выбрать изображение или видео">
                    {gallery.map((media, index) => (
                      <button
                        key={`${media.type}-${media.url}-${index}`}
                        type="button"
                        className={`item-gallery__thumbnail${index === activeMediaIndex ? " is-active" : ""}`}
                        aria-label={`Показать ${media.type === "video" ? "видео" : "скриншот"} ${index + 1}`}
                        aria-pressed={index === activeMediaIndex}
                        onClick={() => setActiveMediaIndex(index)}
                      >
                        {media.type === "image" ? (
                          <img src={media.url} alt={media.alt || ""} loading="lazy" />
                        ) : (
                          <>
                            {firstGalleryImage && (
                              <img
                                src={firstGalleryImage.url}
                                alt=""
                                loading="lazy"
                              />
                            )}
                            <span aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                              <path d="m9 6 10 6-10 6V6Z" />
                            </svg>
                            </span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="item-hero">
              {gameImage && (
                <div className="item-hero-art" aria-hidden="true">
                  <img src={gameImage} alt="" />
                </div>
              )}

              <div className="item-hero__top">
                <div>
                  <div className="item-hero__label">Чит для игры</div>
                  <h1 className="item-hero__title">
                    {item.seo_h1?.trim() || item.name}
                  </h1>
                </div>

                <div className="item-hero__status">
                  {item.status === 1 ? "Доступен" : "Недоступен"}
                  {item.undetected === 1 && " • Undetected"}
                </div>
              </div>
            </section>

            <section className="item-sales" aria-labelledby="item-sales-title">
              <div className="item-sales__header">
                <div>
                  <span className="item-sales__eyebrow">Активность товара</span>
                  <h2 className="item-sales__title" id="item-sales-title">
                    Лента покупок
                  </h2>
                </div>
                <div className="item-sales__count" aria-label={`Покупок: ${itemSales?.purchase_count ?? 0}`}>
                  <strong>{itemSales?.purchase_count ?? "—"}</strong>
                  <span>покупок</span>
                </div>
              </div>
              {itemSales?.sales.length ? (
                <div
                  className={`item-sales__carousel${itemSales.sales.length > 1 ? "" : " item-sales__carousel--single"}`}
                >
                  {itemSales.sales.length > 1 && (
                    <button
                      type="button"
                      aria-label="Предыдущие покупки"
                      className="item-sales__control"
                      onClick={() => scrollItemSales(-1)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                  )}
                  <div className="item-sales__viewport">
                    <div className="item-sales__list" ref={itemSalesTrackRef}>
                      {itemSales.sales.map((sale, index) => (
                        <div className="item-sales__row" key={`${sale.created_at}-${index}`}>
                          <span className="item-sales__avatar" aria-hidden="true">
                            {sale.email.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="item-sales__details">
                            <span className="item-sales__email">{sale.email}</span>
                            <time
                              className="item-sales__date"
                              dateTime={sale.created_at}
                            >
                              {formatSaleDate(sale.created_at)}
                            </time>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {itemSales.sales.length > 1 && (
                    <button
                      type="button"
                      aria-label="Следующие покупки"
                      className="item-sales__control"
                      onClick={() => scrollItemSales(1)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <p className="item-sales__message">
                  Пока нет покупок этого чита.
                </p>
              )}
            </section>

            {(systemsText || supportedProcessors.length > 0 || supportedClients) && (
              <section className="item-requirements" aria-label="Системные требования">
                <h2 className="item-requirements__title">Системные требования</h2>
                <div className="item-requirements__grid">
                  {systemsText && (
                    <div className="item-requirements__entry">
                      <span className="item-requirements__icon" aria-hidden="true">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <div>
                        <div className="item-requirements__label">Системы</div>
                        <div className="item-requirements__value">{systemsText}</div>
                      </div>
                    </div>
                  )}
                  {supportedProcessors.length > 0 && (
                    <div className="item-requirements__entry">
                      <span className="item-requirements__icon" aria-hidden="true">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </span>
                      <div>
                        <div className="item-requirements__label">Процессоры</div>
                        <div className="item-requirements__value">{supportedProcessors.join(" • ")}</div>
                      </div>
                    </div>
                  )}
                  {supportedClients && (
                    <div className="item-requirements__entry">
                      <span className="item-requirements__icon" aria-hidden="true">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      </span>
                      <div>
                        <div className="item-requirements__label">Поддерживаемые клиенты</div>
                        <div className="item-requirements__value">{supportedClients}</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {item.text && (
              <section className="item-section">
                <h2 className="item-section__title">Описание</h2>
                <div
                  className="item-content"
                  dangerouslySetInnerHTML={{ __html: cleanDescription }}
                />
              </section>
            )}

            {!!item.feature_categories?.length && (
              <section className="item-feature-categories" aria-label="Функционал чита">
                {item.feature_categories.map((category) => {
                  const expanded = expandedFeatureCategoryId === category.category_id;
                  return (
                    <div
                      className={`item-feature-category${expanded ? " is-expanded" : ""}`}
                      key={category.category_id}
                    >
                      <button
                        className="item-feature-category__header"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedFeatureCategoryId(
                          expanded ? null : category.category_id,
                        )}
                      >
                        <span className="item-feature-category__icon" aria-hidden="true">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2 22 12 12 22 2 12 12 2Zm0 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
                          </svg>
                        </span>
                        <span>{category.title}</span>
                        <span className={`item-feature-category__chevron${expanded ? " is-expanded" : ""}`} aria-hidden="true">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      {expanded && category.features.length > 0 && (
                        <ul className="item-feature-category__features">
                          {category.features.map((feature, index) => (
                            <li key={`${category.category_id}-${index}`}>{feature}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {item.instruction && (
              <section className="item-section">
                <h2 className="item-section__title">Инструкция</h2>
                <div className="item-content">{item.instruction}</div>
              </section>
            )}
          </main>

          <aside className="item-page__sidebar">
            <div className="buy-card">
              <div className="buy-card__title">Оформление заказа</div>

              {tariffs.length > 0 && (
                <div className="buy-card__block">
                  <div className="buy-card__label">Выберите нужный тарифный план</div>

                  <div className="buy-card__tariffs">
                    {tariffs.map((tariff) => (
                      <button
                        key={tariff.id}
                        type="button"
                        className={`tariff-card tariff-card--button tariff-card--compact ${
                          selectedTariffId === tariff.id ? "active" : ""
                        }`}
                        onClick={() => setSelectedTariffId(tariff.id)}
                      >
                        <div className="tariff-card__title">
                          {formatDuration(tariff.title)}
                        </div>
                        <div className="tariff-card__text">
                          {discountPercent > 0 && (
                            <span className="tariff-card__old-price">{tariff.price} ₽ </span>
                          )}
                          {discountedPrice(tariff.price)} ₽
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="locked-discount-card">
                <div className="locked-discount-header">
                  <div className="locked-discount-icon">
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      ></path>
                    </svg>
                  </div>
                  <div>
                    {user ? (
                      <>
                        <p className="locked-discount-title">
                          Ваша накопительная скидка: {loyaltyDiscountPercent}%
                        </p>
                        <p className="locked-discount-text">
                          {loyaltyDiscountPercent === 10
                            ? "У вас максимальная скидка"
                            : "За каждый оплаченный заказ скидка увеличивается на 1%"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="locked-discount-title">Накопительные скидки до 10%</p>
                        <p className="locked-discount-text">
                          Создайте аккаунт за минуту - скидка будет расти с каждым заказом. Всё начисляется автоматически, без промокодов.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="locked-discount-progress">
                  <span style={{ width: `${loyaltyDiscountPercent * 10}%` }}></span>
                </div>
                <div className="locked-discount-scale">
                  <span>{user ? `${loyaltyDiscountPercent}%` : "0%"}</span>
                  <span>до 10%</span>
                </div>
                {!user && (
                  <a href="/register" className="locked-discount-button">
                    Зарегестрироваться
                  </a>
                )}
              </div>

              {typeof item.promo_discount_percent === "number" &&
                item.promo_discount_percent > 0 &&
                discountPercent >= item.promo_discount_percent && (
                <div className="item-promo-banner">
                  <strong>Скидка {item.promo_discount_percent}% для всех</strong>
                  <span>
                    Накопительная скидка сохраняется и продолжит расти. Скидки не складываются:
                    сейчас применяется большая, а ваша личная скидка будет доступна после акции.
                  </span>
                </div>
                )}


              <div className="buy-card__block">
                <div className="buy-card__label">Выбран тариф</div>
                <div className="buy-card__value">
                  {selectedTariff
                    ? `${formatDuration(selectedTariff.title)} / ${discountedPrice(selectedTariff.price)} ₽`
                    : "—"}
                </div>
              </div>

              <button
                className="buy-card__button"
                type="button"
                onClick={handleBuyClick}
                disabled={!selectedTariff}
              >
                Купить
              </button>

              <section className="buy-card__after-payment" aria-label="Что будет после оплаты">
                <h3 className="buy-card__after-payment-title">Сразу после оплаты</h3>
                <div className="buy-card__after-payment-items">
                  <div className="buy-card__after-payment-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="7.5" cy="15.5" r="4.5" />
                      <path d="m11 12 9-9 2 2-2 2 2 2-3 3-2-2-3 3m-6 2h.01" />
                    </svg>
                    <span>Ключ</span>
                  </div>
                  <div className="buy-card__after-payment-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3v12m-5-5 5 5 5-5M5 17v3h14v-3" />
                    </svg>
                    <span>Лоадер</span>
                  </div>
                  <div className="buy-card__after-payment-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m3 5 7-2 4 2 7-2v16l-7 2-4-2-7 2V5Z" />
                      <path d="M10 3v16m4-14v16" />
                    </svg>
                    <span>Инструкция</span>
                  </div>
                  <a
                    className="buy-card__after-payment-item"
                    href="https://t.me/MillexSupport_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 13v-2a9 9 0 0 1 18 0v2" />
                      <path d="M3 13h4v7H5a2 2 0 0 1-2-2v-5Zm18 0h-4v7h2a2 2 0 0 0 2-2v-5ZM17 20h-5" />
                    </svg>
                    <span>Поддержка 24/7</span>
                  </a>
                </div>
              </section>

              <div className="buy-card__agreement">
                Нажимая кнопку «Купить», вы подтверждаете, что ознакомились и
                соглашаетесь с{" "}
                <Link to="/user-agreement" target="_blank" rel="noopener noreferrer">
                  Пользовательским соглашением
                </Link>{" "}
                и{" "}
                <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                  Политикой конфиденциальности
                </Link>
                .
              </div>
              {!user && (
                <div className="buy-card__hint">5% кешбэк при наличии аккаунта</div>
              )}
            </div>
          </aside>
        </div>

        {(similarCheatsLoading || similarCheats.length > 0) && (
          <section className="similar-cheats" aria-labelledby="similar-cheats-title">
            <div className="similar-cheats__header">
              <div>
                <span className="similar-cheats__eyebrow">
                  {hasSimilarFeatureMatches ? "По совпадающим функциям" : "Рекомендуем ознакомиться"}
                </span>
                <h2 className="similar-cheats__title" id="similar-cheats-title">
                  {hasSimilarFeatureMatches ? "Похожие читы" : "Другие читы"}
                </h2>
                <p className="similar-cheats__description">
                  {hasSimilarFeatureMatches
                    ? "Подобраны по общим функциям, в том числе для других игр"
                    : "Другие товары из каталога"}
                </p>
              </div>
              {similarCheats.length > 1 && (
                <div className="similar-cheats__controls" aria-label="Управление каруселью">
                  <button
                    type="button"
                    aria-label="Предыдущие похожие читы"
                    onClick={() => scrollSimilarCheats(-1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Следующие похожие читы"
                    onClick={() => scrollSimilarCheats(1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {similarCheats.length > 0 ? (
              <div className="similar-cheats__viewport">
                <div className="similar-cheats__grid" ref={similarCheatsTrackRef}>
                  {similarCheats.map(({ cheat, sharedFeatures }) => {
                    const itemDiscountPercent = getCheatDiscountPercent(
                      0,
                      cheat.promo_discount_percent,
                      cheat.promo_expires_at,
                    );
                    const price = Number(cheat.price);
                    const discountedPrice = itemDiscountPercent
                      ? applyDiscount(price, itemDiscountPercent)
                      : price;
                    const screenshot = cheat.gallery?.find(
                      (media) => media.type === "image" && isSafeMediaUrl(media.url),
                    )?.url ?? (
                      cheat.image && isSafeMediaUrl(cheat.image) ? cheat.image : null
                    );

                    return (
                      <Link
                        className="similar-cheat-card"
                        key={cheat.id}
                        to={`/item/${encodeURIComponent(cheat.alias)}`}
                      >
                        <div className="similar-cheat-card__image">
                          <span className="similar-cheat-card__image-fallback" aria-hidden="true">
                            MILLEX
                          </span>
                          {screenshot && (
                            <img
                              src={screenshot}
                              alt=""
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          {sharedFeatures.length > 0 && (
                            <span className="similar-cheat-card__match">
                              {formatSharedFeatureCount(sharedFeatures.length)}
                            </span>
                          )}
                        </div>
                        <div className="similar-cheat-card__body">
                          <h3 className="similar-cheat-card__name">{cheat.name}</h3>
                          {sharedFeatures.length > 0 && (
                            <div className="similar-cheat-card__features">
                              {sharedFeatures.slice(0, 3).map((feature) => (
                                <span key={normalizeFeature(feature)}>{feature}</span>
                              ))}
                            </div>
                          )}
                          <div className="similar-cheat-card__footer">
                            {Number.isFinite(price) && price > 0 ? (
                              <span className="similar-cheat-card__price">
                                От{" "}
                                <strong>
                                  {Math.round(discountedPrice).toLocaleString("ru-RU")} ₽
                                </strong>
                              </span>
                            ) : (
                              <span className="similar-cheat-card__price">Смотреть тарифы</span>
                            )}
                            <span className="similar-cheat-card__link">
                              Подробнее <span aria-hidden="true">›</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="similar-cheats__empty">Подбираем читы из каталога…</p>
            )}
          </section>
        )}
        <SeoTextBlock content={item.seo_text} />
      </div>
    </div>
  );
}