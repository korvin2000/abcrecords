import { AnimatePresence, m } from "framer-motion";
import type { CatalogRecord } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";
import { CharacterCard } from "./CharacterCard";

interface Props {
  /** Already ordered: entries in the reader's language first, best match up. */
  records: CatalogRecord[];
  /** How many leading records are in the reader's language; the rest render
   *  as dimmed "found in another tongue" cards behind an ornate divider. */
  nativeCount: number;
  onSelect: (slug: string) => void;
}

const CELL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function CharacterGrid({ records, nativeCount, onSelect }: Props) {
  const { t } = useI18n();

  if (records.length === 0) {
    return (
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mt-16 max-w-md px-6 text-center">
        <div className="mb-4 text-5xl opacity-70" aria-hidden>
          🏺
        </div>
        <p className="font-display text-2xl text-burgundy-600">{t("search.empty.title")}</p>
        <p className="mt-2 font-body italic text-sepia-600">{t("search.empty.hint")}</p>
      </m.div>
    );
  }

  const hasDivider = nativeCount > 0 && nativeCount < records.length;

  const card = (record: CatalogRecord, i: number, foreign: boolean) => (
    <m.div
      key={record.slug}
      layout
      initial={{ opacity: 0, y: 36, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ duration: 0.5, ease: CELL_EASE, delay: Math.min(i, 9) * 0.045 }}
    >
      <CharacterCard record={record} foreign={foreign} eager={i < 4} onSelect={onSelect} />
    </m.div>
  );

  return (
    <m.div
      layout
      className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 pb-10 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4"
    >
      <AnimatePresence mode="popLayout">
        {records.slice(0, nativeCount).map((record, i) => card(record, i, false))}

        {hasDivider && (
          <m.div
            key="other-tongues-divider"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="col-span-2 flex items-center justify-center gap-3 py-3 sm:col-span-3 lg:col-span-4"
            role="separator"
            aria-label={t("search.otherLangs")}
          >
            <span className="h-px max-w-40 flex-1 bg-gradient-to-r from-transparent to-burgundy-500/55" aria-hidden />
            <span className="font-heading text-[0.68rem] font-bold uppercase tracking-[0.3em] text-burgundy-600/90">
              ✦ {t("search.otherLangs")} ✦
            </span>
            <span className="h-px max-w-40 flex-1 bg-gradient-to-l from-transparent to-burgundy-500/55" aria-hidden />
          </m.div>
        )}

        {records.slice(nativeCount).map((record, i) => card(record, nativeCount + i, true))}
      </AnimatePresence>
    </m.div>
  );
}
