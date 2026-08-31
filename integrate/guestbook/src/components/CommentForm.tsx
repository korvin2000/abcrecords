import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import type { CaptchaChallenge, CommentDraft, FieldErrors } from '../api/types';
import { useGuestbookTranslation } from '../i18n/useGuestbookTranslation';
import { useDomId, useGuestbookRuntime } from '../runtime/context';
import styles, { cx } from '../styles';
import { RichText } from './RichText';

interface CommentFormProps {
  entryId: number;
  /** Nach erfolgreichem Posten: Thread neu laden. */
  onPosted: () => void;
}

const EMPTY: CommentDraft = { name: '', text: '', website: '' };

/**
 * Kommentarformular direkt am Thread.
 *
 * Bewusst schlanker als das Eintragsformular: die COMMENT-Tabelle hat nur Name,
 * Text und optional eine E-Mail. Kein BBCode-Werkzeug — Kommentare sind kurz, und
 * BBCode wird trotzdem serverseitig gerendert, wer will kann es also tippen.
 *
 * CSRF-Token und Captcha holt die Komponente selbst, sobald das Formular
 * aufgeklappt wird. Sie teilt sich diesen Zustand nicht mit dem Eintragsformular:
 * eine Captcha-Challenge ist einmalig, ein gemeinsamer Vorrat wuerde bedeuten,
 * dass ein Eintrag die Challenge des Kommentars verbraucht.
 */
export function CommentForm({ entryId, onPosted }: CommentFormProps) {
  const { t } = useGuestbookTranslation();
  const { api, onCommentPosted, onError } = useGuestbookRuntime();

  // Eindeutige DOM-ids: mehrere Kommentarformulare stehen gleichzeitig auf der
  // Seite, und die Host-Anwendung kann eigene Felder mit denselben Namen haben.
  const nameId = useDomId(`cname-${entryId}`);
  const mailId = useDomId(`cmail-${entryId}`);
  const textId = useDomId(`ctext-${entryId}`);
  const captchaId = useDomId(`ccaptcha-${entryId}`);
  const websiteId = useDomId(`cwebsite-${entryId}`);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CommentDraft>(EMPTY);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [setupFailed, setSetupFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'submit' | null>(null);
  const [posted, setPosted] = useState<{ moderated: boolean } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();

    Promise.all([api.fetchCsrfToken(controller.signal), api.fetchCaptcha(controller.signal)])
      .then(([csrf, challenge]) => {
        setCsrfToken(csrf.token);
        setCaptcha(challenge);
        setSetupFailed(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Kommentarformular-Setup fehlgeschlagen:', error);
        setSetupFailed(true);
        onError?.(error, { source: 'api' });
      });

    return () => controller.abort();
  }, [api, onError, open]);

  const refreshCaptcha = useCallback(() => {
    api
      .fetchCaptcha()
      .then((challenge) => {
        setCaptcha(challenge);
        setDraft((current) => ({ ...current, captchaAnswer: '' }));
      })
      .catch(() => {
        /* Beim naechsten Absenden erneut versuchen. */
      });
  }, [api]);

  const update = <K extends keyof CommentDraft>(key: K, value: CommentDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (current[key as string] === undefined) {
        return current;
      }
      const next = { ...current };
      delete next[key as string];

      return next;
    });
  };

  const payload = (): CommentDraft => {
    const body: CommentDraft = { ...draft };
    if (captcha?.required === true && captcha.token !== undefined) {
      body.captchaToken = captcha.token;
    }

    return body;
  };

  const handleError = (error: unknown): void => {
    onError?.(error, { source: 'api' });

    if (!(error instanceof ApiError)) {
      setFormError(t('form.error.unknown'));

      return;
    }

    if (error.code === 'validation_failed') {
      const fields = error.details['fields'];
      setFieldErrors(typeof fields === 'object' && fields !== null ? (fields as FieldErrors) : {});
      setFormError(t('form.error.validation'));

      return;
    }

    switch (error.code) {
      case 'csrf_missing':
      case 'csrf_invalid':
        setFormError(t('form.error.csrf'));
        api
          .fetchCsrfToken()
          .then((csrf) => setCsrfToken(csrf.token))
          .catch(() => setSetupFailed(true));
        break;
      case 'captcha_wrong':
      case 'captcha_invalid':
      case 'captcha_expired':
      case 'captcha_required':
        setFormError(t(`form.error.${error.code}`));
        refreshCaptcha();
        break;
      case 'rate_limited': {
        const seconds = error.details['retryAfterSeconds'];
        setFormError(
          t('form.error.rateLimited', { seconds: typeof seconds === 'number' ? seconds : 60 }),
        );
        break;
      }
      case 'comments_closed':
        setFormError(t('entry.commentsClosed'));
        break;
      case 'comments_disabled':
        setFormError(t('comments.disabled'));
        break;
      case 'spam_detected':
        setFormError(t('form.error.spam'));
        break;
      default:
        setFormError(t('form.error.unknown'));
    }
  };

  const handlePreview = async () => {
    if (csrfToken === null) {
      return;
    }
    setBusy('preview');
    setFormError(null);
    setFieldErrors({});

    try {
      const response = await api.previewComment(entryId, payload(), csrfToken);
      setPreviewHtml(response.preview.textHtml);
    } catch (error) {
      setPreviewHtml(null);
      handleError(error);
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (csrfToken === null) {
      return;
    }
    setBusy('submit');
    setFormError(null);
    setFieldErrors({});

    try {
      const response = await api.submitComment(entryId, payload(), csrfToken);
      setPosted({ moderated: response.moderated });
      setPreviewHtml(null);
      setDraft((current) => ({ ...current, text: '', captchaAnswer: '' }));
      onCommentPosted?.({ entryId, moderated: response.moderated });
      // Nur neu laden, wenn der Kommentar auch sichtbar ist — im
      // Moderationsmodus waere ein Reload wirkungslos und verwirrend.
      if (response.visible) {
        onPosted();
      }
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(null);
    }
  };

  if (!open) {
    return (
      <button type="button" className={styles.commentsReply} onClick={() => setOpen(true)}>
        {t('comments.write')}
      </button>
    );
  }

  if (setupFailed) {
    return (
      <p className={cx(styles.commentsStatus, styles.commentsStatusError)} role="alert">
        {t('form.error.setup')}
      </p>
    );
  }

  const errorFor = (key: string): string | null =>
    fieldErrors[key] === undefined ? null : t(`form.fieldError.${fieldErrors[key]}`);

  return (
    <form className={styles.commentForm} onSubmit={handleSubmit} noValidate>
      {posted !== null && (
        <p className={cx(styles.status, styles.statusSuccess)} role="status">
          {posted.moderated ? t('comments.success.moderated') : t('comments.success.published')}
        </p>
      )}

      {formError !== null && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}

      <div className={styles.commentFormRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel} htmlFor={nameId}>
            {t('form.field.name')}
            <span className={styles.formRequired} aria-hidden="true"> *</span>
          </label>
          <input
            id={nameId}
            type="text"
            value={draft.name}
            required
            aria-invalid={fieldErrors['name'] !== undefined}
            onChange={(event) => update('name', event.target.value)}
          />
          {errorFor('name') !== null && (
            <p className={styles.formFieldError} role="alert">
              {errorFor('name')}
            </p>
          )}
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel} htmlFor={mailId}>
            {t('form.field.email')}
          </label>
          <input
            id={mailId}
            type="email"
            value={draft.email ?? ''}
            aria-invalid={fieldErrors['email'] !== undefined}
            onChange={(event) => update('email', event.target.value)}
          />
          {errorFor('email') !== null && (
            <p className={styles.formFieldError} role="alert">
              {errorFor('email')}
            </p>
          )}
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel} htmlFor={textId}>
          {t('form.field.text')}
          <span className={styles.formRequired} aria-hidden="true"> *</span>
        </label>
        <textarea
          id={textId}
          rows={4}
          value={draft.text}
          required
          aria-invalid={fieldErrors['text'] !== undefined}
          onChange={(event) => update('text', event.target.value)}
        />
        {errorFor('text') !== null && (
          <p className={styles.formFieldError} role="alert">
            {errorFor('text')}
          </p>
        )}
      </div>

      {captcha?.required === true && captcha.image !== undefined && (
        <div className={styles.formField}>
          <label className={styles.formLabel} htmlFor={captchaId}>
            {t('form.field.captcha')}
            <span className={styles.formRequired} aria-hidden="true"> *</span>
          </label>
          <div className={styles.captcha}>
            <img className={styles.captchaImage} src={captcha.image} alt={t('form.field.captchaAlt')} />
            <button type="button" className={styles.captchaReload} onClick={refreshCaptcha}>
              {t('form.field.captchaReload')}
            </button>
          </div>
          <input
            id={captchaId}
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={draft.captchaAnswer ?? ''}
            onChange={(event) => update('captchaAnswer', event.target.value)}
          />
        </div>
      )}

      {/* Honeypot, siehe EntryForm. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={websiteId}>Website</label>
        <input
          id={websiteId}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={draft.website ?? ''}
          onChange={(event) => update('website', event.target.value)}
        />
      </div>

      {previewHtml !== null && (
        <div className={styles.formPreview}>
          <h4 className={styles.formPreviewTitle}>{t('form.previewTitle')}</h4>
          <RichText className={styles.commentText} html={previewHtml} />
        </div>
      )}

      <div className={styles.formActions}>
        <button
          type="button"
          className={cx(styles.button, styles.buttonSecondary)}
          disabled={busy !== null}
          onClick={handlePreview}
        >
          {busy === 'preview' ? t('form.busy') : t('form.preview')}
        </button>
        <button type="submit" className={styles.button} disabled={busy !== null}>
          {busy === 'submit' ? t('form.busy') : t('comments.submit')}
        </button>
        <button
          type="button"
          className={styles.formSectionClose}
          onClick={() => {
            setOpen(false);
            setPreviewHtml(null);
            setFormError(null);
          }}
        >
          {t('form.close')}
        </button>
      </div>
    </form>
  );
}
