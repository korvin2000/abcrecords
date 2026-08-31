import { createInstance, type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';
import zh from './locales/zh.json';
import {
  DEFAULT_GUESTBOOK_LOCALE,
  GUESTBOOK_I18N_NAMESPACE,
  GUESTBOOK_LOCALES,
  type GuestbookLocale,
} from './locales';

export {
  DEFAULT_GUESTBOOK_LOCALE,
  GUESTBOOK_I18N_NAMESPACE,
  GUESTBOOK_LOCALES,
  isGuestbookLocale,
  resolveGuestbookLocale,
  type GuestbookLocale,
} from './locales';

/** Ein Uebersetzungsbaum, wie ihn die JSON-Dateien dieses Packages liefern. */
export type GuestbookTranslations = Record<string, unknown>;

/**
 * Texte, die die Host-Anwendung ueberschreiben oder ergaenzen darf — pro
 * Sprache ein Teilbaum, der ueber die mitgelieferten Texte gelegt wird.
 *
 * Anwendungsfall: die Host-Anwendung nennt das Guestbook anders („Fanpost",
 * „Community") oder braucht einen eigenen Untertitel, will aber nicht alle
 * uebrigen Texte pflegen.
 */
export type GuestbookTranslationOverrides = Partial<Record<GuestbookLocale, GuestbookTranslations>>;

const BUNDLED: Record<GuestbookLocale, GuestbookTranslations> = {
  ru,
  en,
  es,
  ja,
  de,
  fr,
  it,
  pt,
  uk,
  zh,
  ko,
};

/**
 * Liest einen Text direkt aus den mitgelieferten Sprachdateien.
 *
 * Ohne i18next, weil die Fehlergrenze (GuestbookErrorBoundary) auch dann noch
 * etwas Lesbares anzeigen muss, wenn genau der i18next-Aufbau der Grund fuer
 * den Fehler war.
 */
export function staticText(locale: GuestbookLocale, path: string): string {
  const walk = (tree: GuestbookTranslations): unknown =>
    path.split('.').reduce<unknown>((node, key) => {
      if (typeof node !== 'object' || node === null) return undefined;

      return (node as Record<string, unknown>)[key];
    }, tree);

  const value = walk(BUNDLED[locale]) ?? walk(BUNDLED[DEFAULT_GUESTBOOK_LOCALE]);

  return typeof value === 'string' ? value : path;
}

/** Flache Objekte zusammenfuehren; verschachtelte Teilbaeume werden gemischt. */
function mergeDeep(base: GuestbookTranslations, patch: GuestbookTranslations): GuestbookTranslations {
  const result: GuestbookTranslations = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    result[key] =
      typeof value === 'object' && value !== null && !Array.isArray(value) &&
      typeof current === 'object' && current !== null && !Array.isArray(current)
        ? mergeDeep(current as GuestbookTranslations, value as GuestbookTranslations)
        : value;
  }

  return result;
}

export interface CreateGuestbookI18nOptions {
  locale: GuestbookLocale;
  fallbackLocale?: GuestbookLocale;
  overrides?: GuestbookTranslationOverrides | undefined;
}

/**
 * Erzeugt eine **eigene**, isolierte i18next-Instanz fuer eine Guestbook-Instanz.
 *
 * Warum keine globale Instanz mehr (so war es in der eigenstaendigen SPA):
 *
 * - Ein Package darf beim Import keine Nebenwirkungen ausloesen. Ein globales
 *   `i18next.init()` liefe schon, bevor die Host-Anwendung das Guestbook
 *   ueberhaupt anzeigt — und liesse sich nicht mehr aufraeumen.
 * - Die Host-Anwendung benutzt moeglicherweise selbst i18next. Eine geteilte
 *   Standardinstanz wuerde deren Sprache, Fallback und Namensraeume
 *   ueberschreiben; das Guestbook wuerde die Sprache der ganzen Anwendung
 *   umstellen, sobald jemand hier umschaltet.
 * - Zwei Guestbooks auf einer Seite (etwa Seitenleiste und Vollansicht)
 *   koennten sonst nicht unterschiedliche Sprachen anzeigen.
 *
 * `initReactI18next` wird an die Instanz gehaengt (nicht global registriert),
 * `<I18nextProvider>` reicht sie an den Teilbaum weiter.
 */
export function createGuestbookI18n(options: CreateGuestbookI18nOptions): I18nInstance {
  const { locale, fallbackLocale = DEFAULT_GUESTBOOK_LOCALE, overrides } = options;

  const instance = createInstance();
  void instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: fallbackLocale,
    supportedLngs: [...GUESTBOOK_LOCALES],
    ns: [GUESTBOOK_I18N_NAMESPACE],
    defaultNS: GUESTBOOK_I18N_NAMESPACE,
    resources: Object.fromEntries(
      GUESTBOOK_LOCALES.map((code) => {
        const bundle = BUNDLED[code];
        const patch = overrides?.[code];

        return [code, { [GUESTBOOK_I18N_NAMESPACE]: patch ? mergeDeep(bundle, patch) : bundle }];
      }),
    ),
    interpolation: {
      // React escapt selbst; doppeltes Escaping wuerde Umlaute in Platzhaltern
      // als Entities anzeigen.
      escapeValue: false,
    },
    // Sonst wartet react-i18next auf einen Backend-Ladevorgang, den es hier
    // nicht gibt, und rendert beim ersten Durchlauf leere Texte.
    initImmediate: false,
  });

  return instance;
}
