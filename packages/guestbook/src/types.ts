import type { CSSProperties, ReactNode } from 'react';

import type { GuestbookApi } from './api/guestbookApi';
import type { GuestbookLocale, GuestbookTranslationOverrides } from './i18n';

export type { GuestbookLocale, GuestbookTranslationOverrides, GuestbookTranslations } from './i18n';
export type { GuestbookApi } from './api/guestbookApi';

/**
 * Farbschema. `"system"` folgt `prefers-color-scheme`; `"light"`/`"dark"`
 * erzwingen einen Modus, damit das Guestbook dem Umschalter der
 * Host-Anwendung folgen kann — von dem `prefers-color-scheme` nichts weiss.
 */
export type GuestbookThemeMode = 'light' | 'dark' | 'system';

/**
 * Wohin gescrollt wird, wenn der Besucher die Seite wechselt.
 *
 * `"container"` (Standard) holt den Kopf des Guestbooks ins Bild — in einer
 * eingebetteten Ansicht das erwartete Verhalten. `"window"` springt an den
 * Seitenanfang (Verhalten der eigenstaendigen SPA), `"none"` scrollt nicht.
 */
export type GuestbookScrollBehavior = 'container' | 'window' | 'none';

/**
 * Laufzeit-Konfiguration. Alles hat einen Standardwert; die Host-Anwendung
 * uebergibt nur, was sie wirklich anders braucht.
 */
export interface GuestbookConfig {
  /**
   * Basis-URL der REST-API, wie der Browser sie sieht — ohne Schraegstrich am
   * Ende. Relativ (`/gbook/api`) oder absolut
   * (`https://www.abc-guitars.com/gbook/api`).
   */
  apiBaseUrl: string;

  /**
   * `credentials` jedes Requests. Standard `"same-origin"`; laeuft die API auf
   * einer anderen Origin als die Host-Anwendung, ist `"include"` noetig — dann
   * muss die API allerdings CORS mit `Access-Control-Allow-Credentials`
   * ausliefern, sonst kommt das CSRF-Cookie nicht an.
   */
  credentials: RequestCredentials;

  /**
   * Zusaetzliche Header fuer jeden Request, z. B. ein Tracing- oder
   * Mandanten-Header der Host-Anwendung. Als Funktion ausgewertet, damit ein
   * kurzlebiges Token nicht beim Mounten eingefroren wird.
   */
  headers?: Record<string, string> | (() => Record<string, string>);

  /**
   * Ersatz fuer `globalThis.fetch`. Damit kann die Host-Anwendung ihren eigenen
   * HTTP-Stack unterschieben (Auth, Wiederholungen, Telemetrie, Testdoubles),
   * ohne dass dieses Package davon etwas wissen muss.
   */
  fetch?: typeof fetch;

  /** Eintraege pro Seite. Ohne Angabe entscheidet das Backend. */
  pageSize?: number;

  /**
   * Praefix aller `localStorage`-Schluessel. Trennt mehrere Guestbook-Instanzen
   * und verhindert Kollisionen mit Schluesseln der Host-Anwendung.
   */
  storageNamespace: string;

  /**
   * Stammdaten des Besuchers (Name, E-Mail, Land, …) fuer 30 Tage merken, damit
   * das Formular beim naechsten Mal vorausgefuellt ist. Abschaltbar, wenn die
   * Host-Anwendung eine eigene Einwilligungsverwaltung hat.
   */
  persistDraft: boolean;

  /**
   * Zuletzt gewaehlte Sprache merken. Nur wirksam, wenn das Guestbook seine
   * Sprache selbst verwaltet — steuert die Host-Anwendung sie ueber `locale`,
   * gewinnt immer die Host-Anwendung.
   */
  persistLocale: boolean;

  /** Scrollverhalten beim Seitenwechsel. */
  scrollBehavior: GuestbookScrollBehavior;

  /**
   * Praefix der Sprungmarken einzelner Eintraege (`#entry-176`).
   *
   * Diese `id`s sind bewusst keine `useId()`-Werte: sie sind teilbare
   * Direktlinks und muessen ueber Ladevorgaenge hinweg gleich bleiben. Damit
   * sind sie aber auch die einzigen DOM-`id`s des Packages, die mit denen der
   * Host-Anwendung kollidieren koennten — dieses Praefix loest das.
   */
  anchorPrefix: string;
}

/**
 * Woher die Seitenzahl kommt und wohin sie geschrieben wird.
 *
 * Der Standard ist `"memory"`: ein eingebettetes Feature darf die
 * Browser-History der Host-Anwendung nicht anfassen, sonst kollidiert es mit
 * deren Router (docs/react-modular-architecture.md, Abschnitt 17).
 */
export type GuestbookRouting =
  /** Nur Komponentenzustand. URL bleibt unberuehrt. */
  | { mode: 'memory'; initialPage?: number }
  /**
   * Seitenzahl steht in der URL-Query und wird per `history.pushState`
   * geschrieben. Fuer die eigenstaendige SPA und fuer Hosts, die geteilte Links
   * wollen und wissen, dass ihr Router mit fremden Query-Parametern umgehen
   * kann. `paramPrefix` haengt den Parametern ein Praefix voran (`gb` ->
   * `?gbPage=3`), damit sie nicht mit denen der Host-Anwendung kollidieren.
   */
  | { mode: 'url'; paramPrefix?: string }
  /**
   * Die Host-Anwendung fuehrt die Seitenzahl selbst, z. B. in ihrem Router.
   * Das Guestbook liest nur und meldet Wuensche zurueck.
   */
  | { mode: 'controlled'; page: number; onPageChange: (page: number) => void };

/** Meldung nach erfolgreichem Absenden eines Eintrags. */
export interface GuestbookEntrySubmittedEvent {
  id: number;
  /** true = wartet auf Freischaltung im Admin-Bereich und ist noch unsichtbar. */
  moderated: boolean;
}

/** Meldung nach erfolgreichem Absenden eines Kommentars. */
export interface GuestbookCommentPostedEvent {
  entryId: number;
  moderated: boolean;
}

/** Woher ein an `onError` gemeldeter Fehler stammt. */
export interface GuestbookErrorContext {
  /** `"render"` = React-Fehlergrenze, `"api"` = fehlgeschlagener Request. */
  source: 'render' | 'api';
  componentStack?: string | undefined;
}

/**
 * Der vollstaendige oeffentliche Vertrag des Guestbooks.
 *
 * Bewusst nur Primitive, einfache Objekte und Callbacks — keine Store-,
 * Router- oder Kontextobjekte der Host-Anwendung
 * (docs/react-modular-architecture.md, Abschnitt 12).
 */
export interface GuestbookProps {
  /**
   * Sprache aus der Host-Anwendung. BCP-47 erlaubt: `"de"`, `"de-DE"`,
   * `"zh-Hans"` — nicht Unterstuetztes faellt auf `fallbackLocale` zurueck.
   *
   * Ist dieses Prop gesetzt, ist die Sprache **gesteuert**: das Guestbook
   * folgt ihr bei jeder Aenderung und speichert keine eigene Wahl.
   */
  locale?: string | undefined;

  /** Sprache, wenn `locale` fehlt oder nicht unterstuetzt wird. Standard `"ru"`. */
  fallbackLocale?: GuestbookLocale;

  /**
   * Wird gerufen, wenn im Guestbook eine Sprache gewaehlt wurde. Zusammen mit
   * `locale` ergibt das das ueblich gesteuerte Muster: die Host-Anwendung
   * bleibt die einzige Quelle der Wahrheit und kann ihre eigene Oberflaeche
   * mit umschalten.
   */
  onLocaleChange?: (locale: GuestbookLocale) => void;

  /**
   * Eigener Sprachumschalter des Guestbooks.
   * `"auto"` (Standard): sichtbar, solange die Host-Anwendung die Sprache nicht
   * per `locale` steuert — hat sie einen eigenen Umschalter, waeren zwei
   * verwirrend. Mit `onLocaleChange` bleibt er auch dann sichtbar.
   */
  languageSwitcher?: 'auto' | 'always' | 'never';

  /** Einzelne Texte pro Sprache ueberschreiben oder ergaenzen. */
  translations?: GuestbookTranslationOverrides;

  /** Abweichungen von der Standard-Laufzeitkonfiguration. */
  config?: Partial<GuestbookConfig>;

  /**
   * Vollstaendiger Ersatz fuer die API-Schicht — fuer Tests, Storybook oder
   * einen Proxy der Host-Anwendung. Ist dies gesetzt, wird `config.apiBaseUrl`
   * nicht mehr benutzt.
   */
  api?: GuestbookApi;

  /** Farbschema. Standard `"system"`. */
  theme?: GuestbookThemeMode;

  /** Zusaetzliche Klasse am Wurzelelement (Layout durch die Host-Anwendung). */
  className?: string;

  /** Inline-Styles am Wurzelelement, u. a. um `--gb-*`-Tokens zu setzen. */
  style?: CSSProperties;

  /** Seitenzahl-Verwaltung. Standard `{ mode: 'memory' }`. */
  routing?: GuestbookRouting;

  /**
   * Eigener Kopfbereich statt Titel/Untertitel/Sprachumschalter. `false`
   * blendet ihn ganz aus, wenn die Host-Anwendung schon eine Seitenueberschrift
   * hat.
   */
  header?: ReactNode | false;

  /**
   * Ueberschriftenebene des Standard-Kopfbereichs. Standard `2`: eingebettet
   * gehoert die einzige `<h1>` der Host-Anwendung, und eine zweite wuerde die
   * Dokumentgliederung fuer Screenreader zerstoeren. Die eigenstaendige
   * Anwendung setzt `1`.
   */
  headingLevel?: 1 | 2 | 3 | 4;

  /** Eintragsformular anzeigen. Standard `true`. */
  showEntryForm?: boolean;

  /** Jeder gefangene Render- oder API-Fehler, fuer die Telemetrie des Hosts. */
  onError?: (error: unknown, context: GuestbookErrorContext) => void;

  onEntrySubmitted?: (event: GuestbookEntrySubmittedEvent) => void;

  onCommentPosted?: (event: GuestbookCommentPostedEvent) => void;
}
