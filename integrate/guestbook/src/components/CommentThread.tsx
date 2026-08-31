import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import type { CommentListResponse } from '../api/types';
import { useGuestbookTranslation } from '../i18n/useGuestbookTranslation';
import { useDomId, useGuestbookRuntime } from '../runtime/context';
import styles, { cx } from '../styles';
import { formatEntryDate, toIsoDateTime } from '../utils/format';
import { CommentForm } from './CommentForm';
import { RichText } from './RichText';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: CommentListResponse };

interface CommentThreadProps {
  entryId: number;
  commentCount: number;
  commentsClosed: boolean;
}

/**
 * Kommentar-Thread: Anzeige, Aufklappen und Antwortformular.
 *
 * Vorhandene Kommentare werden erst beim Aufklappen geladen — bei sechs
 * Eintraegen pro Seite waeren sonst sechs zusaetzliche Requests faellig, von denen
 * die meisten niemand ansieht. Die Anzahl steht ohnehin schon in der Eintragsliste.
 */
export function CommentThread({ entryId, commentCount, commentsClosed }: CommentThreadProps) {
  const { t, i18n } = useGuestbookTranslation();
  const { api, onError } = useGuestbookRuntime();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  /*
   * Abhaengigkeiten sind ausschliesslich [open, entryId, reloadToken] — NICHT der
   * eigene Zustand. Stand hier `state.status` mit drin, loeste das erste
   * setState('loading') einen erneuten Effektlauf aus, dessen Cleanup
   * `controller.abort()` genau den gerade gestarteten Request abbrach: der Thread
   * blieb dauerhaft auf "wird geladen".
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    api
      .fetchComments(entryId, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        // Abbruch durch das Cleanup ist kein Fehlerfall (passiert u. a. bei
        // React StrictMode, das Effekte in der Entwicklung doppelt ausfuehrt).
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setState({ status: 'error' });
        onError?.(error, { source: 'api' });
        if (!(error instanceof ApiError)) {
          console.error(error);
        }
      });

    return () => controller.abort();
  }, [api, onError, open, entryId, reloadToken]);

  const handlePosted = useCallback(() => {
    // Thread aufklappen (falls er es nicht war) und neu laden, damit der eigene
    // Kommentar sofort sichtbar ist.
    setOpen(true);
    setReloadToken((token) => token + 1);
  }, []);

  const panelId = useDomId(`comments-${entryId}`);
  const hasComments = commentCount > 0;

  return (
    <section className={styles.comments}>
      <div className={styles.commentsActions}>
        {hasComments && (
          <button
            type="button"
            className={styles.commentsToggle}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? t('comments.hide') : t('comments.show', { count: commentCount })}
          </button>
        )}

        {commentsClosed ? (
          <span className={styles.commentsClosed}>{t('entry.commentsClosed')}</span>
        ) : (
          <CommentForm entryId={entryId} onPosted={handlePosted} />
        )}
      </div>

      {open && (
        <div className={styles.commentsPanel} id={panelId}>
          {state.status === 'loading' && (
            <p className={styles.commentsStatus} role="status">
              {t('comments.loading')}
            </p>
          )}

          {state.status === 'error' && (
            <p className={cx(styles.commentsStatus, styles.commentsStatusError)} role="alert">
              {t('comments.error')}
            </p>
          )}

          {state.status === 'ready' && state.data.items.length === 0 && (
            <p className={styles.commentsStatus}>{t('entry.commentsNone')}</p>
          )}

          {state.status === 'ready' &&
            state.data.items.map((comment) => {
              const formatted = formatEntryDate(comment.date, comment.time, i18n.language);

              return (
                <article
                  className={cx(styles.comment, comment.isAdmin && styles.commentAdmin)}
                  key={comment.id}
                >
                  <header className={styles.commentHeader}>
                    <RichText as="span" className={styles.commentName} html={comment.nameHtml} />
                    {comment.isAdmin && <span className={styles.commentBadge}>{t('comments.admin')}</span>}
                    {formatted !== null && (
                      <time
                        className={styles.commentDate}
                        dateTime={toIsoDateTime(comment.date, comment.time)}
                      >
                        {formatted}
                      </time>
                    )}
                  </header>
                  <RichText className={styles.commentText} html={comment.textHtml} />
                </article>
              );
            })}
        </div>
      )}
    </section>
  );
}
