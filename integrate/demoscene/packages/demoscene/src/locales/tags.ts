/**
 * The one module in this package that is safe to import *eagerly* from host
 * startup code, via the `@site/demoscene/locales` subpath export.
 *
 * It is a hand-maintained list rather than `LOCALES.map(l => l.tag)` on
 * purpose: deriving it would pull all eleven JSON catalogues — and therefore
 * the whole feature graph — into whatever chunk imported it. A host that only
 * needs to answer "does the demoscene speak this language?" should pay a few
 * bytes, not the demoscene.
 *
 * `locales/index.ts` asserts at load that this list matches the catalogues
 * actually shipped, so the two cannot drift.
 */

/** BCP-47-ish tags this build ships translations for, `ru` first (baseline). */
export const SUPPORTED_LOCALES = [
  'ru',
  'en',
  'es',
  'ja',
  'de',
  'fr',
  'it',
  'pt',
  'uk',
  'zh',
  'ko',
] as const;

/** A tag this build ships a translation for. */
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * True when `locale` — a tag or a BCP-47 string like `en-GB` — is one the
 * demoscene ships copy for. Anything else still renders: unmatched locales
 * fall through to `fallbackLocale` (default `en`).
 */
export function isSupportedLocale(locale: string): boolean {
  const primary = locale.toLowerCase().split('-')[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(primary);
}
