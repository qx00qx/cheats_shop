const gameImageModules = import.meta.glob<string>(
  "../static/img/games/*.{jpg,jpeg,png,webp}",
  { eager: true, import: "default", query: "?url" }
);

const imageAliases: Record<string, string> = {
  apexlegends: "apex",
  warface: "face",
  warthunder: "war",
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getGameImage(slug?: string | null, title?: string | null): string | undefined {
  const keys = [slug, title]
    .filter((value): value is string => Boolean(value))
    .map(normalize)
    .map((key) => imageAliases[key] || key);

  const entry = Object.entries(gameImageModules).find(([path]) => {
    const filename = path.split("/").pop() || "";
    const fileKey = normalize(filename.replace(/\.[^.]+$/, ""));
    return keys.includes(fileKey);
  });

  return entry?.[1];
}

export function formatDuration(value: string): string {
  const match = value.trim().match(/^(\d+)\s*(?:days?|дн(?:я|ей|ь)?)$/i);
  if (!match) return value;

  const count = Number(match[1]);
  const lastTwo = count % 100;
  const lastOne = count % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14
    ? "дней"
    : lastOne === 1
      ? "день"
      : lastOne >= 2 && lastOne <= 4
        ? "дня"
        : "дней";

  return `${count} ${noun}`;
}

export function parseDurationList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string").map(formatDuration)
      : [];
  } catch {
    return [];
  }
}
