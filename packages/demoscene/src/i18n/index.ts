import type {
  DemosceneContent,
  DemosceneMessages,
  LocalizedText,
  ResolvedContent,
} from '../types';
import { LOCALE_MESSAGES } from '../locales';

/**
 * Built-in chrome labels, one pack per shipped locale (see `src/locales/`,
 * one JSON catalogue per language). Add your own, or override these,
 * through `DemosceneOptions.messages`.
 */
export const BUILTIN_MESSAGES: Record<string, DemosceneMessages> = { ...LOCALE_MESSAGES };

/**
 * Resolve a locale tag against a set of available keys.
 * `ru-RU` -> `ru-RU`, then `ru`, then any `ru-*`, then the fallback.
 */
export function matchLocale(
  available: readonly string[],
  locale: string,
  fallback: string,
): string | undefined {
  if (!available.length) return undefined;
  const want = locale.toLowerCase();
  const lower = available.map((k) => k.toLowerCase());

  let i = lower.indexOf(want);
  if (i >= 0) return available[i];

  const primary = want.split('-')[0];
  i = lower.indexOf(primary);
  if (i >= 0) return available[i];

  i = lower.findIndex((k) => k.split('-')[0] === primary);
  if (i >= 0) return available[i];

  if (fallback && fallback.toLowerCase() !== want) {
    const f = matchLocale(available, fallback, '');
    if (f) return f;
  }
  return available[0];
}

/** Collapse one `LocalizedText` for the active locale. */
export function pick(
  text: LocalizedText | undefined,
  locale: string,
  fallback: string,
): string {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  const keys = Object.keys(text);
  const key = matchLocale(keys, locale, fallback);
  return key ? text[key] : '';
}

export function resolveMessages(
  packs: Readonly<Record<string, Partial<DemosceneMessages>>>,
  locale: string,
  fallback: string,
): DemosceneMessages {
  const merged: Record<string, Partial<DemosceneMessages>> = {};
  for (const k of Object.keys(BUILTIN_MESSAGES)) merged[k] = { ...BUILTIN_MESSAGES[k] };
  for (const k of Object.keys(packs)) merged[k] = { ...(merged[k] ?? {}), ...packs[k] };

  const base =
    BUILTIN_MESSAGES[matchLocale(Object.keys(BUILTIN_MESSAGES), fallback, 'en') ?? 'en'] ??
    BUILTIN_MESSAGES.en;
  const key = matchLocale(Object.keys(merged), locale, fallback);
  return { ...base, ...(key ? merged[key] : {}) } as DemosceneMessages;
}

export function resolveContent(
  content: DemosceneContent,
  locale: string,
  fallback: string,
): ResolvedContent {
  const t = (v: LocalizedText | undefined) => pick(v, locale, fallback);
  return {
    work: t(content.work),
    title: t(content.title),
    subtitle: t(content.subtitle),
    edition: t(content.edition),
    dropcap: t(content.dropcap).slice(0, 1) || 'A',
    dedication: t(content.dedication),
    colophon: t(content.colophon),
    credits: content.credits.map((g) => ({
      role: t(g.role),
      sub: t(g.sub),
      names: g.names.map(t).filter(Boolean),
    })),
    blocks: content.blocks.map(t).filter(Boolean),
  };
}

/** Best guess at the host application's locale. */
export function detectLocale(): string {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language || 'en';
}
