import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { GuestbookApp } from '../GuestbookApp';
import { isGuestbookLocale, resolveGuestbookLocale, type GuestbookLocale } from '../i18n';
import './standalone.css';

/*
 * Eigenstaendiger Betrieb des Guestbooks.
 *
 * Diese Datei ist **nicht** Teil des Packages: `package.json.exports` gibt nur
 * `src/index.ts` frei. Sie ist der Entwicklungs- und Notbetriebs-Wirt —
 * `npm run dev`, `npm run build` — und zugleich das kleinste vollstaendige
 * Beispiel einer Host-Anwendung.
 *
 * Alles, was ein Package nicht tun darf, steht deshalb genau hier und nirgends
 * sonst:
 *
 * - `createRoot()`,
 * - Schreiben an `document.documentElement.lang`,
 * - globale `window`-Listener (`message`),
 * - eine globale Variable (`window.ViperGuestbook`),
 * - Auswertung der Seiten-URL (`?lang=`),
 * - globale Seiten-Styles (`standalone.css`).
 */

const STORAGE_KEY = 'viper-guestbook.locale';
const QUERY_KEY = 'lang';

/**
 * Nachrichtentyp der postMessage-Fernsteuerung. Eigener String statt z. B. nur
 * "setLanguage", damit fremde postMessage-Handler auf derselben Seite nicht
 * versehentlich reagieren.
 */
const MESSAGE_TYPE = 'viper-guestbook:set-language';

function initialLocale(): GuestbookLocale {
  const fromQuery = new URLSearchParams(window.location.search).get(QUERY_KEY);
  if (isGuestbookLocale(fromQuery)) {
    return fromQuery;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isGuestbookLocale(stored)) {
      return stored;
    }
  } catch {
    // localStorage kann blockiert sein (Privatmodus) — dann bleibt es beim Default.
  }

  return resolveGuestbookLocale(null);
}

/**
 * Wirt der eigenstaendigen Anwendung.
 *
 * Er fuehrt die Sprache selbst und uebergibt sie als `locale` — genau so, wie
 * es eine echte Host-Anwendung tun wuerde. Damit ist dieser Wirt zugleich der
 * laufende Beweis, dass der gesteuerte Sprachbetrieb funktioniert.
 */
function StandaloneHost() {
  const [locale, setLocale] = useState<GuestbookLocale>(initialLocale);

  const changeLocale = useCallback((next: GuestbookLocale) => {
    setLocale(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Nicht kritisch: die Wahl gilt dann nur fuer diese Sitzung.
    }
  }, []);

  // Sprache des Dokuments: gehoert der Seite, nicht dem Guestbook — deshalb
  // hier und nicht im Package.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  /*
   * Externe Sprachsteuerung fuer Einbettung per <iframe>:
   *
   *   iframe.contentWindow.postMessage(
   *     { type: 'viper-guestbook:set-language', language: 'en' },
   *     'https://<origin-dieser-app>',
   *   );
   *
   * Auf eine Pruefung von `event.origin` wird bewusst verzichtet: es werden
   * ausschliesslich oeffentliche UI-Texte umgeschaltet, keine
   * sicherheitsrelevante Aktion ausgeloest — dieselbe Faehigkeit besteht
   * oeffentlich ueber den Sprachumschalter in der Oberflaeche.
   *
   * Fuer eine React-Host-Anwendung ist dieser Weg NICHT gedacht: sie importiert
   * das Package und uebergibt `locale` als Prop.
   */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (typeof data === 'object' && data !== null && data['type'] === MESSAGE_TYPE) {
        const language = String(data['language']);
        if (isGuestbookLocale(language)) {
          changeLocale(language);
        }
      }
    };

    window.addEventListener('message', onMessage);
    window.ViperGuestbook = {
      setLanguage: (language: string) => {
        if (!isGuestbookLocale(language)) {
          return false;
        }
        changeLocale(language);

        return true;
      },
      getLanguage: () => locale,
      supportedLanguages: [...(['ru', 'en', 'es', 'ja', 'de', 'fr', 'it', 'pt', 'uk', 'zh', 'ko'] as const)],
    };

    return () => {
      window.removeEventListener('message', onMessage);
      delete window.ViperGuestbook;
    };
  }, [changeLocale, locale]);

  return (
    <GuestbookApp
      locale={locale}
      onLocaleChange={changeLocale}
      headingLevel={1}
      // Eigenstaendig gehoert die URL uns: Seitenzahlen duerfen dorthin, damit
      // Links teilbar bleiben.
      routing={{ mode: 'url' }}
      config={{ scrollBehavior: 'window' }}
    />
  );
}

declare global {
  interface Window {
    ViperGuestbook?: {
      setLanguage: (language: string) => boolean;
      getLanguage: () => GuestbookLocale;
      supportedLanguages: readonly GuestbookLocale[];
    };
  }
}

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Element #root fehlt in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <StandaloneHost />
  </StrictMode>,
);
