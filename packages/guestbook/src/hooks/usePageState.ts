import { useCallback, useEffect, useRef, useState } from 'react';

import { useGuestbookRuntime } from '../runtime/context';

/** Positive Ganzzahl aus einem Query-Wert lesen, mit Rueckfallwert. */
function readPage(raw: string | null, fallback: number): number {
  if (raw === null || !/^\d+$/.test(raw)) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);

  return value > 0 ? value : fallback;
}

function queryKey(prefix: string | undefined): string {
  return prefix === undefined || prefix === '' ? 'page' : `${prefix}Page`;
}

/**
 * Aktuelle Seite der Eintragsliste — je nach `routing` aus dem
 * Komponentenzustand, aus der URL oder aus der Host-Anwendung.
 *
 * Der Vorgaenger (`useQueryState`) schrieb bedingungslos per
 * `history.pushState` in die URL. Fuer eine eigenstaendige SPA war das richtig;
 * eingebettet ist es ein Uebergriff: die Browser-History gehoert der
 * Host-Anwendung, und deren Router bekaeme von einem fremden `pushState` nichts
 * mit (docs/react-modular-architecture.md, Abschnitt 17). Standard ist deshalb
 * `"memory"` — die URL bleibt unberuehrt, bis die Host-Anwendung ausdruecklich
 * etwas anderes verlangt.
 */
export function usePageState(): [number, (page: number) => void] {
  const { routing, config, rootRef } = useGuestbookRuntime();

  // Der URL-Modus liest bei jedem popstate neu; im Memory-Modus ist dieser
  // Zustand die einzige Quelle.
  const initial = routing.mode === 'memory' ? (routing.initialPage ?? 1) : 1;
  const [localPage, setLocalPage] = useState(initial);
  const [search, setSearch] = useState(() =>
    routing.mode === 'url' ? window.location.search : '',
  );

  const isUrlMode = routing.mode === 'url';
  useEffect(() => {
    if (!isUrlMode) {
      return;
    }

    const onPopState = () => setSearch(window.location.search);
    window.addEventListener('popstate', onPopState);

    return () => window.removeEventListener('popstate', onPopState);
  }, [isUrlMode]);

  const page =
    routing.mode === 'controlled'
      ? Math.max(1, Math.trunc(routing.page))
      : routing.mode === 'url'
        ? readPage(new URLSearchParams(search).get(queryKey(routing.paramPrefix)), 1)
        : localPage;

  /*
   * Scrollen nach dem Seitenwechsel. `"container"` holt den Kopf des Guestbooks
   * ins Bild statt an den Seitenanfang zu springen — in einer eingebetteten
   * Ansicht steht ueber dem Guestbook die Navigation der Host-Anwendung, und
   * dorthin zu springen waere fuer den Besucher ein Ortswechsel.
   */
  const scroll = useCallback(() => {
    if (config.scrollBehavior === 'none') {
      return;
    }
    if (config.scrollBehavior === 'window') {
      window.scrollTo({ top: 0, behavior: 'smooth' });

      return;
    }
    rootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [config.scrollBehavior, rootRef]);

  // routing kann bei jedem Render ein neues Objektliteral sein; ueber die Ref
  // bleibt `navigate` trotzdem stabil.
  const routingRef = useRef(routing);
  routingRef.current = routing;

  const navigate = useCallback(
    (target: number) => {
      const next = Math.max(1, Math.trunc(target));
      const current = routingRef.current;

      if (current.mode === 'controlled') {
        current.onPageChange(next);
      } else if (current.mode === 'url') {
        const key = queryKey(current.paramPrefix);
        const params = new URLSearchParams(window.location.search);
        if (next <= 1) {
          params.delete(key);
        } else {
          params.set(key, String(next));
        }
        const qs = params.toString();
        window.history.pushState(null, '', `${window.location.pathname}${qs === '' ? '' : `?${qs}`}`);
        setSearch(qs === '' ? '' : `?${qs}`);
      } else {
        setLocalPage(next);
      }

      scroll();
    },
    [scroll],
  );

  return [page, navigate];
}
