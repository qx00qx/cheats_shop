import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import {
  cacheSeoPage,
  cacheSeoSettings,
  DEFAULT_SEO_SETTINGS,
  type SeoPageSettings,
  type SeoSettings,
} from "../utils/seoSettings";

const fieldStyle = {
  display: "grid",
  gap: 6,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "10px 12px",
  color: "#fff",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
};

function getErrorMessage(error: unknown): string {
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
  return error instanceof Error ? error.message : "Не удалось выполнить запрос.";
}

export default function AdminSeo() {
  const [settings, setSettings] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  const [pages, setPages] = useState<SeoPageSettings[]>([]);
  const [selectedPageKey, setSelectedPageKey] = useState("home");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesLoaded, setPagesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageSaving, setPageSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");

  useEffect(() => {
    api.get<SeoSettings>("/admin/seo/settings")
      .then(({ data }) => {
        setSettings(data);
        setLoaded(true);
      })
      .catch((loadError: unknown) => {
        console.error("Failed to load SEO settings:", loadError);
        setError("Не удалось загрузить SEO-настройки.");
      })
      .finally(() => setLoading(false));
    api.get<SeoPageSettings[]>("/admin/seo/pages")
      .then(({ data }) => {
        setPages(data);
        setPagesLoaded(true);
      })
      .catch((loadError: unknown) => {
        console.error("Failed to load per-page SEO settings:", loadError);
        setPageError("Не удалось загрузить список SEO-страниц.");
      })
      .finally(() => setPagesLoading(false));
  }, []);

  const updateField = (field: keyof SeoSettings, value: string) => {
    setSettings((current) => ({ ...current, [field]: value }));
    setSuccess("");
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.put<SeoSettings>("/admin/seo/settings", settings);
      setSettings(data);
      cacheSeoSettings(data);
      setSuccess("SEO-настройки сохранены.");
    } catch (saveError) {
      console.error("Failed to save SEO settings:", saveError);
      setError(
        getErrorMessage(saveError),
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedPage = pages.find((page) => page.key === selectedPageKey);

  const updatePage = (field: keyof SeoPageSettings, value: string | boolean) => {
    setPages((current) => current.map((page) =>
      page.key === selectedPageKey ? { ...page, [field]: value } : page,
    ));
    setPageSuccess("");
  };

  const savePage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPage) return;
    setPageSaving(true);
    setPageError("");
    setPageSuccess("");
    try {
      const { data } = await api.put<SeoPageSettings>(
        `/admin/seo/pages/${encodeURIComponent(selectedPage.key)}`,
        {
          title: selectedPage.title,
          description: selectedPage.description,
          image: selectedPage.image,
          noindex: selectedPage.noindex,
        },
      );
      setPages((current) => current.map((page) =>
        page.key === data.key ? data : page,
      ));
      cacheSeoPage(data);
      setPageSuccess(`Настройки страницы «${data.label}» сохранены.`);
    } catch (saveError) {
      console.error("Failed to save per-page SEO settings:", saveError);
      setPageError(getErrorMessage(saveError));
    } finally {
      setPageSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">SEO-настройки</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Для каждой публичной страницы можно задать собственные метаданные.
        Пустые поля сохраняют значения по умолчанию страницы.
      </p>
      {error && <p role="alert" style={{ color: "#ff8a8a" }}>{error}</p>}
      {success && <p role="status" style={{ color: "#00ffa3" }}>{success}</p>}
      <form
        onSubmit={saveSettings}
        style={{
          display: "grid",
          gap: 16,
          maxWidth: 760,
          padding: 18,
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
        }}
      >
        <label style={fieldStyle}>
          <span>Название сайта</span>
          <input
            required
            maxLength={100}
            style={inputStyle}
            value={settings.site_name}
            onChange={(event) => updateField("site_name", event.target.value)}
          />
          <small className="muted">Добавляется в конец заголовка каждой страницы.</small>
        </label>
        <label style={fieldStyle}>
          <span>Описание по умолчанию</span>
          <textarea
            required
            maxLength={500}
            rows={3}
            style={inputStyle}
            value={settings.default_description}
            onChange={(event) => updateField("default_description", event.target.value)}
          />
          <small className="muted">Применяется на страницах без собственного описания.</small>
        </label>
        <label style={fieldStyle}>
          <span>Изображение для превью ссылок</span>
          <input
            maxLength={2000}
            style={inputStyle}
            placeholder="https://... или /uploads/seo-preview.jpg"
            value={settings.default_image}
            onChange={(event) => updateField("default_image", event.target.value)}
          />
          <small className="muted">Допускается ссылка HTTP(S) или путь к изображению на сайте.</small>
        </label>
        <div>
          <button className="btn-primary" type="submit" disabled={saving || loading || !loaded}>
            {saving ? "Сохранение..." : "Сохранить настройки"}
          </button>
        </div>
      </form>

      <section style={{ maxWidth: 760, marginTop: 32 }}>
        <h2>SEO для страниц</h2>
        <p className="muted">
          Игры, товары и статьи редактируются в соответствующих разделах. Для
          личных, платёжных и административных страниц noindex задан принудительно.
        </p>
        {pageError && <p role="alert" style={{ color: "#ff8a8a" }}>{pageError}</p>}
        {pageSuccess && <p role="status" style={{ color: "#00ffa3" }}>{pageSuccess}</p>}
        {pagesLoading ? (
          <p className="muted" role="status">Загрузка страниц...</p>
        ) : selectedPage ? (
          <form
            onSubmit={savePage}
            style={{
              display: "grid",
              gap: 16,
              padding: 18,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
            }}
          >
            <label style={fieldStyle}>
              <span>Страница</span>
              <select
                className="input"
                value={selectedPageKey}
                onChange={(event) => {
                  setSelectedPageKey(event.target.value);
                  setPageSuccess("");
                  setPageError("");
                }}
              >
                {pages.map((page) => (
                  <option key={page.key} value={page.key}>
                    {page.label} ({page.path})
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>SEO title</span>
              <input
                maxLength={255}
                style={inputStyle}
                value={selectedPage.title}
                onChange={(event) => updatePage("title", event.target.value)}
                placeholder="Пусто — использовать заголовок страницы"
              />
            </label>
            <label style={fieldStyle}>
              <span>SEO description</span>
              <textarea
                maxLength={500}
                rows={3}
                style={inputStyle}
                value={selectedPage.description}
                onChange={(event) => updatePage("description", event.target.value)}
                placeholder="Пусто — использовать описание страницы"
              />
            </label>
            <label style={fieldStyle}>
              <span>Изображение Open Graph / Twitter</span>
              <input
                maxLength={2000}
                style={inputStyle}
                value={selectedPage.image}
                onChange={(event) => updatePage("image", event.target.value)}
                placeholder="https://... или /uploads/seo-preview.jpg"
              />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={selectedPage.noindex}
                onChange={(event) => updatePage("noindex", event.target.checked)}
              />
              Исключить страницу из поисковой индексации (noindex)
            </label>
            <small className="muted">
              Canonical URL формируется автоматически по адресу страницы. Для
              приватных разделов настройка индексации недоступна.
            </small>
            <div>
              <button
                className="btn-primary"
                type="submit"
                disabled={pageSaving || !pagesLoaded}
              >
                {pageSaving ? "Сохранение..." : "Сохранить SEO страницы"}
              </button>
            </div>
          </form>
        ) : (
          <p className="muted">Список SEO-страниц недоступен.</p>
        )}
      </section>
    </div>
  );
}
