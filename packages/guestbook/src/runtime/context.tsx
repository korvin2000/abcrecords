import { createContext, useContext, type ReactNode, type RefObject } from 'react';

import type { GuestbookApi } from '../api/guestbookApi';
import type { ResolvedGuestbookConfig } from '../config/defaults';
import type {
  GuestbookCommentPostedEvent,
  GuestbookEntrySubmittedEvent,
  GuestbookErrorContext,
  GuestbookRouting,
} from '../types';

/**
 * Alles, was jede Komponente im Guestbook-Teilbaum ueber ihre Instanz wissen
 * muss.
 *
 * Als Kontext und nicht als Props, weil sonst jeder Wert durch vier Ebenen
 * gereicht werden muesste (GuestbookApp -> EntryList -> EntryCard ->
 * CommentThread -> CommentForm). Der Kontext bleibt package-intern; die
 * Host-Anwendung sieht nur `GuestbookProps`.
 */
export interface GuestbookRuntime {
  config: ResolvedGuestbookConfig;
  api: GuestbookApi;

  /**
   * Praefix fuer DOM-`id`s. Aus `useId()` der Instanz, damit zwei Guestbooks
   * auf einer Seite — oder ein Host mit gleichnamigen ids — keine kaputten
   * label/htmlFor-Paare erzeugen.
   */
  idPrefix: string;

  /** Wurzelelement, u. a. um beim Seitenwechsel dorthin zu scrollen. */
  rootRef: RefObject<HTMLElement | null>;

  /** Woher die Seitenzahl kommt und wohin sie geschrieben wird. */
  routing: GuestbookRouting;

  onError?: ((error: unknown, context: GuestbookErrorContext) => void) | undefined;
  onEntrySubmitted?: ((event: GuestbookEntrySubmittedEvent) => void) | undefined;
  onCommentPosted?: ((event: GuestbookCommentPostedEvent) => void) | undefined;
}

const GuestbookRuntimeContext = createContext<GuestbookRuntime | null>(null);

export function GuestbookRuntimeProvider({
  value,
  children,
}: {
  value: GuestbookRuntime;
  children: ReactNode;
}) {
  return (
    <GuestbookRuntimeContext.Provider value={value}>{children}</GuestbookRuntimeContext.Provider>
  );
}

export function useGuestbookRuntime(): GuestbookRuntime {
  const runtime = useContext(GuestbookRuntimeContext);
  if (runtime === null) {
    throw new Error(
      'Guestbook-Komponenten benoetigen <GuestbookApp> als Vorfahren. ' +
        'Einzelne Komponenten des Packages sind kein oeffentlicher Einstiegspunkt.',
    );
  }

  return runtime;
}

export function useGuestbookApi(): GuestbookApi {
  return useGuestbookRuntime().api;
}

export function useGuestbookConfig(): ResolvedGuestbookConfig {
  return useGuestbookRuntime().config;
}

/** Eindeutige DOM-`id` fuer ein Formularfeld dieser Instanz. */
export function useDomId(name: string): string {
  return `${useGuestbookRuntime().idPrefix}${name}`;
}
