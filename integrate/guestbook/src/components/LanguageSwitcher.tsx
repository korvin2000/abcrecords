import { GUESTBOOK_LOCALES, type GuestbookLocale } from '../i18n';
import { useGuestbookTranslation } from '../i18n/useGuestbookTranslation';
import { useDomId } from '../runtime/context';
import styles from '../styles';

interface LanguageSwitcherProps {
  /**
   * Meldet die Wahl an GuestbookApp. Die Komponente aendert die Sprache nicht
   * mehr selbst (frueher: `i18n.changeLanguage`) — im gesteuerten Betrieb
   * entscheidet die Host-Anwendung, ob die Wahl uebernommen wird.
   */
  onSelect: (locale: GuestbookLocale) => void;
}

/** Sprachumschalter. Aendert die Sprache sofort und ohne Neuladen. */
export function LanguageSwitcher({ onSelect }: LanguageSwitcherProps) {
  const { t, i18n } = useGuestbookTranslation();
  const current = i18n.language as GuestbookLocale;
  const labelId = useDomId('language-label');

  return (
    <div className={styles.languageSwitcher}>
      <span className={styles.languageSwitcherLabel} id={labelId}>
        {t('language.label')}
      </span>
      <div className={styles.languageSwitcherOptions} role="group" aria-labelledby={labelId}>
        {GUESTBOOK_LOCALES.map((language) => (
          <button
            key={language}
            type="button"
            className={styles.languageSwitcherOption}
            aria-pressed={language === current}
            onClick={() => onSelect(language)}
          >
            {t(`language.${language}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
