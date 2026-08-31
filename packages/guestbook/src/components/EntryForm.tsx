import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import type {
  CaptchaChallenge,
  Country,
  CustomFieldConfig,
  EntryDraft,
  FieldErrors,
  FormConfig,
} from '../api/types';
import { useDraftStorage } from '../hooks/useDraftStorage';
import { useGuestbookTranslation } from '../i18n/useGuestbookTranslation';
import { useDomId, useGuestbookRuntime } from '../runtime/context';
import styles, { cx } from '../styles';
import { formatCountry } from '../utils/format';
import { BBCodeToolbar } from './BBCodeToolbar';
import { RichText } from './RichText';

/** Messenger-Felder in der Reihenfolge, in der sie im Formular erscheinen. */
const MESSENGER_KEYS = ['icq', 'aim', 'msn', 'yahoo', 'skype', 'jabber', 'gaduGadu'] as const;

/** Diese Felder werden fuer 30 Tage gemerkt — Text und Geheimnisse nicht. */
const PERSISTED_KEYS = [
  'name',
  'email',
  'homepage',
  'country',
  'gender',
  'hideEmail',
  ...MESSENGER_KEYS,
] as const;

type DraftState = EntryDraft;

const EMPTY_DRAFT: DraftState = { name: '', text: '', website: '' };

interface EntryFormProps {
  /** Wird nach erfolgreichem Absenden aufgerufen, damit die Liste neu laedt. */
  onSubmitted: () => void;
}

export function EntryForm({ onSubmitted }: EntryFormProps) {
  const { t, i18n } = useGuestbookTranslation();
  const { api, onEntrySubmitted, onError } = useGuestbookRuntime();

  /*
   * Praefix aller DOM-ids dieses Formulars. Frueher standen dort feste Werte
   * ("gb-name", "gb-text"): eingebettet reicht das nicht, weil die
   * Host-Anwendung dieselben ids vergeben kann und label/htmlFor dann auf das
   * falsche Feld zeigt.
   */
  const fieldId = useDomId('');
  const titleId = useDomId('entry-form-title');

  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [setupFailed, setSetupFailed] = useState(false);
  /** Hochzaehlen laedt die Setup-Daten erneut (Knopf „Erneut versuchen"). */
  const [setupAttempt, setSetupAttempt] = useState(0);

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'submit' | null>(null);
  const [success, setSuccess] = useState<{ id: number; moderated: boolean } | null>(null);
  /** Hochgeladenes Bild: Vorschau-URL und Maße, sobald der Server es annahm. */
  const [picture, setPicture] = useState<{ url: string; width: number; height: number } | null>(null);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const persistDraft = useDraftStorage<DraftState>((values) => {
    setDraft((current) => ({ ...current, ...values }));
  });

  /** Sprache der Laendersortierung: COUNTRYORDER nutzt die Alt-Sprachnamen. */
  const orderLanguage = { ru: 'Russian', en: 'English', de: 'German' }[i18n.language] ?? 'English';

  // --- Setup beim Aufklappen ------------------------------------------------
  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();

    Promise.all([
      api.fetchFormConfig(controller.signal),
      api.fetchCountries(orderLanguage, controller.signal),
      api.fetchCsrfToken(controller.signal),
      api.fetchCaptcha(controller.signal),
    ])
      .then(([formConfig, countryList, csrf, challenge]) => {
        setConfig(formConfig);
        setCountries(countryList.items);
        setCsrfToken(csrf.token);
        setCaptcha(challenge);
        setSetupFailed(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        // Dem Besucher hilft die technische Meldung nicht (sie ist deutsch und
        // fuer Entwickler gedacht), beim Aufsetzen aber sehr — daher in die
        // Konsole. Typischer Fall: APP_SECRET fehlt in der .env, dann liefern
        // /csrf-token und /captcha einen 500.
        console.error('Formular-Setup fehlgeschlagen:', error);
        setSetupFailed(true);
        onError?.(error, { source: 'api' });
      });

    return () => controller.abort();
  }, [api, onError, open, orderLanguage, setupAttempt]);

  /** Nach einem verbrauchten Captcha ein frisches Bild holen. */
  const refreshCaptcha = useCallback(() => {
    api
      .fetchCaptcha()
      .then((challenge) => {
        setCaptcha(challenge);
        setDraft((current) => ({ ...current, captchaAnswer: '' }));
      })
      .catch(() => {
        /* Beim naechsten Absenden wird es erneut versucht. */
      });
  }, [api]);

  const update = useCallback(<K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // Fehler des bearbeiteten Feldes verschwindet sofort — sonst steht die
    // Meldung noch da, waehrend man sie gerade behebt.
    setFieldErrors((current) => {
      if (current[key as string] === undefined) {
        return current;
      }
      const next = { ...current };
      delete next[key as string];

      return next;
    });
  }, []);

  const buildPayload = (): EntryDraft => {
    const payload: EntryDraft = { ...draft };
    if (captcha?.required === true && captcha.token !== undefined) {
      payload.captchaToken = captcha.token;
    }

    return payload;
  };

  /** Feldfehler aus einer 422-Antwort uebernehmen, sonst allgemeine Meldung. */
  const handleApiError = (error: unknown): void => {
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
        // Ein abgelaufenes Token laesst sich still erneuern.
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
      case 'spam_detected':
        setFormError(t('form.error.spam'));
        break;
      case 'banned':
        setFormError(t('error.banned'));
        break;
      default:
        setFormError(t('form.error.unknown'));
    }
  };

  /**
   * Bild direkt bei der Auswahl hochladen, nicht erst beim Absenden.
   *
   * So sieht der Besucher sofort, ob die Datei akzeptiert wird — und nicht erst,
   * nachdem er das ganze Formular ausgefuellt hat. Der Server legt sie in
   * upload/preview/ ab und uebernimmt sie beim Absenden.
   */
  const handlePictureSelect = async (file: File | null) => {
    setPictureError(null);

    if (file === null || csrfToken === null) {
      return;
    }

    setPictureBusy(true);
    try {
      const uploaded = await api.uploadPicture(file, csrfToken);
      setPicture({ url: uploaded.url, width: uploaded.width, height: uploaded.height });
      update('picture', uploaded.filename);
    } catch (error) {
      setPicture(null);
      update('picture', undefined);

      if (error instanceof ApiError && config !== null) {
        switch (error.code) {
          case 'picture_too_large':
            setPictureError(
              t('form.error.pictureTooLarge', {
                max: Math.round(config.picture.maxFileSize / 1024),
              }),
            );
            break;
          case 'picture_dimensions':
            setPictureError(
              t('form.error.pictureDimensions', {
                maxWidth: config.picture.maxWidth,
                maxHeight: config.picture.maxHeight,
              }),
            );
            break;
          case 'picture_type':
          case 'picture_invalid':
            setPictureError(t('form.error.pictureType'));
            break;
          default:
            setPictureError(t('form.error.pictureUpload'));
        }
      } else {
        setPictureError(t('form.error.pictureUpload'));
      }
    } finally {
      setPictureBusy(false);
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
      const response = await api.previewEntry(buildPayload(), csrfToken);
      setPreviewHtml(response.preview.textHtml);
    } catch (error) {
      setPreviewHtml(null);
      handleApiError(error);
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
      const response = await api.submitEntry(buildPayload(), csrfToken);

      // Stammdaten merken, Text und Geheimnisse nicht.
      const persisted: Partial<DraftState> = {};
      for (const key of PERSISTED_KEYS) {
        const value = draft[key];
        if (value !== undefined && value !== '') {
          (persisted as Record<string, unknown>)[key] = value;
        }
      }
      persistDraft(persisted);

      setSuccess({ id: response.id, moderated: response.moderated });
      setPreviewHtml(null);
      setDraft((current) => ({ ...current, text: '', captchaAnswer: '' }));
      onEntrySubmitted?.({ id: response.id, moderated: response.moderated });
      onSubmitted();
    } catch (error) {
      handleApiError(error);
    } finally {
      setBusy(null);
    }
  };

  // --- Darstellung ----------------------------------------------------------

  if (!open) {
    return (
      <div className={styles.formLauncher}>
        <button type="button" className={styles.button} onClick={() => setOpen(true)}>
          {t('form.open')}
        </button>
      </div>
    );
  }

  if (setupFailed) {
    return (
      <div className={cx(styles.status, styles.statusError)} role="alert">
        <p>{t('form.error.setup')}</p>
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setSetupFailed(false);
              setSetupAttempt((attempt) => attempt + 1);
            }}
          >
            {t('list.retry')}
          </button>
          <button type="button" className={cx(styles.button, styles.buttonSecondary)} onClick={() => setOpen(false)}>
            {t('form.close')}
          </button>
        </div>
      </div>
    );
  }

  if (config === null) {
    return (
      <p className={cx(styles.status, styles.statusLoading)} role="status">
        {t('form.loading')}
      </p>
    );
  }

  const fields = config.fields;
  const errorFor = (key: string): string | null =>
    fieldErrors[key] === undefined ? null : t(`form.fieldError.${fieldErrors[key]}`);

  return (
    <section className={styles.formSection} aria-labelledby={titleId}>
      <div className={styles.formSectionHeader}>
        <h2 className={styles.formSectionTitle} id={titleId}>
          {t('form.title')}
        </h2>
        <button type="button" className={styles.formSectionClose} onClick={() => setOpen(false)}>
          {t('form.close')}
        </button>
      </div>

      {success !== null && (
        <p className={cx(styles.status, styles.statusSuccess)} role="status">
          {success.moderated
            ? t('form.success.moderated')
            : t('form.success.published', { number: success.id })}
        </p>
      )}

      {config.moderation.enabled && success === null && (
        <p className={styles.formNotice}>{t('form.moderationHint')}</p>
      )}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError !== null && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <Field
          id={`${fieldId}name`}
          label={t('form.field.name')}
          required
          error={errorFor('name')}
          maxLength={fields['name']?.maxLength}
        >
          <input
            id={`${fieldId}name`}
            type="text"
            value={draft.name}
            maxLength={fields['name']?.maxLength}
            required
            aria-invalid={fieldErrors['name'] !== undefined}
            onChange={(event) => update('name', event.target.value)}
          />
        </Field>

        {fields['email']?.enabled === true && (
          <Field
            id={`${fieldId}email`}
            label={t('form.field.email')}
            required={fields['email'].required}
            error={errorFor('email')}
          >
            <input
              id={`${fieldId}email`}
              type="email"
              value={draft.email ?? ''}
              maxLength={fields['email'].maxLength}
              aria-invalid={fieldErrors['email'] !== undefined}
              onChange={(event) => update('email', event.target.value)}
            />
          </Field>
        )}

        {fields['hideEmail']?.enabled === true && (
          <label className={styles.formCheckbox}>
            <input
              type="checkbox"
              checked={draft.hideEmail === true}
              onChange={(event) => update('hideEmail', event.target.checked)}
            />
            {t('form.field.hideEmail')}
          </label>
        )}

        {fields['homepage']?.enabled === true && (
          <Field
            id={`${fieldId}homepage`}
            label={t('form.field.homepage')}
            error={errorFor('homepage')}
            hint={t('form.hint.homepage')}
          >
            <input
              id={`${fieldId}homepage`}
              type="text"
              inputMode="url"
              value={draft.homepage ?? ''}
              maxLength={fields['homepage'].maxLength}
              aria-invalid={fieldErrors['homepage'] !== undefined}
              onChange={(event) => update('homepage', event.target.value)}
            />
          </Field>
        )}

        {fields['country']?.enabled === true && (
          <Field
            id={`${fieldId}country`}
            label={t('form.field.country')}
            required={fields['country'].required}
            error={errorFor('country')}
          >
            <select
              id={`${fieldId}country`}
              value={draft.country ?? ''}
              aria-invalid={fieldErrors['country'] !== undefined}
              onChange={(event) =>
                update('country', event.target.value === '' ? '' : Number(event.target.value))
              }
            >
              <option value="">{t('form.field.countryNone')}</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {formatCountry(
                    country.code,
                    country.translate,
                    i18n.language,
                    t('entry.countryUnspecified'),
                  )}
                </option>
              ))}
            </select>
          </Field>
        )}

        {fields['gender']?.enabled === true && (
          <Field
            id={`${fieldId}gender`}
            label={t('form.field.gender')}
            required={fields['gender'].required}
            error={errorFor('gender')}
          >
            <select
              id={`${fieldId}gender`}
              value={draft.gender ?? 0}
              aria-invalid={fieldErrors['gender'] !== undefined}
              onChange={(event) => update('gender', Number(event.target.value))}
            >
              <option value={0}>{t('form.field.genderNone')}</option>
              <option value={1}>{t('entry.gender.male')}</option>
              <option value={2}>{t('entry.gender.female')}</option>
            </select>
          </Field>
        )}

        {MESSENGER_KEYS.filter((key) => fields[key]?.enabled === true).map((key) => (
          <Field key={key} id={`${fieldId}${key}`} label={t(`entry.messenger.${key}`)} error={errorFor(key)}>
            <input
              id={`${fieldId}${key}`}
              type="text"
              inputMode={fields[key]?.numeric === true ? 'numeric' : 'text'}
              value={draft[key] ?? ''}
              maxLength={fields[key]?.maxLength}
              aria-invalid={fieldErrors[key] !== undefined}
              onChange={(event) => update(key, event.target.value)}
            />
          </Field>
        ))}

        <Field
          id={`${fieldId}text`}
          label={t('form.field.text')}
          required
          error={errorFor('text')}
          hint={
            fields['text']?.maxLength !== undefined && fields['text'].maxLength > 0
              ? t('form.hint.maxChars', {
                  used: draft.text.length,
                  max: fields['text'].maxLength,
                })
              : undefined
          }
        >
          <BBCodeToolbar
            bbcode={config.text.bbcode}
            textareaRef={textareaRef}
            onChange={(value) => update('text', value)}
          />
          <textarea
            id={`${fieldId}text`}
            ref={textareaRef}
            rows={8}
            value={draft.text}
            maxLength={fields['text']?.maxLength}
            required
            aria-invalid={fieldErrors['text'] !== undefined}
            onChange={(event) => update('text', event.target.value)}
          />
        </Field>

        {config.ratingBoxes.map((box) => (
          <Field
            key={box.id}
            id={`${fieldId}rating-${box.id}`}
            label={box.formText !== '' ? box.formText : box.name}
            required={box.required}
            error={errorFor(`rating.${box.id}`)}
          >
            <select
              id={`${fieldId}rating-${box.id}`}
              value={draft.ratings?.[box.id] ?? ''}
              onChange={(event) =>
                update('ratings', {
                  ...(draft.ratings ?? {}),
                  [box.id]: Number(event.target.value),
                })
              }
            >
              <option value="">{t('form.field.ratingNone')}</option>
              {Array.from({ length: box.maxValue }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        ))}

        {config.customFields.map((field) => (
          <CustomField
            key={field.id}
            field={field}
            value={draft.customFields?.[field.id] ?? field.default ?? ''}
            error={errorFor(`custom.${field.id}`)}
            onChange={(value) =>
              update('customFields', { ...(draft.customFields ?? {}), [field.id]: value })
            }
          />
        ))}

        {config.picture.enabled && (
          <div className={cx(styles.formField, pictureError !== null && styles.formFieldInvalid)}>
            <label className={styles.formLabel} htmlFor={`${fieldId}picture`}>
              {t('form.field.picture')}
            </label>
            <input
              id={`${fieldId}picture`}
              type="file"
              accept={config.picture.allowedTypes.join(',')}
              disabled={pictureBusy}
              onChange={(event) => void handlePictureSelect(event.target.files?.[0] ?? null)}
            />
            <p className={styles.formHint}>
              {t('form.hint.picture', {
                maxWidth: config.picture.maxWidth,
                maxHeight: config.picture.maxHeight,
                maxKb: Math.round(config.picture.maxFileSize / 1024),
              })}
            </p>
            {pictureBusy && <p className={styles.formHint}>{t('form.uploading')}</p>}
            {pictureError !== null && (
              <p className={styles.formFieldError} role="alert">
                {pictureError}
              </p>
            )}
            {picture !== null && (
              <div className={styles.formPicture}>
                <img src={picture.url} alt={t('entry.picture')} />
                <span className={styles.formHint}>
                  {picture.width} × {picture.height}
                </span>
                <button
                  type="button"
                  className={styles.formSectionClose}
                  onClick={() => {
                    setPicture(null);
                    update('picture', undefined);
                  }}
                >
                  {t('form.field.pictureRemove')}
                </button>
              </div>
            )}
          </div>
        )}

        {fields['pictureCaption']?.enabled === true && (
          <Field
            id={`${fieldId}piccaption`}
            label={t('form.field.pictureCaption')}
            error={errorFor('pictureCaption')}
          >
            <input
              id={`${fieldId}piccaption`}
              type="text"
              value={draft.pictureCaption ?? ''}
              maxLength={fields['pictureCaption'].maxLength}
              onChange={(event) => update('pictureCaption', event.target.value)}
            />
          </Field>
        )}

        {fields['private']?.enabled === true && (
          <Field
            id={`${fieldId}private`}
            label={t('form.field.private')}
            error={errorFor('private')}
            hint={t('form.hint.private')}
          >
            <input
              id={`${fieldId}private`}
              type="text"
              value={draft.private ?? ''}
              maxLength={fields['private'].maxLength}
              aria-invalid={fieldErrors['private'] !== undefined}
              onChange={(event) => update('private', event.target.value)}
            />
          </Field>
        )}

        {captcha?.required === true && captcha.image !== undefined && (
          <Field id={`${fieldId}captcha`} label={t('form.field.captcha')} required error={errorFor('captcha')}>
            <div className={styles.captcha}>
              <img className={styles.captchaImage} src={captcha.image} alt={t('form.field.captchaAlt')} />
              <button type="button" className={styles.captchaReload} onClick={refreshCaptcha}>
                {t('form.field.captchaReload')}
              </button>
            </div>
            <input
              id={`${fieldId}captcha`}
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={draft.captchaAnswer ?? ''}
              onChange={(event) => update('captchaAnswer', event.target.value)}
            />
          </Field>
        )}

        {/*
         * Honeypot. Fuer Menschen unsichtbar und fuer Screenreader ausgeblendet,
         * fuer einfache Bots aber ein normales Eingabefeld. Ist es ausgefuellt,
         * lehnt der Server ab. tabIndex={-1} verhindert, dass man per Tabulator
         * hineinspringt.
         */}
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor={`${fieldId}website`}>Website</label>
          <input
            id={`${fieldId}website`}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={draft.website ?? ''}
            onChange={(event) => update('website', event.target.value)}
          />
        </div>

        {previewHtml !== null && (
          <div className={styles.formPreview}>
            <h3 className={styles.formPreviewTitle}>{t('form.previewTitle')}</h3>
            <RichText className={styles.entryText} html={previewHtml} />
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
            {busy === 'submit' ? t('form.busy') : t('form.submit')}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string | undefined;
  maxLength?: number | undefined;
  children: React.ReactNode;
}

/** Einheitliches Feld-Gerüst: Label, Eingabe, Hinweis, Fehlermeldung. */
function Field({ id, label, required = false, error = null, hint, children }: FieldProps) {
  return (
    <div className={cx(styles.formField, error !== null && styles.formFieldInvalid)}>
      <label className={styles.formLabel} htmlFor={id}>
        {label}
        {required && <span className={styles.formRequired} aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint !== undefined && <p className={styles.formHint}>{hint}</p>}
      {error !== null && (
        <p className={styles.formFieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface CustomFieldProps {
  field: CustomFieldConfig;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}

/** Admin-konfiguriertes Zusatzfeld — Typ und Regeln kommen aus form-config. */
function CustomField({ field, value, error, onChange }: CustomFieldProps) {
  const id = useDomId(`custom-${field.id}`);
  const label = field.formText !== '' ? field.formText : field.name;

  return (
    <Field id={id} label={label} required={field.required} error={error}>
      {field.type === 'select' ? (
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">—</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === 'number' ? (
        <input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.multiline ? (
        <textarea
          id={id}
          rows={3}
          maxLength={field.maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type="text"
          maxLength={field.maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
