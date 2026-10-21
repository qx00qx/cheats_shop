import { FormEvent, MouseEvent, ReactNode, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { sanitizeBlogHtml } from "../utils/blogHtml";
import "../static/styles/admin/admin-articles.css";

type AdminArticle = {
  id: number;
  alias: string;
  name: string;
  text: string;
  vis: number;
  date: string | null;
};

type HtmlEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

type EditorFormat = "bold" | "italic" | "h2" | "h3" | "unorderedList" | "orderedList";

const EMPTY_FORMATS: Record<EditorFormat, boolean> = {
  bold: false,
  italic: false,
  h2: false,
  h3: false,
  unorderedList: false,
  orderedList: false,
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

function HtmlEditor({ value, onChange }: HtmlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [activeFormats, setActiveFormats] = useState(EMPTY_FORMATS);

  useEffect(() => {
    if (!sourceMode && editorRef.current) {
      editorRef.current.innerHTML = sanitizeBlogHtml(value);
    }
  }, [sourceMode]);

  const saveSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (editor && range && editor.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
      updateActiveFormats();
    }
  };

  const getCurrentFormats = (): Record<EditorFormat, boolean> => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
    const element = node instanceof Element ? node : node?.parentElement;
    if (!editor || !element || !editor.contains(element)) {
      return EMPTY_FORMATS;
    }

    const block = element.closest("h2, h3, p, div, li");
    return {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      h2: block?.tagName === "H2",
      h3: block?.tagName === "H3",
      unorderedList: Boolean(element.closest("ul")),
      orderedList: Boolean(element.closest("ol")),
    };
  };

  const updateActiveFormats = () => {
    setActiveFormats(getCurrentFormats());
  };

  const restoreSelection = () => {
    const range = savedSelectionRef.current;
    const editor = editorRef.current;
    if (!range || !editor || !editor.contains(range.commonAncestorContainer)) return;

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const runCommand = (
    event: MouseEvent<HTMLButtonElement>,
    command: string,
    commandValue?: string,
    format?: EditorFormat,
  ) => {
    saveSelection();
    event.preventDefault();
    restoreSelection();
    const shouldToggleOff = Boolean(format && getCurrentFormats()[format]);
    if (shouldToggleOff && (format === "h2" || format === "h3")) {
      document.execCommand("formatBlock", false, "p");
    } else {
      document.execCommand(command, false, shouldToggleOff ? undefined : commandValue);
    }
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      saveSelection();
      updateActiveFormats();
    }
  };

  const addLink = (event: MouseEvent<HTMLButtonElement>) => {
    saveSelection();
    event.preventDefault();
    const url = window.prompt("Введите адрес ссылки");
    if (url) runCommand(event, "createLink", url);
  };

  const initializeEmptyEditor = () => {
    const editor = editorRef.current;
    if (!editor || editor.textContent?.trim() || editor.querySelector("br, img, video")) return;

    editor.innerHTML = "<p><br></p>";
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  useEffect(() => {
    const handleSelectionChange = () => updateActiveFormats();
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const toolbarButton = (
    format: EditorFormat,
    label: string,
    command: string,
    commandValue?: string,
    content?: ReactNode,
  ) => (
    <button
      type="button"
      className={activeFormats[format] ? "is-active" : ""}
      aria-label={label}
      aria-pressed={activeFormats[format]}
      title={label}
      onMouseDown={(event) => runCommand(event, command, commandValue, format)}
    >
      {content}
    </button>
  );

  return (
    <div className="admin-article-editor">
      <div className="admin-article-editor__toolbar" aria-label="Инструменты форматирования">
        {!sourceMode && (
          <>
            {toolbarButton("bold", "Жирный текст", "bold", undefined, <strong>B</strong>)}
            {toolbarButton("italic", "Курсив", "italic", undefined, <em>I</em>)}
            {toolbarButton("h2", "Заголовок H2", "formatBlock", "h2", "H2")}
            {toolbarButton("h3", "Подзаголовок H3", "formatBlock", "h3", "H3")}
            {toolbarButton("unorderedList", "Маркированный список", "insertUnorderedList", undefined, "• Список")}
            {toolbarButton("orderedList", "Нумерованный список", "insertOrderedList", undefined, "1. Список")}
            <button type="button" onMouseDown={addLink} aria-label="Добавить ссылку" title="Добавить ссылку">Ссылка</button>
          </>
        )}
        <button
          type="button"
          className="admin-article-editor__source-toggle"
          onClick={() => setSourceMode((current) => !current)}
        >
          {sourceMode ? "Визуальный редактор" : "HTML"}
        </button>
      </div>
      {sourceMode ? (
        <textarea
          className="admin-article-editor__source"
          aria-label="HTML-код статьи"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
        />
      ) : (
        <div
          ref={editorRef}
          className="admin-article-editor__canvas"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Текст статьи"
          aria-multiline="true"
          data-placeholder="Нажмите сюда и начните писать текст статьи..."
          onFocus={initializeEmptyEditor}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onInput={(event) => {
            onChange(event.currentTarget.innerHTML);
            saveSelection();
          }}
        />
      )}
    </div>
  );
}

export default function AdminArticles() {
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibilityUpdatingId, setVisibilityUpdatingId] = useState<number | null>(null);
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const loadArticles = async () => {
    setLoading(true);
    setListError("");
    try {
      const response = await api.get<AdminArticle[]>("/blog/admin/articles");
      setArticles(response.data);
    } catch (error) {
      console.error("Failed to load admin blog articles:", error);
      setListError("Не удалось загрузить статьи. Попробуйте обновить страницу.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadArticles();
  }, []);

  const resetEditor = () => {
    setEditorVersion((version) => version + 1);
    setEditingId(null);
    setTitle("");
    setContent("");
    setFormError("");
  };

  const editArticle = (article: AdminArticle) => {
    setEditorVersion((version) => version + 1);
    setEditingId(article.id);
    setTitle(article.name);
    setContent(article.text);
    setFormError("");
  };

  const toggleArticleVisibility = async (article: AdminArticle) => {
    setVisibilityUpdatingId(article.id);
    setListError("");
    try {
      const nextVisibility = article.vis === 1 ? 0 : 1;
      const response = await api.put<AdminArticle>(
        `/blog/admin/articles/${article.id}`,
        {
          name: article.name,
          text: article.text,
          vis: nextVisibility,
        },
      );
      if (response.data.vis !== nextVisibility) {
        throw new Error("Сервер не обновил публикацию статьи. Обновите backend и попробуйте снова.");
      }
      setArticles((current) =>
        current.map((entry) =>
          entry.id === article.id ? { ...entry, vis: response.data.vis } : entry,
        ),
      );
    } catch (error) {
      console.error("Failed to update blog article visibility:", error);
      setListError(getErrorMessage(error));
    } finally {
      setVisibilityUpdatingId(null);
    }
  };

  const saveArticle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = { name: title, text: sanitizeBlogHtml(content) };
      if (editingId === null) {
        await api.post("/blog/admin/articles", payload);
      } else {
        await api.put(`/blog/admin/articles/${editingId}`, payload);
      }
      resetEditor();
      await loadArticles();
    } catch (error) {
      console.error("Failed to save blog article:", error);
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-articles">
      <header className="admin-articles__header">
        <div>
          <h1 className="page-title">Статьи</h1>
          <p className="muted">Создавайте и редактируйте публикации блога.</p>
        </div>
        {editingId !== null && (
          <button type="button" className="btn-ghost" onClick={resetEditor}>
            Новая статья
          </button>
        )}
      </header>

      <form className="admin-articles__form" onSubmit={saveArticle}>
        <h2>{editingId === null ? "Новая статья" : `Редактирование статьи #${editingId}`}</h2>
        {formError && <p className="admin-articles__error" role="alert">{formError}</p>}
        <label>
          <span>Название статьи</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={255}
            required
          />
        </label>
        <div className="admin-articles__editor-field">
          <span>Текст статьи</span>
          <HtmlEditor key={`${editingId ?? "new"}-${editorVersion}`} value={content} onChange={setContent} />
          <small className="muted">Нажмите в область редактора, чтобы начать писать. Выделите текст, чтобы применить форматирование.</small>
        </div>
        <div className="admin-articles__actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !title.trim() || !content.trim()}
          >
            {saving ? "Сохранение..." : editingId === null ? "Опубликовать статью" : "Сохранить изменения"}
          </button>
        </div>
      </form>

      <section className="admin-articles__list" aria-labelledby="admin-articles-list-title">
        <h2 id="admin-articles-list-title">Опубликованные и скрытые статьи</h2>
        {listError ? (
          <p className="admin-articles__error" role="alert">{listError}</p>
        ) : loading ? (
          <p className="muted" role="status">Загрузка статей...</p>
        ) : articles.length === 0 ? (
          <p className="muted">Статей пока нет.</p>
        ) : (
          articles.map((article) => (
            <article className="admin-articles__item" key={article.id}>
              <div>
                <h3>{article.name}</h3>
                <p className="muted">
                  /blog/{article.alias} · {article.vis === 1 ? "Опубликована" : "Скрыта"}
                  {article.date ? ` · ${article.date}` : ""}
                </p>
              </div>
              <div className="admin-articles__item-actions">
                <button type="button" className="btn-ghost" onClick={() => editArticle(article)}>
                  Редактировать
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={visibilityUpdatingId === article.id}
                  onClick={() => void toggleArticleVisibility(article)}
                >
                  {visibilityUpdatingId === article.id
                    ? "Сохранение..."
                    : article.vis === 1
                      ? "Скрыть статью"
                      : "Опубликовать"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
