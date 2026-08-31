import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import type { EntryListResponse } from '../api/types';
import { usePageState } from '../hooks/usePageState';
import { useGuestbookTranslation } from '../i18n/useGuestbookTranslation';
import { useGuestbookRuntime } from '../runtime/context';
import styles, { cx } from '../styles';
import { EntryCard } from './EntryCard';
import { Pagination } from './Pagination';

type State =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: EntryListResponse };

export function EntryList() {
  const { t } = useGuestbookTranslation();
  const { api, onError } = useGuestbookRuntime();
  const [page, navigate] = usePageState();

  const [state, setState] = useState<State>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    api
      .fetchEntries({ page }, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        // Abbruch durch Cleanup ist kein Fehlerfall.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setState({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError(0, 'unknown', String(error)),
        });
        onError?.(error, { source: 'api' });
      });

    return () => controller.abort();
  }, [api, onError, page, reloadToken]);

  if (state.status === 'loading') {
    return (
      <p className={cx(styles.status, styles.statusLoading)} role="status">
        {t('list.loading')}
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={cx(styles.status, styles.statusError)} role="alert">
        <p>{t(errorMessageKey(state.error))}</p>
        {state.error.isRetryable && (
          <button
            type="button"
            className={styles.button}
            onClick={() => setReloadToken((n) => n + 1)}
          >
            {t('list.retry')}
          </button>
        )}
      </div>
    );
  }

  const { items, pagination } = state.data;

  if (items.length === 0) {
    return (
      <p className={cx(styles.status, styles.statusEmpty)} role="status">
        {t('list.empty')}
      </p>
    );
  }

  return (
    <>
      <p className={styles.listTotal}>{t('list.total', { count: pagination.total })}</p>

      <div className={styles.list}>
        {items.map((entry) => (
          <EntryCard entry={entry} key={entry.id} />
        ))}
      </div>

      <Pagination pagination={pagination} onNavigate={navigate} />
    </>
  );
}

/**
 * Fehlercode der API auf einen Uebersetzungsschluessel abbilden.
 *
 * Die `message` der API ist deutsch und fuer Entwickler gedacht — dem Besucher
 * wird sie nie gezeigt. Deshalb liefert diese Funktion einen Schluessel und nicht
 * den fertigen Text: so bleibt die Uebersetzung dort, wo sie hingehoert (im JSX),
 * und die Funktion bleibt unabhaengig von i18next.
 */
function errorMessageKey(error: ApiError): string {
  switch (error.code) {
    case 'banned':
      return 'error.banned';
    case 'network_error':
    case 'invalid_response':
      return 'error.network';
    default:
      return 'list.error';
  }
}
