import type { DemosceneMessages, ResolvedContent } from '../types';

/**
 * One language's complete message catalogue: demoscene chrome plus content,
 * already collapsed to plain strings for that single language. This is the
 * unit of translation -- one file per language under `src/locales/`, each
 * shaped like this one, the way message catalogues work in typical React
 * i18n setups (react-i18next, FormatJS/react-intl, etc.).
 *
 * `src/locales/index.ts` transposes every catalogue back into the
 * per-field `LocalizedText` maps (`{ en: '...', ru: '...' }`) that
 * `DemosceneContent` and `resolveContent` expect, so the render pipeline
 * never has to know the catalogues exist.
 *
 * Every key here is rendered by the demoscene itself. Copy that belongs to
 * whatever page *launches* the demoscene -- headings, buttons, a language
 * picker's option labels -- is the host's, and must not be added here: the
 * host would be paying for it inside the lazy feature chunk, in a place its
 * own translators never look.
 */
export interface LocaleModule {
  /** BCP-47-ish tag. Must match the file's own key in `locales/index.ts`. */
  readonly tag: string;
  readonly ui: DemosceneMessages;
  readonly content: ResolvedContent;
}
