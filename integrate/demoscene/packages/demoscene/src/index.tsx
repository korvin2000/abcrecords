/**
 * `@site/demoscene` — the one public entry point.
 *
 * The host reaches this module through a dynamic import and nothing else:
 *
 * ```tsx
 * const Demoscene = lazy(() => import('@site/demoscene'));
 * <Demoscene open locale={locale} onClose={() => setOpen(false)} />
 * ```
 *
 * Deep imports (`@site/demoscene/src/render/Stage`) are not part of the
 * contract and are blocked by the package's `exports` map.
 *
 * ⚠ Importing this module *statically* from host startup code pulls the whole
 * demoscene — renderer, score, eleven message catalogues — into the initial
 * bundle and defeats the entire architecture. If startup code needs to know
 * which languages exist, import the tiny eager-safe subpath instead:
 *
 * ```ts
 * import { SUPPORTED_LOCALES } from '@site/demoscene/locales';
 * ```
 */

export { DemosceneApp, default } from './DemosceneApp';
export { createDemoscene, autoWire } from './createDemoscene';

export type {
  CreditGroup,
  DemosceneContent,
  DemosceneHandle,
  DemosceneMessages,
  DemosceneOptions,
  DemosceneProps,
  LocalizedText,
  ResolvedContent,
} from './types';

/** The shipped copy, for hosts that want to override only part of it. */
export { DEFAULT_CONTENT } from './content/defaultContent';
/** Locale matching and message-pack resolution, if the host wants to reuse it. */
export { BUILTIN_MESSAGES, detectLocale, matchLocale, pick, resolveContent } from './i18n';
/** Also available eagerly, without this chunk, from `@site/demoscene/locales`. */
export { SUPPORTED_LOCALES } from './locales/tags';
