/**
 * Sprachliste und Sprachaufloesung — bewusst ohne i18next-Import.
 *
 * Diese Datei ist Teil des oeffentlichen Vertrags: die Host-Anwendung darf sie
 * (ueber den Package-Einstieg) importieren, um vor dem Laden des Guestbooks zu
 * pruefen, welche Sprache dabei herauskommt. Deshalb enthaelt sie nur Daten und
 * reine Funktionen und zieht keine Laufzeit-Abhaengigkeit nach.
 */

/**
 * Russisch ist die primaere/Baseline-Sprache dieser Anwendung (siehe
 * SETTINGS.DEFAULTNAME in der Alt-Datenbank) — alle anderen Sprachdateien sind
 * Uebersetzungen von `locales/ru.json`. Englisch und Deutsch waren bereits in
 * der Alt-Datenbank installiert (LANGUAGE-Tabelle); die uebrigen acht sind
 * reine Frontend-Uebersetzungen ohne Entsprechung in der Alt-App.
 */
export const GUESTBOOK_LOCALES = [
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

export type GuestbookLocale = (typeof GUESTBOOK_LOCALES)[number];

export const DEFAULT_GUESTBOOK_LOCALE: GuestbookLocale = 'ru';

/**
 * i18next-Namensraum aller Texte dieses Packages.
 *
 * Fest verdrahtet und nicht `translation`: liefe das Guestbook je einmal mit
 * einer eigenen und einmal mit einer geteilten i18next-Instanz, kollidierten
 * seine Schluessel sonst mit denen der Host-Anwendung.
 */
export const GUESTBOOK_I18N_NAMESPACE = 'guestbook';

export function isGuestbookLocale(value: unknown): value is GuestbookLocale {
  return typeof value === 'string' && (GUESTBOOK_LOCALES as readonly string[]).includes(value);
}

/**
 * Bildet einen beliebigen Sprachbezeichner der Host-Anwendung auf eine der
 * unterstuetzten Sprachen ab.
 *
 * Die Host-Anwendung darf uebergeben, was sie ohnehin fuehrt — `"de"`,
 * `"de-DE"`, `"de_AT"`, `"zh-Hans-CN"`, `"EN"`. Verlangte das Guestbook exakt
 * seine elf Kuerzel, muesste jede aufrufende Anwendung dieselbe Umrechnung
 * selbst bauen.
 *
 * Nicht unterstuetzte Sprachen fallen auf `fallback` zurueck, statt zu werfen:
 * ein unbekanntes Sprachkuerzel ist ein Anzeigedetail und darf die Seite der
 * Host-Anwendung nicht zerlegen.
 */
export function resolveGuestbookLocale(
  value: string | null | undefined,
  fallback: GuestbookLocale = DEFAULT_GUESTBOOK_LOCALE,
): GuestbookLocale {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  if (isGuestbookLocale(normalized)) {
    return normalized;
  }

  // Primaeres Subtag: "de-DE" -> "de", "zh-Hans-CN" -> "zh".
  const primary = normalized.split('-')[0];

  return isGuestbookLocale(primary) ? primary : fallback;
}
