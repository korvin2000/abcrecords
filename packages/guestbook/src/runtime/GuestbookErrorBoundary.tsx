import { Component, type ErrorInfo, type ReactNode } from 'react';

import { staticText, type GuestbookLocale } from '../i18n';
import type { GuestbookErrorContext } from '../types';
import styles, { cx } from '../styles';

interface Props {
  locale: GuestbookLocale;
  children: ReactNode;
  /** Eigene Fehlerdarstellung der Host-Anwendung. */
  fallback?: ReactNode;
  onError?: ((error: unknown, context: GuestbookErrorContext) => void) | undefined;
}

interface State {
  failed: boolean;
}

/**
 * Fehlergrenze um den gesamten Guestbook-Teilbaum.
 *
 * Pflicht fuer ein eingebettetes Feature: ohne sie reisst ein Fehler im
 * Guestbook — ein unerwartetes API-Feld, ein kaputtes Bild-Rendering — die
 * gesamte Host-Anwendung mit in einen weissen Bildschirm
 * (docs/react-modular-architecture.md, Abschnitt 18). Die Host-Anwendung darf
 * eine eigene Fehlergrenze darum legen; diese hier ist die letzte Verteidigung
 * innerhalb des Packages.
 *
 * Die Meldung kommt aus `staticText()` und nicht aus i18next: die Fehlergrenze
 * muss auch dann noch etwas Lesbares anzeigen, wenn der i18next-Aufbau selbst
 * der Grund fuer den Fehler war.
 */
export class GuestbookErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, {
      source: 'render',
      componentStack: info.componentStack ?? undefined,
    });
  }

  private readonly retry = (): void => {
    this.setState({ failed: false });
  };

  override render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }

    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    const { locale } = this.props;

    return (
      <div className={cx(styles.status, styles.statusError)} role="alert">
        <p>{staticText(locale, 'error.crashed')}</p>
        <button type="button" className={styles.button} onClick={this.retry}>
          {staticText(locale, 'error.crashedAction')}
        </button>
      </div>
    );
  }
}
