import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type Game = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
};

type GameDraft = {
  title: string;
  slug: string;
  cover_url: string;
  sort_order: number;
  is_active: boolean;
};

const emptyDraft = (): GameDraft => ({
  title: "",
  slug: "",
  cover_url: "",
  sort_order: 999,
  is_active: true,
});

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "10px 12px",
  color: "#fff",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
};

export default function AdminGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [draft, setDraft] = useState<GameDraft>(emptyDraft);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [imageSuccess, setImageSuccess] = useState("");
  const [listError, setListError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadGames = async () => {
    setLoading(true);
    setListError("");
    try {
      const response = await api.get<Game[]>("/catalog/admin/games");
      setGames(response.data);
    } catch (loadError) {
      console.error("Failed to load admin games:", loadError);
      setListError("Не удалось загрузить игры. Проверьте права доступа и попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGames();
  }, []);

  const updateDraft = <K extends keyof GameDraft>(key: K, value: GameDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === "cover_url") {
      setImageFile(null);
      setImageSuccess("");
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setError("");
    setImageSuccess("");
    if (!selected) {
      setImageFile(null);
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
      setImageFile(null);
      setError("Выберите изображение PNG, JPEG или WebP.");
      event.target.value = "";
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      setImageFile(null);
      setError("Размер изображения не должен превышать 5 МБ.");
      event.target.value = "";
      return;
    }
    setImageFile(selected);
  };

  const uploadImage = async () => {
    if (!imageFile) return;
    setUploadingImage(true);
    setError("");
    setImageSuccess("");
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      const response = await api.post<{ url: string }>(
        "/admin/uploads/images/game-covers",
        formData,
      );
      setDraft((current) => ({ ...current, cover_url: response.data.url }));
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setImageSuccess("Обложка загружена. Нажмите «Сохранить», чтобы применить её к игре.");
    } catch (uploadError) {
      console.error("Failed to upload game cover:", uploadError);
      setError("Не удалось загрузить изображение. Проверьте права администратора и попробуйте ещё раз.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (imageFile) {
      setError("Сначала загрузите выбранное изображение или отмените его выбор.");
      return;
    }
    setSaving(true);
    setError("");
    setImageSuccess("");
    try {
      if (editingId === null) {
        await api.post("/catalog/admin/games", draft);
      } else {
        await api.put(`/catalog/admin/games/${editingId}`, draft);
      }
      setDraft(emptyDraft());
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setEditingId(null);
      await loadGames();
    } catch (saveError) {
      console.error("Failed to save admin game:", saveError);
      setError("Не удалось сохранить игру. Проверьте уникальность URL и повторите попытку.");
    } finally {
      setSaving(false);
    }
  };

  const editGame = (game: Game) => {
    setEditingId(game.id);
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setImageSuccess("");
    setDraft({
      title: game.title,
      slug: game.slug,
      cover_url: game.cover_url || "",
      sort_order: game.sort_order,
      is_active: game.is_active,
    });
    setError("");
  };

  const toggleGame = async (game: Game) => {
    setError("");
    try {
      await api.put(`/catalog/admin/games/${game.id}`, {
        title: game.title,
        slug: game.slug,
        cover_url: game.cover_url || "",
        sort_order: game.sort_order,
        is_active: !game.is_active,
      });
      await loadGames();
    } catch (toggleError) {
      console.error("Failed to change game visibility:", toggleError);
      setError("Не удалось изменить видимость игры.");
    }
  };

  return (
    <div>
      <h1 className="page-title">Игры</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Управление корневыми категориями каталога. Скрытие игры не удаляет её товары.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          alignItems: "end",
          padding: 16,
          marginBottom: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
        }}
      >
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>Название</span>
          <input
            required
            maxLength={255}
            value={draft.title}
            onChange={(event) => updateDraft("title", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>URL (slug)</span>
          <input
            required
            maxLength={255}
            pattern="[a-z0-9_-]+"
            value={draft.slug}
            onChange={(event) => updateDraft("slug", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>Ссылка на изображение</span>
          <input
            maxLength={2000}
            value={draft.cover_url}
            onChange={(event) => updateDraft("cover_url", event.target.value)}
            style={inputStyle}
          />
        </label>
        <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }}>
          <label>
            <span style={{ display: "block", marginBottom: 6 }}>Загрузить обложку</span>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
              disabled={saving || uploadingImage}
            />
          </label>
          {imageFile && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="muted">{imageFile.name}</span>
              <button
                className="btn-ghost"
                type="button"
                disabled={uploadingImage || saving}
                onClick={() => void uploadImage()}
              >
                {uploadingImage ? "Загрузка..." : "Загрузить"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                disabled={uploadingImage || saving}
                onClick={() => {
                  setImageFile(null);
                  if (imageInputRef.current) imageInputRef.current.value = "";
                }}
              >
                Отмена
              </button>
            </div>
          )}
          {imageSuccess && <p role="status" className="muted" style={{ margin: 0 }}>{imageSuccess}</p>}
          {draft.cover_url && (
            <img
              src={draft.cover_url}
              alt="Предпросмотр обложки игры"
              style={{ width: 180, maxHeight: 110, objectFit: "cover", borderRadius: 8 }}
            />
          )}
        </div>
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>Порядок</span>
          <input
            type="number"
            min={0}
            value={draft.sort_order}
            onChange={(event) => updateDraft("sort_order", Number(event.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 40 }}>
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(event) => updateDraft("is_active", event.target.checked)}
          />
          Показывать в каталоге
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" type="submit" disabled={saving || uploadingImage || imageFile !== null}>
            {saving ? "Сохранение..." : editingId === null ? "Добавить игру" : "Сохранить"}
          </button>
          {editingId !== null && (
            <button
              className="btn-ghost"
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(emptyDraft());
                setImageFile(null);
                if (imageInputRef.current) imageInputRef.current.value = "";
                setImageSuccess("");
                setEditingId(null);
                setError("");
              }}
            >
              Отмена
            </button>
          )}
        </div>
      </form>

      {error && <p role="alert" style={{ color: "#ff8a8a" }}>{error}</p>}
      {listError && <p role="alert" style={{ color: "#ff8a8a" }}>{listError}</p>}

      <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["Игра", "Обложка", "URL", "Товаров", "Порядок", "Статус", "Действия"].map((heading) => (
                <th key={heading} style={{ padding: "12px 16px", color: "rgba(255,255,255,0.7)" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center" }}>Загрузка...</td></tr>
            ) : games.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center" }}>Игры не найдены</td></tr>
            ) : games.map((game) => (
              <tr key={game.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: "12px 16px" }}>{game.title}</td>
                <td style={{ padding: "8px 16px" }}>
                  {game.cover_url ? (
                    <img
                      src={game.cover_url}
                      alt={`Обложка ${game.title}`}
                      style={{ display: "block", width: 72, height: 44, objectFit: "cover", borderRadius: 6 }}
                    />
                  ) : (
                    <span className="muted">Нет обложки</span>
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}>{game.slug}</td>
                <td style={{ padding: "12px 16px" }}>{game.product_count ?? "—"}</td>
                <td style={{ padding: "12px 16px" }}>{game.sort_order}</td>
                <td style={{ padding: "12px 16px" }}>{game.is_active ? "Активна" : "Скрыта"}</td>
                <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                  <button className="btn-ghost" type="button" onClick={() => editGame(game)}>
                    Изменить
                  </button>{" "}
                  <button className="btn-ghost" type="button" onClick={() => void toggleGame(game)}>
                    {game.is_active ? "Скрыть" : "Показать"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
