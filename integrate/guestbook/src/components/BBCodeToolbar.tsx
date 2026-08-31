import type { FormConfig } from '../api/types';
import { useGuestbookTranslation } from '../i18n/useGuestbookTranslation';
import styles from '../styles';

interface BBCodeToolbarProps {
  bbcode: FormConfig['text']['bbcode'];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}

/**
 * Werkzeugleiste fuer BBCode auf einem gewoehnlichen Textarea.
 *
 * Die Alt-App nutzte einen `contentEditable`/`designMode`-Iframe als
 * WYSIWYG-Editor und liess `libs/rtf.php::vgb_RTFdecode()` dessen HTML wieder in
 * BBCode zuruecksetzen. Dieser Umweg entfaellt hier vollstaendig: der Besucher
 * bearbeitet direkt BBCode, gespeichert wird genau das, und die Vorschau kommt
 * vom Server — also mit demselben Renderer, der auch die Liste erzeugt.
 *
 * Angezeigt werden nur Tags, die `SETTINGS.BBCODEMASK` freigibt. Bei dieser
 * Installation sind das b, i, u, url, color und size.
 */
export function BBCodeToolbar({ bbcode, textareaRef, onChange }: BBCodeToolbarProps) {
  const { t } = useGuestbookTranslation();

  if (!bbcode.enabled || bbcode.tags.length === 0) {
    return null;
  }

  /** Umschliesst die Auswahl mit einem Tag und setzt den Cursor sinnvoll. */
  const wrap = (open: string, close: string) => {
    const textarea = textareaRef.current;
    if (textarea === null) {
      return;
    }

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = value.slice(0, selectionStart) + open + selected + close + value.slice(selectionEnd);

    onChange(next);

    // Nach dem Re-Render die Auswahl wiederherstellen bzw. den Cursor zwischen
    // die Tags setzen, damit man direkt weiterschreiben kann.
    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (element === null) {
        return;
      }
      element.focus();
      const caret = selectionStart + open.length;
      element.setSelectionRange(caret, caret + selected.length);
    });
  };

  const simpleTags = bbcode.tags.filter((tag) =>
    ['b', 'i', 'u', 'code', 'quote', 'left', 'center', 'right', 'list'].includes(tag),
  );

  const [sizeMin, sizeMax] = bbcode.sizeRange;
  const sizes: number[] = [];
  for (let size = sizeMin; size <= sizeMax; size++) {
    sizes.push(size);
  }

  return (
    <div className={styles.toolbar} role="group" aria-label={t('form.toolbar.label')}>
      {simpleTags.map((tag) => (
        <button
          key={tag}
          type="button"
          className={styles.toolbarButton}
          title={t(`form.toolbar.${tag}`)}
          onClick={() => wrap(`[${tag}]`, `[/${tag}]`)}
        >
          {tag.toUpperCase()}
        </button>
      ))}

      {bbcode.tags.includes('url') && (
        <button
          type="button"
          className={styles.toolbarButton}
          title={t('form.toolbar.url')}
          onClick={() => {
            // Ziel-URL erfragen: [url=…] braucht zwingend einen Wert, ein blankes
            // [url] unterstuetzt der Server nicht (so wie die Alt-App auch nicht).
            const target = window.prompt(t('form.toolbar.urlPrompt'), 'https://');
            if (target !== null && target.trim() !== '') {
              wrap(`[url=${target.trim()}]`, '[/url]');
            }
          }}
        >
          {t('form.toolbar.urlShort')}
        </button>
      )}

      {bbcode.tags.includes('color') && bbcode.namedColors.length > 0 && (
        <label className={styles.toolbarSelect}>
          <span className={styles.visuallyHidden}>{t('form.toolbar.color')}</span>
          <select
            defaultValue=""
            onChange={(event) => {
              const color = event.target.value;
              event.currentTarget.value = '';
              if (color !== '') {
                wrap(`[color=${color}]`, '[/color]');
              }
            }}
          >
            <option value="">{t('form.toolbar.color')}</option>
            {bbcode.namedColors.map((color) => (
              <option key={color.name} value={color.name}>
                {color.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {bbcode.tags.includes('size') && sizes.length > 0 && (
        <label className={styles.toolbarSelect}>
          <span className={styles.visuallyHidden}>{t('form.toolbar.size')}</span>
          <select
            defaultValue=""
            onChange={(event) => {
              const size = event.target.value;
              event.currentTarget.value = '';
              if (size !== '') {
                wrap(`[size=${size}]`, '[/size]');
              }
            }}
          >
            <option value="">{t('form.toolbar.size')}</option>
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
