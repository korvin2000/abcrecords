import { AnimatePresence, m } from "framer-motion";
import type { SearchDoc } from "@/lib/search";
import { useI18n } from "@/lib/i18n";
import { CharacterCard } from "./CharacterCard";

interface Props {
  docs: SearchDoc[];
  rankings: ReadonlyMap<string, number>;
  onSelect: (slug: string) => void;
}

export function CharacterGrid({ docs, rankings, onSelect }: Props) {
  const { t } = useI18n();

  if (docs.length === 0) {
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

  return (
    <m.div
      layout
      className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 pb-10 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4"
    >
      <AnimatePresence mode="popLayout">
        {docs.map((doc, i) => (
          <m.div
            key={doc.slug}
            layout
            initial={{ opacity: 0, y: 36, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, delay: Math.min(i, 9) * 0.045, ease: [0.22, 1, 0.36, 1] }}
          >
            <CharacterCard entry={doc.entry} slug={doc.slug} ranking={rankings.get(doc.slug)} onSelect={onSelect} />
          </m.div>
        ))}
      </AnimatePresence>
    </m.div>
  );
}
