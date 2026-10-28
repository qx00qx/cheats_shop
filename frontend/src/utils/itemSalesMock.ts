export type MockItemSale = {
  email: string;
  created_at: string;
};

export type MockItemSales = {
  purchase_count: number;
  sales: MockItemSale[];
};

const DAILY_SALES_FLOOR = 50;
const DAILY_SALES_CEILING = 70;
const SALES_CATALOG_SIZE = 14;
const BACKLOG_DAYS = 14;
const HOUR_WEIGHTS = [3, 1, 4, 10, 13, 16, 22, 15];
const HOUR_WEIGHT_TOTAL = HOUR_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
const VISITOR_SEED_KEY = "millex_sales_visitor_seed";

type SalesTimeline = {
  todayStamps: number[];
  backlogStamps: number[];
  emails: string[];
  baselineCount: number;
};

const timelineByKey = new Map<string, SalesTimeline>();
let visitorSeed: { seed: number; dayKey: string } | null = null;

function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Seed is per visitor per local day: same story until midnight, new one after.
function getVisitorSeed(dayKey: string): number {
  if (visitorSeed?.dayKey === dayKey) return visitorSeed.seed;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(VISITOR_SEED_KEY) ?? "null");
    if (parsed?.dayKey === dayKey && typeof parsed.seed === "number") {
      visitorSeed = { seed: parsed.seed >>> 0, dayKey };
      return visitorSeed.seed;
    }
  } catch {
    visitorSeed = null;
  }

  visitorSeed = {
    seed: (Math.floor(Math.random() * 0xffffffff) ^ hashString(dayKey)) >>> 0,
    dayKey,
  };
  try {
    window.localStorage.setItem(VISITOR_SEED_KEY, JSON.stringify(visitorSeed));
  } catch {
    // Storage blocked: the seed lives in memory for this tab.
  }
  return visitorSeed.seed;
}

function buildStamps(dayStart: number, count: number, random: () => number): number[] {
  return Array.from({ length: count }, () => {
    let threshold = random() * HOUR_WEIGHT_TOTAL;
    let bucket = HOUR_WEIGHTS.length - 1;
    for (let index = 0; index < HOUR_WEIGHTS.length; index += 1) {
      threshold -= HOUR_WEIGHTS[index];
      if (threshold <= 0) {
        bucket = index;
        break;
      }
    }
    return dayStart + (bucket * 3 * 3600 + Math.floor(random() * 3 * 3600)) * 1000;
  });
}

function buildTimeline(alias: string, seed: number, dayKey: string): SalesTimeline {
  const popularityRandom = createRandom(hashString(`popularity:${alias}`));
  const popularity = 0.5 + popularityRandom();
  const dailyRandom = createRandom(seed ^ hashString(`daily:${dayKey}`));
  const dailyTarget =
    DAILY_SALES_FLOOR +
    Math.floor(dailyRandom() * (DAILY_SALES_CEILING - DAILY_SALES_FLOOR + 1));

  const random = createRandom(hashString(alias) ^ seed ^ hashString(`day:${dayKey}`));
  const todayCount = Math.max(1, Math.round((dailyTarget * popularity) / SALES_CATALOG_SIZE));
  const dayStart = new Date(`${dayKey}T00:00:00`).getTime();

  const backlogStamps: number[] = [];
  for (let daysAgo = 1; daysAgo <= BACKLOG_DAYS; daysAgo += 1) {
    const count = Math.max(1, Math.round(todayCount * (0.7 + random() * 0.6)));
    backlogStamps.push(...buildStamps(dayStart - daysAgo * 86400000, count, random));
  }

  const domains = ["mail.ru", "gmail.com", "yandex.ru", "inbox.ru", "bk.ru", "list.ru"];
  const emails = Array.from({ length: todayCount + backlogStamps.length }, () => {
    const length = 5 + Math.floor(random() * 7);
    const local = Array.from({ length }, () =>
      String.fromCharCode(97 + Math.floor(random() * 26)),
    ).join("");
    const domain = domains[Math.floor(random() * domains.length)];
    return `${local.slice(0, 2)}${"*".repeat(length - 2)}@${domain}`;
  });

  return {
    todayStamps: buildStamps(dayStart, todayCount, random).sort((a, b) => b - a),
    backlogStamps: backlogStamps.sort((a, b) => b - a).slice(0, 44),
    emails,
    baselineCount: 200 + Math.floor(popularityRandom() * 2500 * popularity),
  };
}

export function getMockItemSales(alias: string, salesLimit?: number): MockItemSales {
  const now = Date.now();
  const dayKey = new Date(now).toLocaleDateString("sv-SE");
  const seed = getVisitorSeed(dayKey);
  const key = `${dayKey}|${seed}|${alias}`;

  let timeline = timelineByKey.get(key);
  if (!timeline) {
    timeline = buildTimeline(alias, seed, dayKey);
    timelineByKey.set(key, timeline);
  }

  const revealedToday = timeline.todayStamps.filter((stamp) => stamp <= now);
  const stamps = [...revealedToday, ...timeline.backlogStamps];
  const limit = salesLimit ?? Math.min(stamps.length, 5 + (hashString(alias) % 6));

  return {
    purchase_count: timeline.baselineCount + revealedToday.length,
    sales: stamps.slice(0, limit).map((stamp, index) => ({
      email: timeline.emails[index % timeline.emails.length],
      created_at: new Date(stamp).toISOString(),
    })),
  };
}
