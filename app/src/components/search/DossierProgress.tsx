import { useI18n } from "@/lib/i18n";

export interface DossierStatus {
  /** True when a criterion is being answered from the dossiers. */
  readonly active: boolean;
  /** 0…1 of the listed catalogue read so far. */
  readonly progress: number;
  readonly done: boolean;
}

/**
 * Why the result list is still settling.
 *
 * Name and year criteria are answered from each entry's `*.bio.json`, which is
 * read in the background — so until the crawl finishes the list is *narrower*
 * than the truth, never wider. Saying so out loud is the honest alternative to
 * blocking the page behind a spinner: the reader can watch it fill in.
 */
export function DossierProgress({ status }: { status: DossierStatus }) {
  const { t } = useI18n();
  if (!status.active || status.done) return null;

  const percent = Math.round(status.progress * 100);

  return (
    <p
      className="flex items-center gap-2 font-heading text-[0.62rem] uppercase tracking-[0.18em] text-sepia-500"
      role="status"
    >
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-gold-600/40 border-t-gold-600" aria-hidden />
      {t("search.dossier.progress", { n: percent })}
    </p>
  );
}
