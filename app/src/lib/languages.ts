/**
 * The ten tongues of the codex — single source of truth for language codes,
 * native names (endonyms, per the design brief) and Intl locales.
 *
 * Content side: index.json rows carry `lang: "ru,en"` (comma-separated ISO
 * 639-1 codes) and each entry's json/md pair lives in a per-language
 * directory (`pages/ru/…`, `pages/en/…`). Media paths are NOT localized —
 * they keep resolving against the content root exactly as before the move.
 */

export const LANGUAGES = [
  { code: "en", native: "English", locale: "en-GB" },
  { code: "es", native: "Español", locale: "es-ES" },
  { code: "ja", native: "日本語", locale: "ja-JP" },
  { code: "de", native: "Deutsch", locale: "de-DE" },
  { code: "fr", native: "Français", locale: "fr-FR" },
  { code: "it", native: "Italiano", locale: "it-IT" },
  { code: "pt", native: "Português", locale: "pt-PT" },
  { code: "ru", native: "Русский", locale: "ru-RU" },
  { code: "zh", native: "中文", locale: "zh-CN" },
  { code: "ko", native: "한국어", locale: "ko-KR" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

export const LANG_CODES: readonly Lang[] = LANGUAGES.map((l) => l.code);

/** The catalogue's primary language — entries without a `lang` field are ru. */
export const DEFAULT_LANG: Lang = "ru";

export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANG_CODES as readonly string[]).includes(x);
}

export function langInfo(code: Lang): (typeof LANGUAGES)[number] {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[7]; // ru
}

/** `"ru, en"` → `["ru", "en"]`; unknown codes dropped; empty → [DEFAULT_LANG].
 *  Order is preserved: the FIRST code is the entry's original language. */
export function parseLangList(s: string | undefined | null): Lang[] {
  const list = (s ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(isLang);
  return list.length ? list : [DEFAULT_LANG];
}

/** Languages an index entry is available in (always non-empty). */
export function entryLangs(entry: { lang?: string }): Lang[] {
  return parseLangList(entry.lang);
}

/** Best content language for a reader: their chosen tongue when the entry
 *  has it, otherwise the entry's original (first-listed) language. */
export function pickContentLang(available: Lang[], preferred: Lang): Lang {
  return available.includes(preferred) ? preferred : (available[0] ?? DEFAULT_LANG);
}
