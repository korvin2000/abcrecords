import { COUNTER } from "@/config";
import { resolveSitePath } from "@/lib/paths";
import type { Pulse, Slice, Stats, Tally } from "./types";

/**
 * The one conversation the app has with `server/counter.php`.
 *
 * Two calls, and the whole design is in how few they are: `recordVisit()` once
 * per page load, `loadStats()` once per reader who actually opens the panel.
 * There is no polling — a counter that costs a request a minute per open tab is
 * a counter that costs more than it reports.
 *
 * Every number that arrives is coerced here rather than trusted. The endpoint
 * is ours, but it is also a file on a shared host that someone may hand-edit,
 * and one `undefined` reaching the odometer would render `NaN` on six drums.
 */

/** The endpoint resolves against the **site root** — see `resolveSitePath`. */
function endpoint(params: Record<string, string>): string {
  const url = new URL(resolveSitePath(COUNTER.endpoint), window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Record this page view and return the tally including it.
 *
 * `COUNTER.record` decides whether the visit is *recorded* or merely read, so
 * a development session reads the live figures without adding to them.
 */
export async function recordVisit(lang: string, slug: string | null): Promise<Pulse> {
  const raw = await request({
    a: COUNTER.record ? "hit" : "pulse",
    l: lang,
    p: slug ?? "",
    // The browser's own `Referer` on a same-origin request is this page, so
    // where the reader came from has to be told, not asked. Only the host —
    // a full referring URL is somebody else's business.
    r: referrerHost(),
  });
  return toPulse(raw);
}

/** The full statistics document. Only ever called for a reader who asks. */
export async function loadStats(lang: string): Promise<Stats> {
  return toStats(await request({ a: "stats", l: lang }));
}

/* ------------------------------------------------------------------ fetch */

async function request(params: Record<string, string>): Promise<Record<string, unknown>> {
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), COUNTER.timeoutMs);

  try {
    const response = await fetch(endpoint(params), {
      signal: abort.signal,
      // The endpoint is same-origin in production and proxied to the live host
      // in development (vite/legacy-archive.ts), so no credentials are needed
      // and none are sent — this feature sets no cookie of any kind.
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`counter: HTTP ${response.status}`);

    const body: unknown = await response.json();
    if (!body || typeof body !== "object") throw new Error("counter: not an object");
    const row = body as Record<string, unknown>;
    if (row.ok === false) throw new Error(`counter: ${String(row.error ?? "refused")}`);
    return row;
  } finally {
    window.clearTimeout(timer);
  }
}

/** The host the reader arrived from, or "" for a direct visit or same site. */
function referrerHost(): string {
  try {
    const referrer = document.referrer;
    if (!referrer) return "";
    const host = new URL(referrer).hostname.toLowerCase();
    return host === window.location.hostname ? "" : host;
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------- coercion */

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function tally(value: unknown): Tally {
  const row = (value ?? {}) as Record<string, unknown>;
  return { views: num(row.views), visits: num(row.visits), uniques: num(row.uniques) };
}

/** A fixed-length histogram: short input is padded, long input is cut. */
function series(value: unknown, length: number): number[] {
  const list = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, i) => num(list[i]));
}

function slices(value: unknown): Slice[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const cell = (row ?? {}) as Record<string, unknown>;
      // `count` is the field name; `views` is what the first revision of the
      // endpoint sent. Reading both means a half-updated server still renders.
      return { key: str(cell.key), count: num(cell.count ?? cell.views) };
    })
    .filter((slice) => slice.key !== "");
}

function day(value: unknown): DayLike {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    date: str(row.date),
    views: num(row.views),
    visits: num(row.visits),
    uniques: num(row.uniques),
  };
}

interface DayLike {
  date: string;
  views: number;
  visits: number;
  uniques: number;
}

function toPulse(row: Record<string, unknown>): Pulse {
  return {
    ...tally(row),
    today: tally(row.today),
    online: num(row.online),
    since: str(row.since),
  };
}

function toStats(row: Record<string, unknown>): Stats {
  const windows = (row.windows ?? {}) as Record<string, unknown>;
  const avg = (row.avg ?? {}) as Record<string, unknown>;
  const peak = (row.peak ?? {}) as Record<string, unknown>;
  const peakDay = (peak.day ?? {}) as Record<string, unknown>;
  const peakHour = (peak.hour ?? {}) as Record<string, unknown>;
  const tech = (row.tech ?? {}) as Record<string, unknown>;

  return {
    ...toPulse(row),
    daysRunning: Math.max(1, num(row.daysRunning)),
    yesterday: day(row.yesterday),
    windows: { d7: tally(windows.d7), d30: tally(windows.d30) },
    avg: { viewsPerDay: num(avg.viewsPerDay), viewsPerVisit: num(avg.viewsPerVisit) },
    peak: {
      day: { date: str(peakDay.date), views: num(peakDay.views) },
      hour: { hour: num(peakHour.hour), views: num(peakHour.views), date: str(peakHour.date) },
    },
    streak: num(row.streak),
    hours: series(row.hours, 24),
    series: Array.isArray(row.series) ? row.series.map(day) : [],
    weekdays: series(row.weekdays, 7),
    pages: slices(row.pages),
    langs: slices(row.langs),
    referrers: slices(row.referrers),
    tech: { device: slices(tech.device), browser: slices(tech.browser), os: slices(tech.os) },
    bots: num(row.bots),
  };
}
