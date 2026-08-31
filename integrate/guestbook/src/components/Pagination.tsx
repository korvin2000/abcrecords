import type { Pagination as PaginationData } from '../api/types';
import { useGuestbookTranslation } from '../i18n/useGuestbookTranslation';
import styles from '../styles';

interface PaginationProps {
  pagination: PaginationData;
  onNavigate: (page: number) => void;
}

/** Anzahl Seitenzahlen links und rechts der aktuellen Seite. */
const WINDOW = 2;

export function Pagination({ pagination, onNavigate }: PaginationProps) {
  const { t } = useGuestbookTranslation();
  const { page, totalPages } = pagination;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className={styles.pagination} aria-label={t('pagination.label')}>
      <button
        type="button"
        className={styles.paginationStep}
        onClick={() => onNavigate(page - 1)}
        disabled={page <= 1}
      >
        {t('pagination.previous')}
      </button>

      <ul className={styles.paginationPages}>
        {buildPageList(page, totalPages).map((item, index) =>
          item === null ? (
            // eslint-disable-next-line react/no-array-index-key -- Ellipsen haben keine ID
            <li key={`gap-${index}`} className={styles.paginationGap} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={styles.paginationPage}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onNavigate(item)}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        className={styles.paginationStep}
        onClick={() => onNavigate(page + 1)}
        disabled={page >= totalPages}
      >
        {t('pagination.next')}
      </button>

      <span className={styles.paginationStatus} aria-live="polite">
        {t('pagination.status', { page, total: totalPages })}
      </span>
    </nav>
  );
}

/**
 * Seitenzahlen mit Auslassungen: erste Seite, ein Fenster um die aktuelle, letzte
 * Seite. Bei 26 Seiten (153 Eintraege / 6) sind das statt 26 Buttons rund sieben.
 * `null` steht fuer eine Auslassung.
 */
function buildPageList(current: number, total: number): Array<number | null> {
  const pages = new Set<number>([1, total]);
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const page = current + offset;
    if (page >= 1 && page <= total) {
      pages.add(page);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | null> = [];
  let previous: number | null = null;

  for (const page of sorted) {
    if (previous !== null && page - previous > 1) {
      result.push(null);
    }
    result.push(page);
    previous = page;
  }

  return result;
}
