import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Seo from "../components/Seo";
import { getGameImage } from "../utils/gameCatalog";
import { getVideoEmbedUrl, isDirectVideoUrl } from "../utils/media";
import { applyDiscount, getCheatDiscountPercent } from "../utils/cheatPromotion";
import { getMockItemSales } from "../utils/itemSalesMock";
import FaqSection from "../components/faqsection/FaqSection";

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
  text?: string | null;
  price?: number | null;
  image?: string | null;
  gallery?: GalleryMedia[];
  feature_categories?: FeatureCategory[];
  top?: number | string | boolean;
  hit?: number | string | boolean;
  undetected?: number | string | boolean;
  security_status?: number | string;
  promo_discount_percent?: number;
  promo_expires_at?: string;
  purchase_count?: number;
  last_purchase_at?: string | null;
};

type ItemSort = "newest" | "hit" | "undetected" | "top" | "price-asc" | "price-desc";

const itemSortOptions: { value: ItemSort; label: string }[] = [
  { value: "newest", label: "Сначала новые" },
  { value: "hit", label: "Хит продаж" },
  { value: "undetected", label: "Undetected" },
  { value: "top", label: "Популярные" },
  { value: "price-asc", label: "Сначала дешевле" },
  { value: "price-desc", label: "Сначала дороже" },
];

function isEnabledFlag(value: number | string | boolean | null | undefined): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return value.trim() === "1" || value.trim().toLowerCase() === "true";
}

function getSecurityStatus(item: Item): 1 | 2 | 3 | null {
  const status = Number(item.security_status);
  if (status === 1 || status === 2 || status === 3) return status;
  return isEnabledFlag(item.undetected) ? 1 : null;
}

function isUndetected(item: Item): boolean {
  return getSecurityStatus(item) === 1;
}

function formatLastPurchase(value?: string | null): string {
  if (!value) return "Пока нет покупок";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Покупка была недавно";
  const elapsedHours = Math.floor(Math.max(0, Date.now() - timestamp) / (60 * 60 * 1000));
  return elapsedHours < 1 ? "меньше часа назад" : `${elapsedHours} ч. назад`;
}

type GameResponse = {
  game: {
    id: number;
    title: string;
    slug: string;
    image?: string;
  };
  items: Item[];
};

export default function GamePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<GameResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemSort, setItemSort] = useState<ItemSort>("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredVideoItemId, setHoveredVideoItemId] = useState<number | null>(null);
  const [galleryIndexes, setGalleryIndexes] = useState<Record<string, number>>({});
  const sortRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (sortMenuOpen) {
      sortMenuRef.current
        ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
        ?.focus();
    }
  }, [sortMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/catalog/games/${slug}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: GameResponse = await res.json();
        setData(json);
        setHoveredVideoItemId(null);
      } catch (e) {
        console.error(e);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="container">
        <Seo title="Загрузка каталога игры" noIndex />
        Загрузка...
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container">
        <Seo title="Игра не найдена" noIndex />
        Игра не найдена
      </div>
    );
  }

  const fallbackGameImage = getGameImage(data.game.slug, data.game.title);
  const gameImage = data.game.image || fallbackGameImage;
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const filteredItems = data.items.filter((item) => {
    if (!normalizedSearch) return true;

    const searchableText = [
      item.name,
      item.alias,
      item.text,
      ...(item.feature_categories ?? []).flatMap((category) => [
        category.title,
        ...category.features,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();

    return searchableText.includes(normalizedSearch);
  });
  const sortedItems = itemSort === "newest"
    ? [...filteredItems]
    : filteredItems
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        if (itemSort === "price-asc" || itemSort === "price-desc") {
          const leftPrice = left.item.price == null
            ? null
            : applyDiscount(
              left.item.price,
              getCheatDiscountPercent(
                0,
                left.item.promo_discount_percent,
                left.item.promo_expires_at,
              ),
            );
          const rightPrice = right.item.price == null
            ? null
            : applyDiscount(
              right.item.price,
              getCheatDiscountPercent(
                0,
                right.item.promo_discount_percent,
                right.item.promo_expires_at,
              ),
            );

          if (leftPrice == null && rightPrice != null) return 1;
          if (leftPrice != null && rightPrice == null) return -1;
          if (leftPrice != null && rightPrice != null && leftPrice !== rightPrice) {
            return itemSort === "price-asc"
              ? leftPrice - rightPrice
              : rightPrice - leftPrice;
          }
        } else {
          const leftPriority = itemSort === "undetected"
            ? Number(isUndetected(left.item))
            : Number(isEnabledFlag(left.item[itemSort]));
          const rightPriority = itemSort === "undetected"
            ? Number(isUndetected(right.item))
            : Number(isEnabledFlag(right.item[itemSort]));
          if (leftPriority !== rightPriority) return rightPriority - leftPriority;

          if (itemSort === "hit" || itemSort === "top") {
            const salesDifference =
              (right.item.purchase_count ?? 0) - (left.item.purchase_count ?? 0);
            if (salesDifference !== 0) return salesDifference;
          }
        }

        return left.index - right.index;
      })
      .map(({ item }) => item);

  return (
    <div className="container game-page" style={{ paddingTop: 32 }}>
      <Seo
        title={`Читы для ${data.game.title} — каталог читов`}
        description={`Каталог игрового софта для ${data.game.title}: сравните доступные читы, их функции и предложения в MILLEX.`}
        image={gameImage}
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Главная", item: "https://millex.market/" },
              { "@type": "ListItem", position: 2, name: "Каталог", item: "https://millex.market/catalog" },
              {
                "@type": "ListItem",
                position: 3,
                name: data.game.title,
                item: `https://millex.market/catalog/${encodeURIComponent(data.game.slug)}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Читы для ${data.game.title}`,
            url: `https://millex.market/catalog/${encodeURIComponent(data.game.slug)}`,
            inLanguage: "ru-RU",
            mainEntity: {
              "@type": "ItemList",
              itemListElement: data.items.map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: item.name,
                url: `https://millex.market/item/${encodeURIComponent(item.alias)}`,
              })),
            },
          },
        ]}
      />
      <section className="game-hero">
        <div className="game-hero-image game-hero-image-character">
          {gameImage && (
            <img
              src={gameImage}
              alt=""
              aria-hidden="true"
              onError={(event) => {
                if (!fallbackGameImage || event.currentTarget.dataset.fallbackApplied) return;
                event.currentTarget.dataset.fallbackApplied = "true";
                event.currentTarget.src = fallbackGameImage;
              }}
            />
          )}
        </div>
        <div className="game-hero-content">
          <span className="game-hero-badge">Каталог игры</span>
          <h1 className="game-hero-title">Каталог читов</h1>
          <p className="game-hero-summary">
            Читы на {data.game.title} · {data.items.length} {data.items.length === 1 ? "предложение" : "предложений"}
          </p>
        </div>
      </section>

      <Link className="game-page__back" to="/catalog">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path
            d="m15 18-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Назад к играм
      </Link>

      <nav className="game-page__breadcrumbs" aria-label="Хлебные крошки">
        <Link to="/">Главная</Link>
        <span className="game-page__breadcrumbs__separator">/</span>
        <Link to="/catalog">Каталог</Link>
        <span className="game-page__breadcrumbs__separator">/</span>
        <span className="game-page__breadcrumbs__current">{data.game.title}</span>
      </nav>

      <div className="game-page__catalog-controls">
        <label className="game-page__search">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="m16 16 4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Поиск продуктов..."
            aria-label="Поиск читов"
          />
        </label>
        <div
          className={`game-page__sort${sortMenuOpen ? " is-open" : ""}`}
          ref={sortRef}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSortMenuOpen(false);
              sortButtonRef.current?.focus();
            }
          }}
        >
          <span>Сортировка</span>
          <button
            className="game-page__sort-toggle"
            type="button"
            ref={sortButtonRef}
            aria-label="Сортировка читов"
            aria-haspopup="menu"
            aria-expanded={sortMenuOpen}
            aria-controls="game-page-sort-menu"
            onClick={() => setSortMenuOpen((open) => !open)}
          >
            <span>{itemSortOptions.find((option) => option.value === itemSort)?.label}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path
                d="m7 10 5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {sortMenuOpen && (
            <div
              className="game-page__sort-menu"
              id="game-page-sort-menu"
              ref={sortMenuRef}
              role="menu"
            >
              {itemSortOptions.map((option) => (
                <button
                  className={`game-page__sort-option${itemSort === option.value ? " is-selected" : ""}`}
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={itemSort === option.value}
                  onKeyDown={(event) => {
                    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const options = Array.from(
                      sortMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
                    );
                    const currentIndex = options.indexOf(event.currentTarget);
                    const nextIndex = event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? options.length - 1
                        : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
                          options.length;
                    options[nextIndex]?.focus();
                  }}
                  onClick={() => {
                    setItemSort(option.value);
                    setSortMenuOpen(false);
                    sortButtonRef.current?.focus();
                  }}
                >
                  <span>{option.label}</span>
                  {itemSort === option.value && (
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                      <path
                        d="m5 12 4 4L19 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {sortedItems.length > 0 ? (
        <div className="games-grid">
          {sortedItems.map((item) => {
            const itemImages = (item.gallery ?? []).filter((media) => media.type === "image");
            const galleryIndex = galleryIndexes[item.alias] ?? 0;
            const itemImage = itemImages[galleryIndex]?.url || item.image || gameImage;
            const firstVideo = item.gallery?.[0]?.type === "video"
              ? item.gallery[0]
              : null;
            const hoverVideoEmbedUrl = firstVideo
              ? getVideoEmbedUrl(firstVideo.url, true)
              : null;
            const canPreviewVideo = Boolean(
              firstVideo &&
              (hoverVideoEmbedUrl || isDirectVideoUrl(firstVideo.url))
            );
            const isVideoHovered =
              hoveredVideoItemId === item.id && canPreviewVideo;
            const featureTags = (item.feature_categories ?? [])
              .map((category) => category.title.trim())
              .filter(Boolean);
            const mockSales = getMockItemSales(item.alias);
            const itemDiscountPercent = getCheatDiscountPercent(
              0,
              item.promo_discount_percent,
              item.promo_expires_at,
            );

            return (
              <Link
                key={item.id}
                to={`/item/${item.alias}`}
                className="game-card game-page__product-card"
              >
                <div
                  className="game-page__product-image"
                  onMouseEnter={() => {
                    if (canPreviewVideo) setHoveredVideoItemId(item.id);
                  }}
                  onMouseLeave={() => {
                    if (canPreviewVideo) setHoveredVideoItemId(null);
                  }}
                >
                  {itemImage && (
                    <img
                      src={itemImage}
                      alt=""
                      className="game-card-image"
                      loading="lazy"
                    />
                  )}
                  {itemImages.length > 1 && (
                    <div className="game-page__gallery-controls" aria-label="Скриншоты чита">
                      <button
                        type="button"
                        aria-label="Предыдущий скриншот"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setGalleryIndexes((indexes) => ({
                            ...indexes,
                            [item.alias]: (galleryIndex - 1 + itemImages.length) % itemImages.length,
                          }));
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="m15 18-6-6 6-6" />
                        </svg>
                      </button>
                      <span aria-live="polite">{galleryIndex + 1}/{itemImages.length}</span>
                      <button
                        type="button"
                        aria-label="Следующий скриншот"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setGalleryIndexes((indexes) => ({
                            ...indexes,
                            [item.alias]: (galleryIndex + 1) % itemImages.length,
                          }));
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {isVideoHovered && (
                    hoverVideoEmbedUrl ? (
                      <iframe
                        className="game-page__product-video"
                        src={hoverVideoEmbedUrl}
                        title={`Предпросмотр видео: ${item.name}`}
                        allow="autoplay; encrypted-media; picture-in-picture"
                      />
                    ) : firstVideo && isDirectVideoUrl(firstVideo.url) ? (
                      <video
                        className="game-page__product-video"
                        src={firstVideo.url}
                        poster={itemImage}
                        autoPlay
                        muted
                        loop
                        playsInline
                        aria-label={`Предпросмотр видео: ${item.name}`}
                      />
                    ) : null
                  )}
                  <div className="game-card-overlay" />
                  {(getSecurityStatus(item) !== null || isEnabledFlag(item.hit) || isEnabledFlag(item.top)) && (
                    <div className="game-page__product-badges">
                      {getSecurityStatus(item) === 1 && (
                        <span className="game-page__status-badge game-page__status-badge--ud" title="Undetected">
                          Undetected
                        </span>
                      )}
                      {getSecurityStatus(item) === 2 && (
                        <span className="game-page__status-badge game-page__status-badge--ou" title="On Updated">
                          On Updated
                        </span>
                      )}
                      {getSecurityStatus(item) === 3 && (
                        <span className="game-page__status-badge game-page__status-badge--risk" title="Risk">
                          Risk
                        </span>
                      )}
                      {isEnabledFlag(item.hit) && <span>Хит продаж</span>}
                      {isEnabledFlag(item.top) && <span>Популярный</span>}
                    </div>
                  )}
                </div>
                <div className="game-card-content">
                  <div className="game-page__product-heading">
                    <h2 className="game-card-title">{item.name}</h2>
                    <p className="game-page__product-game">Читы на {data.game.title}</p>
                  </div>

                  <div className="game-page__product-sales">
                    <strong>{mockSales.purchase_count} покупок</strong>
                    <span>{formatLastPurchase(mockSales.sales[0]?.created_at)}</span>
                  </div>

                  {featureTags.length > 0 && (
                    <>
                      <div
                        className="game-page__feature-tags game-page__feature-tags--desktop"
                        aria-label={`Функционал: ${featureTags.join(", ")}`}
                      >
                        {featureTags.slice(0, 7).map((tag, index) => (
                          <span key={`${item.id}-${tag}-${index}`} title={tag}>
                            {tag}
                          </span>
                        ))}
                        {featureTags.length > 7 && (
                          <span
                            className="game-page__feature-tags-more"
                            title={`Еще ${featureTags.length - 7} функций`}
                            aria-label={`Еще ${featureTags.length - 7} функций`}
                          >
                            +
                          </span>
                        )}
                      </div>
                      <div
                        className="game-page__feature-tags game-page__feature-tags--mobile"
                        aria-label={`Функционал: ${featureTags.join(", ")}`}
                      >
                        {featureTags.slice(0, 4).map((tag, index) => (
                          <span key={`${item.id}-${tag}-${index}`} title={tag}>
                            {tag}
                          </span>
                        ))}
                        {featureTags.length > 4 && (
                          <span
                            className="game-page__feature-tags-more"
                            title={`Еще ${featureTags.length - 4} функций`}
                            aria-label={`Еще ${featureTags.length - 4} функций`}
                          >
                            +
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  <div className="game-page__product-footer">
                    <span className="game-page__product-price">
                      {item.price != null && item.price > 0
                        ? (
                          <>
                            От{" "}
                            {itemDiscountPercent > 0 ? (
                              <>
                                <del>₽{Math.round(item.price).toLocaleString("ru-RU")}</del>
                                <strong className="game-page__product-sale-price">
                                  ₽{Math.round(applyDiscount(
                                    item.price,
                                    itemDiscountPercent,
                                  )).toLocaleString("ru-RU")}
                                </strong>
                                <small className="game-page__product-discount">
                                  -{itemDiscountPercent}%
                                </small>
                              </>
                            ) : (
                              <strong>₽{Math.round(item.price).toLocaleString("ru-RU")}</strong>
                            )}
                          </>
                        )
                        : "Подробнее"}
                    </span>
                    <span className="game-page__product-link">Подробнее</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="item-page__empty">
          {searchTerm.trim()
            ? "По вашему запросу ничего не найдено."
            : "Для этой игры пока нет доступных читов."}
        </div>
      )}
      <FaqSection/>
    </div>
  );
}
