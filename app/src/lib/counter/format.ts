/**
 * Turning the counter's numbers and ISO days into something a reader sees.
 *
 * Two rules hold this file together.
 *
 * **Nothing reaches for `new Date(string)`.** The server sends ISO days
 * (`2026-08-31`), and `new Date("2026-08-31")` is parsed as **UTC midnight** —
 * so in any timezone west of Greenwich it formats as the day before, which is
 * how a chart ends up labelled a day out for half the world. Every date is
 * split into its three numbers and rebuilt in local time instead.
 *
 * **Formatters are built once, not per value.** An `Intl.DateTimeFormat` costs
 * far more to construct than to use, and the panel formats thirty days, then
 * twenty-four hours, then a tooltip for each of them: constructing one per
 * call was ~110 constructions per open. They are cached per locale here — at
 * most a handful of entries per language the reader has actually chosen, so
 * the cache is bounded by the language menu and cannot grow on its own.
 */

import type { DayPoint } from "./types";

const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function dateFormat(locale: string, kind: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d:${kind}:${locale}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, cached);
  }
  return cached as Intl.DateTimeFormat;
}

function numberFormat(locale: string, kind: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `n:${kind}:${locale}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, options);
    formatters.set(key, cached);
  }
  return cached as Intl.NumberFormat;
}

/** `2026-08-31` → a local Date, or null if it is not an ISO day. */
export function parseIsoDay(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Day and month, for a chart label: "31 Aug", "31 авг.", "8月31日". */
export function formatShortDay(iso: string, locale: string): string {
  const date = parseIsoDay(iso);
  if (!date) return iso;
  return dateFormat(locale, "short", { day: "numeric", month: "short" }).format(date);
}

/** The full day, for a caption: "31 August 2026". */
export function formatLongDay(iso: string, locale: string): string {
  const date = parseIsoDay(iso);
  if (!date) return iso;
  return dateFormat(locale, "long", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** "14:00" in the reader's clock convention, from an hour 0–23. */
export function formatHour(hour: number, locale: string): string {
  return dateFormat(locale, "hour", { hour: "numeric", minute: "2-digit" }).format(
    new Date(2024, 0, 1, hour, 0, 0),
  );
}

/** Grouped digits in the reader's locale — for the panel, never the drums. */
export function formatCount(value: number, locale: string): string {
  return numberFormat(locale, "count").format(Math.round(value));
}

/** One decimal, and none when there is nothing after the point. */
export function formatRatio(value: number, locale: string): string {
  return numberFormat(locale, "ratio", { maximumFractionDigits: 1 }).format(value);
}

/**
 * Short weekday names, **Monday first** — the order the server's histogram
 * uses. 1 January 2024 was a Monday, which is what makes the reference date a
 * constant rather than a calculation.
 */
export function weekdayNames(locale: string): string[] {
  const format = dateFormat(locale, "weekday", { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2024, 0, 1 + i)));
}

/**
 * A series of exactly `length` days ending on the last day the server sent.
 *
 * The server keeps a *sparse* history — a day nobody visited has no row — so
 * "the last thirty days" arrives as however many days had readers. Drawn as
 * they come, a counter one day old renders a single bar the width of the whole
 * chart, which says "every day was equally busy" instead of "there has been
 * one day". The gaps are filled here, from the server's own last date, so the
 * chart keeps the server's idea of where a day ends.
 */
export function fillMissingDays(series: readonly DayPoint[], length: number): DayPoint[] {
  const last = series[series.length - 1]?.date;
  if (!last) return [];

  const known = new Map(series.map((day) => [day.date, day]));
  const filled: DayPoint[] = [];
  for (let back = length - 1; back >= 0; back--) {
    const date = shiftIsoDay(last, -back);
    filled.push(known.get(date) ?? { date, views: 0, visits: 0, uniques: 0 });
  }
  return filled;
}

/** The ISO day `offset` days from `iso`; month and year ends are the Date's
 *  problem, not ours. */
function shiftIsoDay(iso: string, offset: number): string {
  const date = parseIsoDay(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + offset);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The share one slice takes of the largest slice, as a 0–1 fraction. */
export function share(value: number, max: number): number {
  return max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
}

/** The largest count in a list — the scale every bar in it is drawn against. */
export function peakOf(values: readonly number[]): number {
  return values.reduce((top, value) => (value > top ? value : top), 0);
}
