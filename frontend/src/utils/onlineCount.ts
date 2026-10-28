const HOURLY_ONLINE = [
  17, 11, 8, 6, 5, 6, 9, 14, 19, 24, 27, 30,
  32, 33, 34, 35, 37, 39, 42, 46, 48, 47, 39, 27,
];

const JITTER_SLOT_MS = 8000;

function hash(value: number): number {
  let state = (value ^ 0x9e3779b9) >>> 0;
  state = Math.imul(state ^ (state >>> 16), 2246822507) >>> 0;
  state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
  return (state ^ (state >>> 16)) >>> 0;
}

export function getOnlineCount(now: number = Date.now()): number {
  const date = new Date(now);
  const hour = date.getHours();
  const progress = (date.getMinutes() * 60 + date.getSeconds()) / 3600;

  const current = HOURLY_ONLINE[hour];
  const next = HOURLY_ONLINE[(hour + 1) % 24];
  const base = current + (next - current) * progress;

  const slot = Math.floor(now / JITTER_SLOT_MS);
  const jitter = (hash(slot) / 0xffffffff - 0.5) * 0.05;

  return Math.max(4, Math.round(base * (1 + jitter)));
}
