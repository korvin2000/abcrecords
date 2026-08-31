import type { Entry, EntryMessengers, VisibleEntry } from '../api/types';
import { isLocked } from '../api/types';
import { useGuestbookTranslation } from '../i18n/useGuestbookTranslation';
import { useDomId, useGuestbookConfig } from '../runtime/context';
import styles, { cx } from '../styles';
import { formatCountry, formatEntryDate, toIsoDateTime } from '../utils/format';
import { CommentThread } from './CommentThread';
import { RichText } from './RichText';

const MESSENGER_ORDER: Array<keyof EntryMessengers> = [
  'icq',
  'aim',
  'msn',
  'yahoo',
  'skype',
  'jabber',
  'gaduGadu',
];

export function EntryCard({ entry }: { entry: Entry }) {
  return isLocked(entry) ? <LockedCard entry={entry} /> : <VisibleCard entry={entry} />;
}

/**
 * Platzhalter fuer einen passwortgeschuetzten Eintrag. Die API liefert dafuer
 * bewusst keinerlei Inhalt — weder Name noch Textlaenge. Das Eingabefeld fuer das
 * Passwort kommt mit T5.2.
 */
function LockedCard({ entry }: { entry: { id: number; number: number; date: string | null; time: string | null } }) {
  const { t, i18n } = useGuestbookTranslation();
  const formatted = formatEntryDate(entry.date, entry.time, i18n.language);
  const titleId = useDomId(`entry-${entry.id}-title`);

  return (
    <article className={cx(styles.entry, styles.entryLocked)} aria-labelledby={titleId}>
      <header className={styles.entryHeader}>
        <h2 className={styles.entryTitle} id={titleId}>
          {t('locked.title')}
        </h2>
        <span className={styles.entryNumber}>{t('entry.number', { number: entry.number })}</span>
      </header>
      {formatted !== null && (
        <time className={styles.entryDate} dateTime={toIsoDateTime(entry.date, entry.time)}>
          {formatted}
        </time>
      )}
      <p className={styles.entryLockedHint}>{t('locked.hint')}</p>
    </article>
  );
}

function VisibleCard({ entry }: { entry: VisibleEntry }) {
  const { t, i18n } = useGuestbookTranslation();
  const { anchorPrefix } = useGuestbookConfig();
  const formatted = formatEntryDate(entry.date, entry.time, i18n.language);
  const titleId = useDomId(`entry-${entry.id}-title`);
  const anchorId = `${anchorPrefix}${entry.id}`;
  const genderLabel =
    entry.gender === 1 ? t('entry.gender.male') : entry.gender === 2 ? t('entry.gender.female') : null;

  return (
    <article
      className={cx(styles.entry, entry.sticky && styles.entrySticky)}
      /*
       * Sprungziel fuer Direktlinks (#entry-176). Bewusst die ID und nicht die
       * laufende Nummer: die Nummer wird pro Request berechnet und verschiebt
       * sich, sobald ein Eintrag geloescht wird — als Kennung ist sie unbrauchbar.
       */
      id={anchorId}
      aria-labelledby={titleId}
    >
      <header className={styles.entryHeader}>
        <h2 className={styles.entryTitle} id={titleId}>
          {/* nameHtml, weil der Badword-Filter auch auf Namen wirkt (FILTERNAME). */}
          <RichText as="span" html={entry.nameHtml} />
          {genderLabel !== null && <span className={styles.entryGender}> · {genderLabel}</span>}
        </h2>
        <span className={styles.entryNumber}>
          {entry.sticky && <span className={styles.entryBadge}>{t('entry.sticky')}</span>}
          {/*
           * Angezeigt wird die laufende Nummer (so kennen es die Besucher aus dem
           * Alt-Gaestebuch), verlinkt wird auf die ID. Der Tooltip macht die ID
           * sichtbar — ohne sie ist nicht nachvollziehbar, welcher Datensatz
           * hinter "Nr. 151" steckt, und genau das braucht man beim Pruefen.
           */}
          <a
            className={styles.entryPermalink}
            href={`#${anchorId}`}
            title={t('entry.permalink', { id: entry.id })}
          >
            {t('entry.number', { number: entry.number })}
          </a>
        </span>
      </header>

      {formatted !== null && (
        <time className={styles.entryDate} dateTime={toIsoDateTime(entry.date, entry.time)}>
          {formatted}
        </time>
      )}

      <RichText className={styles.entryText} html={entry.textHtml} />

      {entry.picture !== null && (
        <figure className={styles.entryFigure}>
          <img
            className={styles.entryImage}
            src={entry.picture.url}
            alt={t('entry.picture')}
            loading="lazy"
          />
          {entry.picture.caption !== null && (
            <RichText as="span" className={styles.entryCaption} html={entry.picture.caption} />
          )}
        </figure>
      )}

      {entry.customFields.length > 0 && (
        <dl className={styles.entryCustom}>
          {entry.customFields.map((field) => (
            <div className={styles.entryCustomRow} key={field.fieldId}>
              <dt>{t('entry.customField', { field: field.fieldId })}</dt>
              <dd>
                <RichText as="span" html={field.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {entry.ratings.length > 0 && (
        <ul className={styles.entryRatings}>
          {entry.ratings.map((rating) => (
            <li key={rating.boxId}>
              {t('entry.rating', { box: rating.boxId })}: <strong>{rating.value}</strong>
            </li>
          ))}
        </ul>
      )}

      {entry.adminReplyHtml !== null && (
        <aside className={styles.entryAdminReply}>
          <h3 className={styles.entryAdminReplyTitle}>{t('entry.adminReply')}</h3>
          <RichText html={entry.adminReplyHtml} />
        </aside>
      )}

      <EntryMeta entry={entry} />

      <CommentThread
        entryId={entry.id}
        commentCount={entry.commentCount}
        commentsClosed={entry.commentsClosed}
      />
    </article>
  );
}

function EntryMeta({ entry }: { entry: VisibleEntry }) {
  const { t, i18n } = useGuestbookTranslation();

  const messengers = MESSENGER_ORDER.filter((key) => entry.messengers[key] !== undefined);
  const client = entry.client;
  const clientLabel =
    client === null
      ? null
      : [client.browser, client.os].filter((part): part is string => part !== null).join(' · ');

  return (
    <footer className={styles.entryMeta}>
      {entry.country !== null && (
        <span className={styles.entryMetaItem}>
          {entry.country.flagUrl !== null && (
            <img className={styles.entryFlag} src={entry.country.flagUrl} alt="" width={18} height={12} />
          )}
          {formatCountry(
            entry.country.code,
            entry.country.translate,
            i18n.language,
            t('entry.countryUnspecified'),
          )}
        </span>
      )}

      {entry.email !== null && (
        <a className={styles.entryMetaItem} href={`mailto:${entry.email}`}>
          {t('entry.email')}
        </a>
      )}

      {entry.homepage !== null && (
        <a
          className={styles.entryMetaItem}
          href={entry.homepage.url}
          target="_blank"
          rel="nofollow noopener noreferrer"
        >
          {entry.homepage.label}
        </a>
      )}

      {messengers.map((key) => (
        <span className={styles.entryMetaItem} key={key}>
          {t(`entry.messenger.${key}`)}: {entry.messengers[key]}
        </span>
      ))}

      <span className={styles.entryMetaItem}>
        {entry.commentCount > 0 ? t('entry.comments', { count: entry.commentCount }) : t('entry.commentsNone')}
        {entry.commentsClosed && ` · ${t('entry.commentsClosed')}`}
      </span>

      {clientLabel !== null && clientLabel !== '' && (
        <span className={cx(styles.entryMetaItem, styles.entryMetaItemMuted)}>
          {t('entry.client')}: {clientLabel}
        </span>
      )}
    </footer>
  );
}
