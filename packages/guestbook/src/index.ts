/**
 * Oeffentlicher Einstiegspunkt des Packages `@guitar-codex/guestbook`.
 *
 * Nur was hier exportiert wird, ist Vertrag. Alles andere unter `src/` ist
 * private Implementierung — `package.json.exports` laesst tiefe Importe
 * (`@guitar-codex/guestbook/src/components/EntryForm`) gar nicht erst zu.
 *
 * Diese Datei enthaelt bewusst **keine** Seiteneffekte: kein `createRoot`, kein
 * globales `i18next.init()`, keine `window`-Listener, keine Aenderung am
 * `document`. Damit kostet ein Import nichts ausser dem Laden des Moduls, und
 * die Host-Anwendung kann das Package gefahrlos hinter einem dynamischen
 * Import halten (docs/react-modular-architecture.md, Abschnitte 15 und 23).
 *
 *     const Guestbook = lazy(() => import('@guitar-codex/guestbook'));
 *     <Guestbook locale={i18n.language} />
 */

export { GuestbookApp, GuestbookApp as default } from './GuestbookApp';

export type {
  GuestbookApi,
  GuestbookCommentPostedEvent,
  GuestbookConfig,
  GuestbookEntrySubmittedEvent,
  GuestbookErrorContext,
  GuestbookLocale,
  GuestbookProps,
  GuestbookRouting,
  GuestbookScrollBehavior,
  GuestbookThemeMode,
  GuestbookTranslationOverrides,
  GuestbookTranslations,
} from './types';

export {
  DEFAULT_GUESTBOOK_LOCALE,
  GUESTBOOK_LOCALES,
  isGuestbookLocale,
  resolveGuestbookLocale,
} from './i18n/locales';

export { GUESTBOOK_CONFIG_DEFAULTS } from './config/defaults';

/**
 * Fehlertyp der API. Die Host-Anwendung kann in `onError` darauf pruefen
 * (`error instanceof ApiError && error.code === 'banned'`), statt Meldungstexte
 * zu vergleichen.
 */
export { ApiError } from './api/client';

/**
 * API-Schicht ohne Komponente — fuer Tests, Storybook-Mocks oder um Eintraege
 * vorzuladen, bevor das Guestbook-Chunk ueberhaupt angefordert wird.
 */
export { createGuestbookApi } from './api/guestbookApi';
