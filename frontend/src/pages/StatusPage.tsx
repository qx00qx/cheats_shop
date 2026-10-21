import { useState, useEffect } from "react";
import Seo from "../components/Seo";

type Cheat = {
  id: string;
  alias: string;
  name: string;
  status: 1 | 2 | 3; // 1 = Undetected, 2 = On Update, 3 = Risk
};

type GameSection = {
  id: string;
  name: string;
  cheats: Cheat[];
};

export default function StatusPage() {
  const [filter, setFilter] = useState<"all" | 1 | 2 | 3>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sections, setSections] = useState<GameSection[]>([]);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadStatuses = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await fetch("/api/catalog/statuses");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json() as { games: GameSection[] };
        if (cancelled) return;
        setSections(result.games);
        setOpenSections(new Set(result.games.map((section) => section.id)));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load cheat statuses:", error);
          setLoadError("Не удалось загрузить статусы читов. Попробуйте обновить страницу.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadStatuses();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSection = (sectionId: string) => {
    const newOpen = new Set(openSections);
    if (newOpen.has(sectionId)) {
      newOpen.delete(sectionId);
    } else {
      newOpen.add(sectionId);
    }
    setOpenSections(newOpen);
  };

  const getStatusText = (status: number): string => {
    if (status === 1) return "Undetected";
    if (status === 2) return "On Update";
    if (status === 3) return "Risk";
    return "Unknown";
  };

  const getStatusClass = (status: number): string => {
    return `st-badge-${status}`;
  };

  const filteredSections = sections.map((section) => ({
    ...section,
    cheats: section.cheats.filter((cheat) => {
      const matchesSearch = cheat.name?.toLowerCase().includes((searchTerm || "").toLowerCase()) ?? false;
      const matchesFilter = filter === "all" || cheat.status === filter;
      return matchesSearch && matchesFilter;
    }),
  })).filter((section) => section.cheats.length > 0);

  const totalGames = filteredSections.length;
  const totalCheats = filteredSections.reduce((sum, s) => sum + s.cheats.length, 0);

  return (
    <div className="st-page">
      <Seo title="Статусы программ" noIndex />
      <div className="st-head">
        <div className="st-head-left">
          <h1 className="st-title">Статусы</h1>
          <p className="st-sub">
            {totalGames} {totalGames === 1 ? "игра" : "игр"} · {totalCheats} {totalCheats === 1 ? "чит" : "читов"}
          </p>
        </div>
        <div className="st-controls">
          <button 
            className={`st-filter-btn ${filter === "all" ? "active-all" : ""}`}
            onClick={() => setFilter("all")}
          >
            Все
          </button>
          <button 
            className={`st-filter-btn ${filter === 1 ? "active-1" : ""}`}
            onClick={() => setFilter(1)}
          >
            <span className="st-dot st-dot-1"></span> Undetected
          </button>
          <button 
            className={`st-filter-btn ${filter === 2 ? "active-2" : ""}`}
            onClick={() => setFilter(2)}
          >
            <span className="st-dot st-dot-2"></span> On Update
          </button>
          <button 
            className={`st-filter-btn ${filter === 3 ? "active-3" : ""}`}
            onClick={() => setFilter(3)}
          >
            <span className="st-dot st-dot-3"></span> Risk
          </button>
        </div>
      </div>

      <div className="st-search-wrap">
        <input
          className="st-search"
          type="text"
          placeholder="Поиск по играм и читам..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <svg className="st-search-icon" width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
        </svg>
      </div>

      {loading ? (
        <div className="st-empty" role="status">Загружаем статусы читов…</div>
      ) : loadError ? (
        <div className="st-empty" role="alert">{loadError}</div>
      ) : filteredSections.length === 0 ? (
        <div className="st-empty">
          <p>{sections.length === 0 ? "Пока нет опубликованных статусов читов." : "Ничего не найдено"}</p>
        </div>
      ) : (
        filteredSections.map((section) => {
          const statusCounts = section.cheats.reduce((acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
          }, {} as Record<number, number>);

          return (
            <div key={section.id} className={`st-section ${openSections.has(section.id) ? "open" : ""}`}>
              <div 
                className="st-section-header"
                onClick={() => toggleSection(section.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleSection(section.id);
                  }
                }}
              >
                <div className="st-section-img-placeholder">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </div>
                <span className="st-section-name">{section.name}</span>
                <span className="st-section-count">{section.cheats.length} читов</span>
                <div className="st-section-badges">
                  {statusCounts[1] && (
                    <span className="st-mini-badge st-mini-badge-1">{statusCounts[1]}</span>
                  )}
                  {statusCounts[2] && (
                    <span className="st-mini-badge st-mini-badge-2">{statusCounts[2]}</span>
                  )}
                  {statusCounts[3] && (
                    <span className="st-mini-badge st-mini-badge-3">{statusCounts[3]}</span>
                  )}
                </div>
                <svg className="st-section-chevron" width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 9l6 6 6-6"/>
                </svg>
              </div>
              <div className="st-cheats">
                {section.cheats.map(cheat => (
                  <div key={cheat.id} className="st-cheat-row">
                    <span className="st-cheat-name">{cheat.name}</span>
                    <span className={`st-badge ${getStatusClass(cheat.status)}`}>
                      {getStatusText(cheat.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
