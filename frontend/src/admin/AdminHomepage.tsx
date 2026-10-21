import { ChangeEvent, useEffect, useState } from "react";
import { api } from "../api/client";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type HomepageSettings = {
  background_url: string | null;
};

export default function AdminHomepage() {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<HomepageSettings>("/homepage/telegram-card");
      setBackgroundUrl(response.data.background_url);
    } catch (loadError) {
      console.error("Failed to load homepage settings:", loadError);
      setError("Не удалось загрузить настройки изображения главной страницы.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setError("");
    setSuccess("");
    if (!selected) {
      setFile(null);
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
      setFile(null);
      setError("Выберите изображение PNG, JPEG или WebP.");
      event.target.value = "";
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      setFile(null);
      setError("Размер изображения не должен превышать 5 МБ.");
      event.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await api.put<HomepageSettings>(
        "/admin/homepage/telegram-card",
        formData,
      );
      setBackgroundUrl(response.data.background_url);
      setFile(null);
      setSuccess("Фон карточки успешно обновлён.");
    } catch (uploadError) {
      console.error("Failed to upload homepage background:", uploadError);
      setError(
        "Не удалось загрузить изображение. Проверьте права администратора и попробуйте ещё раз.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-homepage">
      <h1 className="page-title">Главная страница</h1>
      <p className="muted">
        Здесь можно заменить фоновое изображение карточки Telegram-канала.
        Поддерживаются PNG, JPEG и WebP размером до 5 МБ.
      </p>

      <section className="admin-homepage__card">
        <h2>Фон карточки Telegram</h2>
        <div className="admin-homepage__preview">
          {loading ? (
            <span>Загрузка изображения...</span>
          ) : backgroundUrl ? (
            <img src={backgroundUrl} alt="Текущий фон карточки Telegram" />
          ) : (
            <span>Используется стандартный фон сайта</span>
          )}
        </div>

        <label className="admin-homepage__file">
          <span>Новое изображение</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            disabled={saving}
          />
        </label>
        {file && <p className="muted">{file.name}</p>}

        {error && <p className="admin-homepage__message" role="alert">{error}</p>}
        {success && <p className="admin-homepage__success" role="status">{success}</p>}

        <button
          className="btn-ghost"
          type="button"
          disabled={!file || saving}
          onClick={() => void handleUpload()}
        >
          {saving ? "Загрузка..." : "Сохранить изображение"}
        </button>
      </section>
    </div>
  );
}
