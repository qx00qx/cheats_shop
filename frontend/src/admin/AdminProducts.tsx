import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import "../static/styles/admin/admin.css";

type Game = {
  id: number;
  slug: string;
  title: string;
};

type TariffDraft = { label: string; price: string; raw_price?: string | null };
type GalleryMedia = { type: "image" | "video"; url: string; alt: string };
type VideoUploadResponse = { filename: string; url: string };
const VIDEO_CHUNK_SIZE = 512 * 1024;
type FeatureCategory = { id: number; title: string };
type FeatureCategoryDraft = { category_id: number; features_text: string };
type AssignedFeatureCategory = {
  category_id: number;
  title: string;
  features: string[];
};

type ItemDraft = {
  name: string;
  alias: string;
  seo_title: string;
  seo_description: string;
  seo_image: string;
  seo_noindex: boolean;
  game_id: number;
  systems: string;
  text: string;
  instruction: string;
  instruction_link: string;
  advantages: string;
  keys_text: string;
  preview: string;
  gallery: GalleryMedia[];
  characteristics: string;
  platforms: string;
  video: string;
  status: number;
  security_status: 1 | 2 | 3;
  vis: number;
  home: number;
  top: number;
  hit: number;
  undetected: number;
  win10: number;
  win11: number;
  amd: number;
  intel: number;
  esp_title: string;
  esp: string;
  esp_desc: string;
  esp_en_title: string;
  esp_en_desc: string;
  aimbot_title: string;
  aimbot: string;
  aimbot_desc: string;
  aimbot_en_title: string;
  aimbot_en_desc: string;
  misc_title: string;
  misc: string;
  misc_desc: string;
  misc_en_title: string;
  misc_en_desc: string;
  loot_title: string;
  loot: string;
  loot_desc: string;
  loot_en_title: string;
  loot_en_desc: string;
  visuals_title: string;
  visuals: string;
  visuals_desc: string;
  visuals_en_title: string;
  visuals_en_desc: string;
  feature_categories: FeatureCategoryDraft[];
  tariffs: TariffDraft[];
};

type AdminItem = Omit<ItemDraft, "feature_categories"> & {
  id: number;
  game_title: string | null;
  feature_categories?: AssignedFeatureCategory[];
};

type ItemSort = "newest" | "oldest" | "name" | "game" | "price-asc" | "price-desc" | "active" | "inactive";

const itemSortOptions: { value: ItemSort; label: string }[] = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "name", label: "По названию" },
  { value: "game", label: "По игре" },
  { value: "price-asc", label: "Сначала дешевле" },
  { value: "price-desc", label: "Сначала дороже" },
  { value: "active", label: "Сначала активные" },
  { value: "inactive", label: "Сначала отключённые" },
];

const getMinPrice = (item: AdminItem): number => {
  const prices = item.tariffs
    .map((tariff) => Number(tariff.price))
    .filter(Number.isFinite);
  return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
};

const emptyDraft = (): ItemDraft => ({
  name: "",
  alias: "",
  seo_title: "",
  seo_description: "",
  seo_image: "",
  seo_noindex: false,
  game_id: 0,
  systems: "",
  text: "",
  instruction: "",
  instruction_link: "",
  advantages: "",
  keys_text: "",
  preview: "",
  gallery: [],
  characteristics: "",
  platforms: "",
  video: "",
  status: 1,
  security_status: 2,
  vis: 1,
  home: 0,
  top: 0,
  hit: 0,
  undetected: 0,
  win10: 0,
  win11: 0,
  amd: 0,
  intel: 0,
  esp_title: "",
  esp: "",
  esp_desc: "",
  esp_en_title: "",
  esp_en_desc: "",
  aimbot_title: "",
  aimbot: "",
  aimbot_desc: "",
  aimbot_en_title: "",
  aimbot_en_desc: "",
  misc_title: "",
  misc: "",
  misc_desc: "",
  misc_en_title: "",
  misc_en_desc: "",
  loot_title: "",
  loot: "",
  loot_desc: "",
  loot_en_title: "",
  loot_en_desc: "",
  visuals_title: "",
  visuals: "",
  visuals_desc: "",
  visuals_en_title: "",
  visuals_en_desc: "",
  feature_categories: [],
  tariffs: [{ label: "1 day", price: "" }],
});

const textFields: { key: Exclude<keyof ItemDraft, "game_id" | "tariffs" | "gallery" | "feature_categories" | "status" | "vis" | "home" | "top" | "hit" | "undetected" | "win10" | "win11" | "amd" | "intel" | "seo_noindex">; label: string; rows?: number }[] = [
  { key: "systems", label: "Поддерживаемые системы" },
  { key: "preview", label: "Ссылка на обложку" },
  { key: "text", label: "Описание", rows: 5 },
  { key: "advantages", label: "Преимущества", rows: 4 },
  { key: "characteristics", label: "Характеристики", rows: 4 },
  { key: "keys_text", label: "Описание выдачи ключа", rows: 3 },
  { key: "instruction", label: "Инструкция", rows: 5 },
  { key: "instruction_link", label: "Ссылка на инструкцию в блоге" },
  { key: "platforms", label: "Платформы", rows: 3 },
  { key: "esp_title", label: "Заголовок ESP" },
  { key: "esp", label: "Функции ESP", rows: 4 },
  { key: "esp_desc", label: "Описание ESP", rows: 3 },
  { key: "esp_en_title", label: "ESP title (EN)" },
  { key: "esp_en_desc", label: "ESP description (EN)", rows: 3 },
  { key: "aimbot_title", label: "Заголовок Aimbot" },
  { key: "aimbot", label: "Функции Aimbot", rows: 4 },
  { key: "aimbot_desc", label: "Описание Aimbot", rows: 3 },
  { key: "aimbot_en_title", label: "Aimbot title (EN)" },
  { key: "aimbot_en_desc", label: "Aimbot description (EN)", rows: 3 },
  { key: "misc_title", label: "Заголовок Misc" },
  { key: "misc", label: "Прочие функции", rows: 4 },
  { key: "misc_desc", label: "Описание Misc", rows: 3 },
  { key: "misc_en_title", label: "Misc title (EN)" },
  { key: "misc_en_desc", label: "Misc description (EN)", rows: 3 },
  { key: "loot_title", label: "Заголовок Loot" },
  { key: "loot", label: "Функции Loot", rows: 4 },
  { key: "loot_desc", label: "Описание Loot", rows: 3 },
  { key: "loot_en_title", label: "Loot title (EN)" },
  { key: "loot_en_desc", label: "Loot description (EN)", rows: 3 },
  { key: "visuals_title", label: "Заголовок Visuals" },
  { key: "visuals", label: "Функции Visuals", rows: 4 },
  { key: "visuals_desc", label: "Описание Visuals", rows: 3 },
  { key: "visuals_en_title", label: "Visuals title (EN)" },
  { key: "visuals_en_desc", label: "Visuals description (EN)", rows: 3 },
];

const flagFields: { key: "home" | "top" | "hit" | "win10" | "win11" | "amd" | "intel" | "status" | "vis"; label: string }[] = [
  { key: "status", label: "Чит активен" },
  { key: "vis", label: "Показывать в каталоге" },
  { key: "home", label: "Показывать на главной" },
  { key: "top", label: "Отметить как популярный" },
  { key: "hit", label: "Хит продаж" },
  { key: "win10", label: "Поддержка Windows 10" },
  { key: "win11", label: "Поддержка Windows 11" },
  { key: "amd", label: "Поддержка AMD" },
  { key: "intel", label: "Поддержка Intel" },
];

function getApiError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "detail" in error.response.data &&
    typeof error.response.data.detail === "string"
  ) {
    return error.response.data.detail;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    error.response.status === 413
  ) {
    return "Сервер отклонил часть загрузки. Проверьте, что на сервере установлены обновлённые backend и nginx-конфигурация; размер каждой части — 512 КиБ.";
  }
  return error instanceof Error ? error.message : "Не удалось выполнить запрос";
}

export default function AdminProducts() {
  const [games, setGames] = useState<Game[]>([]);
  const [featureCategories, setFeatureCategories] = useState<FeatureCategory[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [visibilityUpdatingId, setVisibilityUpdatingId] = useState<number | null>(null);
  const [securityStatusUpdatingId, setSecurityStatusUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [newFeatureCategory, setNewFeatureCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [editorCategoryTitle, setEditorCategoryTitle] = useState("");
  const [editorCategoryError, setEditorCategoryError] = useState("");
  const [editorCategorySaving, setEditorCategorySaving] = useState(false);
  const [uploadingVideoIndex, setUploadingVideoIndex] = useState<number | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const videoUploadTarget = useRef<number | null>(null);
  const videoFileInput = useRef<HTMLInputElement>(null);
  const [itemSort, setItemSort] = useState<ItemSort>("newest");

  const sortedItems = [...items].sort((left, right) => {
    const newestFirst = right.id - left.id;
    switch (itemSort) {
      case "oldest":
        return left.id - right.id;
      case "name":
        return left.name.localeCompare(right.name, "ru", { sensitivity: "base" }) || newestFirst;
      case "game":
        return (left.game_title || "").localeCompare(right.game_title || "", "ru", { sensitivity: "base" }) || newestFirst;
      case "price-asc":
      case "price-desc": {
        const leftPrice = getMinPrice(left);
        const rightPrice = getMinPrice(right);
        if (leftPrice === rightPrice) return newestFirst;
        if (itemSort === "price-asc") return leftPrice < rightPrice ? -1 : 1;
        return leftPrice > rightPrice ? -1 : 1;
      }
      case "active":
        return right.status - left.status || newestFirst;
      case "inactive":
        return left.status - right.status || newestFirst;
      default:
        return newestFirst;
    }
  });

  useEffect(() => {
    void loadGames();
    void loadItems();
    void loadFeatureCategories();
  }, []);

  const loadGames = async () => {
    try {
      const response = await api.get<Game[]>("/catalog/categories");
      setGames(response.data);
    } catch (loadError) {
      console.error("Failed to load games for admin products:", loadError);
      setListError("Не удалось загрузить список игр.");
    }
  };

  const loadItems = async () => {
    setListLoading(true);
    setListError("");
    try {
      const response = await api.get<AdminItem[]>("/catalog/admin/items");
      setItems(response.data);
    } catch (loadError) {
      console.error("Failed to load admin products:", loadError);
      setListError("Не удалось загрузить список читов.");
    } finally {
      setListLoading(false);
    }
  };

  const loadFeatureCategories = async () => {
    try {
      const response = await api.get<FeatureCategory[]>("/catalog/admin/feature-categories");
      setFeatureCategories(response.data);
    } catch (loadError) {
      console.error("Failed to load cheat feature categories:", loadError);
      setCategoryError("Не удалось загрузить категории функционала.");
    }
  };

  const createFeatureCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newFeatureCategory.trim();
    if (!title) return;
    setCategorySaving(true);
    setCategoryError("");
    try {
      const response = await api.post<FeatureCategory>(
        "/catalog/admin/feature-categories",
        { title },
      );
      setFeatureCategories((current) =>
        [...current, response.data].sort((left, right) =>
          left.title.localeCompare(right.title, "ru"),
        ),
      );
      setNewFeatureCategory("");
    } catch (saveError) {
      console.error("Failed to create cheat feature category:", saveError);
      setCategoryError(getApiError(saveError));
    } finally {
      setCategorySaving(false);
    }
  };

  const createFeatureCategoryForItem = async () => {
    const title = editorCategoryTitle.trim();
    if (!title) return;
    setEditorCategorySaving(true);
    setEditorCategoryError("");
    try {
      const response = await api.post<FeatureCategory>(
        "/catalog/admin/feature-categories",
        { title },
      );
      setFeatureCategories((current) =>
        [...current, response.data].sort((left, right) =>
          left.title.localeCompare(right.title, "ru"),
        ),
      );
      setDraft((current) => ({
        ...current,
        feature_categories: [
          ...current.feature_categories,
          { category_id: response.data.id, features_text: "" },
        ],
      }));
      setEditorCategoryTitle("");
    } catch (saveError) {
      console.error("Failed to create item feature category:", saveError);
      setEditorCategoryError(getApiError(saveError));
    } finally {
      setEditorCategorySaving(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setError("");
    setEditorCategoryTitle("");
    setEditorCategoryError("");
    setShowModal(true);
  };

  const openEdit = (item: AdminItem) => {
    setEditingId(item.id);
    setDraft({
      ...emptyDraft(),
      ...item,
      gallery: item.gallery ?? [],
      feature_categories: (item.feature_categories ?? []).map((category) => ({
        category_id: category.category_id,
        features_text: category.features.join(", "),
      })),
      tariffs: item.tariffs.map((tariff) => ({
        label: tariff.label,
        price: String(tariff.price),
        raw_price: tariff.raw_price,
      })),
    });
    setError("");
    setEditorCategoryTitle("");
    setEditorCategoryError("");
    setShowModal(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      ...draft,
      feature_categories: draft.feature_categories.map((category) => ({
        category_id: category.category_id,
        features: category.features_text
          .split(",")
          .map((feature) => feature.trim())
          .filter(Boolean),
      })),
      tariffs: draft.tariffs.map((tariff) => ({
        label: tariff.label.trim(),
        price: Number(tariff.price),
        raw_price: editingId === null ? undefined : tariff.raw_price,
      })),
    };

    try {
      if (editingId === null) {
        await api.post("/catalog/items", payload);
      } else {
        await api.put(`/catalog/admin/items/${editingId}`, payload);
      }
      setShowModal(false);
      await loadItems();
    } catch (saveError) {
      console.error("Failed to save admin product:", saveError);
      setError(getApiError(saveError));
    } finally {
      setLoading(false);
    }
  };

  const toggleItemVisibility = async (item: AdminItem) => {
    const nextVisibility = item.vis === 1 ? 0 : 1;
    setVisibilityUpdatingId(item.id);
    setListError("");
    try {
      const response = await api.patch<{ id: number; vis: number }>(
        `/catalog/admin/items/${item.id}/visibility`,
        { vis: nextVisibility },
      );
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, vis: response.data.vis } : entry,
        ),
      );
    } catch (updateError) {
      console.error("Failed to update catalog visibility:", updateError);
      setListError(`Не удалось изменить видимость «${item.name}»: ${getApiError(updateError)}`);
    } finally {
      setVisibilityUpdatingId(null);
    }
  };

  const updateItemSecurityStatus = async (item: AdminItem, securityStatus: number) => {
    if (securityStatus !== 1 && securityStatus !== 2 && securityStatus !== 3) return;
    setSecurityStatusUpdatingId(item.id);
    setListError("");
    try {
      const response = await api.patch<{ id: number; security_status: 1 | 2 | 3 }>(
        `/catalog/admin/items/${item.id}/security-status`,
        { security_status: securityStatus },
      );
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                security_status: response.data.security_status,
                undetected: Number(response.data.security_status === 1),
              }
            : entry,
        ),
      );
    } catch (updateError) {
      console.error("Failed to update cheat security status:", updateError);
      setListError(`Не удалось изменить префикс «${item.name}»: ${getApiError(updateError)}`);
    } finally {
      setSecurityStatusUpdatingId(null);
    }
  };

  const updateTariff = (index: number, field: keyof TariffDraft, value: string) => {
    setDraft((current) => ({
      ...current,
      tariffs: current.tariffs.map((tariff, tariffIndex) =>
        tariffIndex === index ? { ...tariff, [field]: value } : tariff
      ),
    }));
  };

  const toggleFeatureCategory = (categoryId: number, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      feature_categories: checked
        ? [...current.feature_categories, { category_id: categoryId, features_text: "" }]
        : current.feature_categories.filter((category) => category.category_id !== categoryId),
    }));
  };

  const updateCategoryFeatures = (categoryId: number, featuresText: string) => {
    setDraft((current) => ({
      ...current,
      feature_categories: current.feature_categories.map((category) =>
        category.category_id === categoryId
          ? { ...category, features_text: featuresText }
          : category,
      ),
    }));
  };

  const updateGalleryMedia = (
    index: number,
    field: "url" | "alt",
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      gallery: current.gallery.map((media, mediaIndex) =>
        mediaIndex === index ? { ...media, [field]: value } : media,
      ),
    }));
  };

  const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    const index = videoUploadTarget.current;
    event.currentTarget.value = "";
    videoUploadTarget.current = null;
    if (!file || index === null) return;
    if (file.size === 0) {
      setError("Выбранный видеофайл пуст.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError("Размер видео не должен превышать 500 МБ.");
      return;
    }

    setUploadingVideoIndex(index);
    setVideoUploadProgress(0);
    setError("");
    const uploadId = crypto.randomUUID();
    try {
      const totalChunks = Math.ceil(file.size / VIDEO_CHUNK_SIZE);
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const start = chunkIndex * VIDEO_CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(start + VIDEO_CHUNK_SIZE, file.size));
        await api.put(
          `/admin/uploads/videos/chunks/${uploadId}/${chunkIndex}`,
          chunk,
          {
            params: { total_chunks: totalChunks },
            headers: { "Content-Type": "application/octet-stream" },
          },
        );
        setVideoUploadProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
      }
      const response = await api.post<VideoUploadResponse>(
        `/admin/uploads/videos/finalize/${uploadId}`,
        { filename: file.name, total_chunks: totalChunks },
      );
      const videoUrl = new URL(response.data.url, window.location.origin).toString();
      setDraft((current) => ({
        ...current,
        gallery: current.gallery.map((media, mediaIndex) =>
          mediaIndex === index ? { ...media, type: "video", url: videoUrl } : media,
        ),
      }));
    } catch (uploadError) {
      console.error("Failed to upload admin product video:", uploadError);
      setError(getApiError(uploadError));
      try {
        await api.delete(`/admin/uploads/videos/chunks/${uploadId}`);
      } catch (cleanupError) {
        console.error("Failed to clean up temporary video upload:", cleanupError);
      }
    } finally {
      setUploadingVideoIndex(null);
      setVideoUploadProgress(0);
    }
  };

  const fieldStyle = { display: "grid", gap: 6 } as const;
  const labelStyle = { fontSize: 13, color: "rgba(255,255,255,0.7)" } as const;
  const modal = showModal && typeof document !== "undefined" ? createPortal(
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(8px)",
      }}
      onClick={() => !loading && uploadingVideoIndex === null && setShowModal(false)}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-item-title"
        style={{
          width: "min(760px, 100%)",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: 24,
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          background: "#0f1114",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="admin-item-title" style={{ marginBottom: 20 }}>
          {editingId === null ? "Добавить чит" : `Редактировать чит #${editingId}`}
        </h2>
        {error && <p role="alert" style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="item-name">Название чита *</label>
            <input id="item-name" className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="item-alias">Alias *</label>
            <input id="item-alias" className="input" value={draft.alias} onChange={(event) => setDraft({ ...draft, alias: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} pattern="(-|[a-z0-9_])+" required />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="item-game">Игра *</label>
            <select id="item-game" className="input" value={draft.game_id || ""} onChange={(event) => setDraft({ ...draft, game_id: Number(event.target.value) })} required>
              <option value="">Выберите игру</option>
              {games.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}
            </select>
          </div>
          <fieldset style={{ border: "1px solid rgba(0,255,140,0.2)", borderRadius: 12, padding: 14 }}>
            <legend>SEO</legend>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="item-seo-title">SEO title</label>
                <input
                  id="item-seo-title"
                  className="input"
                  maxLength={255}
                  value={draft.seo_title}
                  onChange={(event) => setDraft({ ...draft, seo_title: event.target.value })}
                  placeholder="Пусто — сформировать из названия чита"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="item-seo-description">SEO description</label>
                <textarea
                  id="item-seo-description"
                  className="input"
                  maxLength={500}
                  rows={3}
                  value={draft.seo_description}
                  onChange={(event) => setDraft({ ...draft, seo_description: event.target.value })}
                  placeholder="Пусто — сформировать из описания чита"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="item-seo-image">SEO image</label>
                <input
                  id="item-seo-image"
                  className="input"
                  maxLength={2000}
                  value={draft.seo_image}
                  onChange={(event) => setDraft({ ...draft, seo_image: event.target.value })}
                  placeholder="URL или путь к изображению"
                />
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={draft.seo_noindex}
                  onChange={(event) => setDraft({ ...draft, seo_noindex: event.target.checked })}
                />
                Запретить индексацию страницы товара
              </label>
            </div>
          </fieldset>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="item-security-status">Статус безопасности чита</label>
            <select
              id="item-security-status"
              className="input"
              value={draft.security_status}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value === 1 || value === 2 || value === 3) {
                  setDraft((current) => ({ ...current, security_status: value }));
                }
              }}
            >
              <option value={1}>Undetected</option>
              <option value={2}>On Update</option>
              <option value={3}>Risk</option>
            </select>
          </div>

          <fieldset style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 14 }}>
            <legend>Категории и функционал чита</legend>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <input
                className="input"
                style={{ flex: "1 1 220px" }}
                maxLength={120}
                value={editorCategoryTitle}
                onChange={(event) => setEditorCategoryTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createFeatureCategoryForItem();
                  }
                }}
                placeholder="Название новой категории"
                aria-label="Название новой категории функционала"
              />
              <button
                type="button"
                className="btn-ghost"
                disabled={editorCategorySaving || !editorCategoryTitle.trim()}
                onClick={() => void createFeatureCategoryForItem()}
              >
                {editorCategorySaving ? "Создание..." : "+ Создать и добавить"}
              </button>
            </div>
            {editorCategoryError && (
              <p role="alert" style={{ color: "#ff8a8a", marginTop: 0 }}>
                {editorCategoryError}
              </p>
            )}
            {featureCategories.length === 0 ? (
              <p className="muted">Создайте категорию выше, затем перечислите её функции через запятую.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {featureCategories.map((category) => {
                  const assignment = draft.feature_categories.find(
                    (entry) => entry.category_id === category.id,
                  );
                  return (
                    <div key={category.id} style={{ display: "grid", gap: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(assignment)}
                          onChange={(event) => toggleFeatureCategory(category.id, event.target.checked)}
                        />
                        {category.title}
                      </label>
                      {assignment && (
                        <textarea
                          className="input"
                          rows={3}
                          aria-label={`Функционал: ${category.title}`}
                          placeholder="Включить аимбот, Тихий аим, Игнорировать ботов"
                          value={assignment.features_text}
                          onChange={(event) => updateCategoryFeatures(category.id, event.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="muted" style={{ marginBottom: 0 }}>
              Перечисляйте функции через запятую. Категории и функции появятся на странице чита.
            </p>
          </fieldset>

          {textFields.map(({ key, label, rows }) => (
            <div key={key} style={fieldStyle}>
              <label style={labelStyle} htmlFor={`item-${key}`}>{label}</label>
              {rows ? (
                <textarea id={`item-${key}`} className="input" rows={rows} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
              ) : (
                <input
                  id={`item-${key}`}
                  className="input"
                  value={draft[key]}
                  placeholder={key === "instruction_link" ? "/blog/manual-next" : undefined}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              )}
              {key === "instruction_link" && (
                <small className="muted">
                  Откройте нужную статью в блоге и укажите её адрес, например /blog/manual-next.
                  Это ссылка-кнопка в окне выдачи ключа; поле «Инструкция» выше — для текста.
                  Старые адреса /blogs/... и ссылки millex.xyz при сохранении преобразуются к пути на millex.market.
                </small>
              )}
            </div>
          ))}

          <fieldset style={{ border: "1px solid rgba(0,255,140,0.2)", borderRadius: 12, padding: 14, background: "rgba(0,255,140,0.025)" }}>
            <legend>Галерея скриншотов и видео</legend>
            <p style={{ marginTop: 0, color: "#fff" }}>
              Добавьте URL изображений, прямые MP4/WebM или ссылки YouTube/Vimeo. Видео можно загрузить прямо сюда — оно сохранится на сервере и ссылка подставится автоматически. Максимальный размер видео — 500 МБ.
            </p>
            <input
              ref={videoFileInput}
              type="file"
              accept=".mp4,.webm,.ogg,.ogv,video/mp4,video/webm,video/ogg"
              style={{ display: "none" }}
              onChange={(event) => void handleVideoUpload(event)}
            />
            {draft.gallery.length > 0 && (
              <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                {draft.gallery.map((media, index) => (
                  <div
                    key={`gallery-${index}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "72px minmax(0, 1fr) auto",
                      gap: 10,
                      alignItems: "center",
                      padding: 10,
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      background: "#0a0c0d",
                    }}
                  >
                    <div style={{ width: 72, aspectRatio: "16 / 9", overflow: "hidden", borderRadius: 6, background: "#171a19", display: "grid", placeItems: "center", color: "#00ff8c", fontSize: 11 }}>
                      {media.type === "image" && media.url ? (
                        <img src={media.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : media.type === "video" ? "ВИДЕО" : "ПРЕВЬЮ"}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(100px, 140px) minmax(0, 1fr)", gap: 8 }}>
                      <select
                        className="input"
                        aria-label={`Тип медиа ${index + 1}`}
                        value={media.type}
                        disabled={uploadingVideoIndex !== null}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          gallery: current.gallery.map((entry, mediaIndex) =>
                            mediaIndex === index
                              ? { ...entry, type: event.target.value === "video" ? "video" : "image" }
                              : entry,
                          ),
                        }))}
                      >
                        <option value="image">Скриншот</option>
                        <option value="video">Видео</option>
                      </select>
                      <input
                        className="input"
                        type="text"
                        maxLength={2000}
                        aria-label={`URL медиа ${index + 1}`}
                        placeholder={media.type === "image" ? "https://.../screenshot.jpg" : "https://millex.market/uploads/videos/demo.mp4"}
                        value={media.url}
                        onChange={(event) => updateGalleryMedia(index, "url", event.target.value)}
                        required
                      />
                      {media.type === "video" && (
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ gridColumn: "1 / -1", justifySelf: "start" }}
                          disabled={uploadingVideoIndex !== null}
                          onClick={() => {
                            videoUploadTarget.current = index;
                            videoFileInput.current?.click();
                          }}
                        >
                          {uploadingVideoIndex === index
                            ? `Загрузка видео... ${videoUploadProgress}%`
                            : "Загрузить видео"}
                        </button>
                      )}
                      <input
                        className="input"
                        style={{ gridColumn: "1 / -1" }}
                        maxLength={255}
                        aria-label={`Описание медиа ${index + 1}`}
                        placeholder="Подпись или alt-текст (необязательно)"
                        value={media.alt}
                        onChange={(event) => updateGalleryMedia(index, "alt", event.target.value)}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        aria-label={`Переместить медиа ${index + 1} вверх`}
                        disabled={index === 0 || uploadingVideoIndex !== null}
                        onClick={() => setDraft((current) => {
                          const gallery = [...current.gallery];
                          [gallery[index - 1], gallery[index]] = [gallery[index], gallery[index - 1]];
                          return { ...current, gallery };
                        })}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        aria-label={`Удалить медиа ${index + 1}`}
                        disabled={uploadingVideoIndex !== null}
                        onClick={() => setDraft((current) => ({
                          ...current,
                          gallery: current.gallery.filter((_, mediaIndex) => mediaIndex !== index),
                        }))}
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        aria-label={`Переместить медиа ${index + 1} вниз`}
                        disabled={index === draft.gallery.length - 1 || uploadingVideoIndex !== null}
                        onClick={() => setDraft((current) => {
                          const gallery = [...current.gallery];
                          [gallery[index], gallery[index + 1]] = [gallery[index + 1], gallery[index]];
                          return { ...current, gallery };
                        })}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-ghost"
                disabled={draft.gallery.length >= 30 || uploadingVideoIndex !== null}
                onClick={() => setDraft((current) => ({
                  ...current,
                  gallery: [...current.gallery, { type: "image", url: "", alt: "" }],
                }))}
              >
                + Добавить скриншот
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={draft.gallery.length >= 30 || uploadingVideoIndex !== null}
                onClick={() => {
                  const index = draft.gallery.length;
                  setDraft((current) => ({
                    ...current,
                    gallery: [...current.gallery, { type: "video", url: "", alt: "" }],
                  }));
                  videoUploadTarget.current = index;
                  videoFileInput.current?.click();
                }}
              >
                + Добавить видео
              </button>
            </div>
          </fieldset>

          <fieldset className="admin-product-flags">
            <legend>Статус и параметры отображения</legend>
            <div className="admin-product-flags__grid">
              {flagFields.map(({ key, label }) => (
                <label key={key} className="admin-product-flags__option">
                  <input
                    type="checkbox"
                    checked={draft[key] === 1}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      [key]: event.target.checked ? 1 : 0,
                    }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 14 }}>
            <legend>Тарифы и цены *</legend>
            <div style={{ display: "grid", gap: 8 }}>
              {draft.tariffs.map((tariff, index) => (
                <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(100px, 150px) auto", gap: 8 }}>
                  <input className="input" aria-label={`Название тарифа ${index + 1}`} value={tariff.label} onChange={(event) => updateTariff(index, "label", event.target.value)} required />
                  <input className="input" aria-label={`Цена тарифа ${index + 1}`} type="number" min="0.01" step="0.01" value={tariff.price} onChange={(event) => updateTariff(index, "price", event.target.value)} required />
                  <button type="button" className="btn-ghost" disabled={draft.tariffs.length === 1} onClick={() => setDraft({ ...draft, tariffs: draft.tariffs.filter((_, tariffIndex) => tariffIndex !== index) })}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-ghost" style={{ marginTop: 10 }} disabled={draft.tariffs.length >= 20} onClick={() => setDraft({ ...draft, tariffs: [...draft.tariffs, { label: "", price: "" }] })}>
              + Добавить тариф
            </button>
          </fieldset>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn-ghost" disabled={loading || uploadingVideoIndex !== null} onClick={() => setShowModal(false)}>Отмена</button>
            <button type="submit" className="btn-primary" disabled={loading || uploadingVideoIndex !== null || games.length === 0}>
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  ) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 className="page-title">Читы каталога</h1>
        <button className="btn-primary" onClick={openCreate}>+ Добавить чит</button>
      </div>
      <section style={{ padding: 16, marginBottom: 20, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Категории функционала</h2>
        <p className="muted">Создайте категории, например «Аимбот», «Визуалы — игроки» или «Лут и фарм», затем назначьте их читам.</p>
        <form onSubmit={createFeatureCategory} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: "1 1 240px" }}
            maxLength={120}
            value={newFeatureCategory}
            onChange={(event) => setNewFeatureCategory(event.target.value)}
            placeholder="Название новой категории"
            aria-label="Название новой категории функционала"
            required
          />
          <button className="btn-ghost" type="submit" disabled={categorySaving}>
            {categorySaving ? "Добавление..." : "Добавить категорию"}
          </button>
        </form>
        {categoryError && <p role="alert" style={{ color: "#ff8a8a" }}>{categoryError}</p>}
        {featureCategories.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {featureCategories.map((category) => (
              <span key={category.id} className="btn-ghost">{category.title}</span>
            ))}
          </div>
        )}
      </section>
      {listError && <p role="alert" style={{ color: "#ff8a8a", marginBottom: 16 }}>{listError}</p>}
      {!listLoading && items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
            Сортировка
            <select
              className="input"
              value={itemSort}
              onChange={(event) => setItemSort(event.target.value as ItemSort)}
            >
              {itemSortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {listLoading ? (
        <p className="muted">Загрузка читов...</p>
      ) : items.length === 0 ? (
        <p className="muted">Читы не найдены.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {sortedItems.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <strong>{item.name}</strong>
                <div className="muted">{item.game_title || "Игра не указана"} · {item.alias} · {item.vis ? "В каталоге" : "Скрыт"} · {item.status ? "Активен" : "Отключен"}</div>
              </div>
              <div style={{ display: "flex", flex: "0 0 auto", gap: 8 }}>
                <select
                  className="input"
                  aria-label={`Префикс чита ${item.name}`}
                  value={item.security_status}
                  disabled={securityStatusUpdatingId === item.id}
                  onChange={(event) => void updateItemSecurityStatus(item, Number(event.target.value))}
                >
                  <option value={1}>Undetected (UD)</option>
                  <option value={2}>On Update (OU)</option>
                  <option value={3}>Risk</option>
                </select>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={visibilityUpdatingId === item.id}
                  onClick={() => void toggleItemVisibility(item)}
                >
                  {visibilityUpdatingId === item.id
                    ? "Сохранение..."
                    : item.vis === 1
                      ? "Скрыть из каталога"
                      : "Показать в каталоге"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => openEdit(item)}>
                  Изменить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal}
    </div>
  );
}
