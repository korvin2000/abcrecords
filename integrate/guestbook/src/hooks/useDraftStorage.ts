import { useCallback, useEffect, useRef } from 'react';

import { storageKey } from '../config/defaults';
import { useGuestbookConfig } from '../runtime/context';

/**
 * Merkt die Stammdaten des Besuchers fuer 30 Tage, damit das Formular beim
 * naechsten Besuch vorausgefuellt ist.
 *
 * Ersetzt die Cookies der Alt-App (`vgb_*`, 30 Tage, docs/legacy-architecture.md
 * §3). `localStorage` ist hier die bessere Wahl: die Daten sind reine
 * Client-Bequemlichkeit und gehen den Server nichts an — als Cookie wuerden sie
 * bei **jedem** Request mitgeschickt, inklusive Bildern und API-Aufrufen.
 *
 * Bewusst NICHT gespeichert werden Nachrichtentext, privates Passwort und die
 * Captcha-Antwort: der Text ist einmalig, das Passwort ist ein Geheimnis, und
 * eine Captcha-Antwort ist nach dem Absenden verbraucht.
 *
 * Der Schluessel traegt den Namensraum aus der Konfiguration
 * (`viper-guestbook.entryDraft`). Als eingebettetes Feature teilt sich das
 * Guestbook den `localStorage` mit der Host-Anwendung — ein Schluessel wie
 * `gbook.entryDraft` waere dort ein Kollisionsrisiko. Ueber
 * `config.persistDraft: false` laesst sich das Merken ganz abschalten, etwa
 * wenn die Host-Anwendung eine eigene Einwilligungsverwaltung hat.
 */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredDraft<T> {
  savedAt: number;
  values: Partial<T>;
}

export function useDraftStorage<T extends object>(
  apply: (values: Partial<T>) => void,
): (values: Partial<T>) => void {
  const config = useGuestbookConfig();
  const key = storageKey(config, 'entryDraft');
  const enabled = config.persistDraft;

  // apply darf sich zwischen Renders aendern, ohne den Ladeeffekt neu auszuloesen.
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let stored: StoredDraft<T> | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      stored = raw === null ? null : (JSON.parse(raw) as StoredDraft<T>);
    } catch {
      // Ungueltiger oder blockierter Speicher: einfach ohne Vorbelegung starten.
      return;
    }

    if (stored === null || typeof stored.savedAt !== 'number') {
      return;
    }
    if (Date.now() - stored.savedAt > MAX_AGE_MS) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* nicht kritisch */
      }

      return;
    }

    applyRef.current(stored.values);
  }, [enabled, key]);

  return useCallback(
    (values: Partial<T>) => {
      if (!enabled) {
        return;
      }
      try {
        const payload: StoredDraft<T> = { savedAt: Date.now(), values };
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // Privatmodus oder voller Speicher — die Vorbelegung ist ein Komfortfeature.
      }
    },
    [enabled, key],
  );
}
