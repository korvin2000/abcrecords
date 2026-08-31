import { useCallback, useEffect, useState } from 'react';

import { storageKey } from '../config/defaults';
import {
  isGuestbookLocale,
  resolveGuestbookLocale,
  type GuestbookLocale,
} from '../i18n';
import type { GuestbookConfig } from '../types';

interface Options {
  /** Sprache aus der Host-Anwendung; gesetzt = gesteuerter Betrieb. */
  locale: string | undefined;
  fallbackLocale: GuestbookLocale;
  config: Pick<GuestbookConfig, 'storageNamespace' | 'persistLocale'>;
  onLocaleChange: ((locale: GuestbookLocale) => void) | undefined;
}

interface Result {
  locale: GuestbookLocale;
  setLocale: (locale: GuestbookLocale) => void;
  /** true = die Host-Anwendung bestimmt die Sprache. */
  controlled: boolean;
}

/**
 * Sprachzustand nach dem ueblichen React-Muster „controlled / uncontrolled".
 *
 * **Gesteuert** (`locale` gesetzt): die Host-Anwendung ist die einzige Quelle
 * der Wahrheit. Das Guestbook folgt jeder Aenderung und speichert nichts —
 * sonst wuerde eine alte gespeicherte Wahl beim naechsten Besuch gegen die
 * Sprache der Host-Anwendung arbeiten.
 *
 * **Ungesteuert** (`locale` fehlt): das Guestbook verwaltet die Sprache selbst
 * und merkt sie sich, falls `config.persistLocale` es erlaubt.
 *
 * Anders als in der eigenstaendigen SPA wird `navigator.language` **nicht**
 * ausgewertet — die Alt-App hatte bewusst keine Auto-Erkennung
 * (docs/legacy-architecture.md, Abschnitt 7), und in einer Host-Anwendung waere
 * sie ohnehin falsch: dort gibt es bereits eine Sprachwahl, und das Guestbook
 * soll ihr folgen statt eine zweite zu erfinden.
 */
export function useGuestbookLocale({
  locale,
  fallbackLocale,
  config,
  onLocaleChange,
}: Options): Result {
  const controlled = locale !== undefined;
  const key = storageKey(config, 'locale');

  const [ownLocale, setOwnLocale] = useState<GuestbookLocale>(() => {
    if (controlled) {
      return resolveGuestbookLocale(locale, fallbackLocale);
    }
    if (config.persistLocale) {
      try {
        const stored = window.localStorage.getItem(key);
        if (isGuestbookLocale(stored)) {
          return stored;
        }
      } catch {
        // localStorage kann blockiert sein (Privatmodus) — dann der Rueckfallwert.
      }
    }

    return fallbackLocale;
  });

  const effective = controlled ? resolveGuestbookLocale(locale, fallbackLocale) : ownLocale;

  // Gespeicherte Wahl nachziehen, wenn sie sich ungesteuert geaendert hat.
  useEffect(() => {
    if (controlled || !config.persistLocale) {
      return;
    }
    try {
      window.localStorage.setItem(key, ownLocale);
    } catch {
      // Nicht kritisch: die Wahl gilt dann nur fuer diese Sitzung.
    }
  }, [controlled, config.persistLocale, key, ownLocale]);

  const setLocale = useCallback(
    (next: GuestbookLocale) => {
      // Im gesteuerten Betrieb nur melden: die Host-Anwendung entscheidet, ob
      // und wann sie `locale` aendert. Wuerde hier zusaetzlich lokaler Zustand
      // gesetzt, blinkte die Oberflaeche bei einer abgelehnten Aenderung kurz
      // in der neuen Sprache auf.
      if (!controlled) {
        setOwnLocale(next);
      }
      onLocaleChange?.(next);
    },
    [controlled, onLocaleChange],
  );

  return { locale: effective, setLocale, controlled };
}
