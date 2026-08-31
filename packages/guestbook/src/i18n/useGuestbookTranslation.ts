import { useTranslation } from 'react-i18next';

import { GUESTBOOK_I18N_NAMESPACE } from './locales';

/**
 * Einziger Zugang zu den Texten dieses Packages.
 *
 * Alle Komponenten benutzen diesen Hook statt `useTranslation()` direkt: der
 * Namensraum steht damit an genau einer Stelle. Ausserdem waere ein blankes
 * `useTranslation()` in einer eingebetteten Anwendung gefaehrlich — findet
 * react-i18next keinen `<I18nextProvider>` im Teilbaum, greift es auf die
 * globale Standardinstanz zurueck, also auf die der Host-Anwendung.
 */
export function useGuestbookTranslation() {
  return useTranslation(GUESTBOOK_I18N_NAMESPACE);
}
