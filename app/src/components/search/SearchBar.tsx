import { useCallback, useId, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { FEATURES } from "@/config";
import { audio } from "@/lib/audio";
import { useDismissOnOutside } from "@/lib/dismiss";
import { typeLabel, useI18n } from "@/lib/i18n";
import { refinementCount, toggleValue, type SearchCriteria } from "@/lib/search";
import { ChipGroup } from "@/components/form";
import { ClefSpinner } from "@/components/fx";
import { AdvancedSearchPanel } from "./AdvancedSearchPanel";
import { CountryFilter } from "./CountryFilter";
import { AdvancedToggle } from "./AdvancedToggle";
import type { DossierStatus } from "./DossierProgress";

interface Props {
  criteria: SearchCriteria;
  /** Partial update — the panel and the chips both narrow the same value. */
  onPatch: (patch: Partial<SearchCriteria>) => void;
  /** Drop every refinement, keeping what is typed in the box. */
  onReset: () => void;
  readonly types: readonly string[];
  /** ISO 3166-1 alpha-2 codes present in the catalogue. */
  readonly countries: readonly string[];
  /** code → how many listed entries carry it; orders the flag row. */
  readonly countryCounts: ReadonlyMap<string, number>;
  resultCount: number;
  totalCount: number;
  dossier: DossierStatus;
}

/**
 * The search bar: the turning clef and the name box, the quick facet chips,
 * and the handle to the refinement panel.
 *
 * The bar owns exactly one piece of state — whether the panel is open. Every
 * *criterion* lives above it in `App`, so the chips here and the controls in
 * the panel are two views of one value and cannot drift. The chips stay for the
 * one-click case; the panel is the complete form.
 */
export function SearchBar({
  criteria,
  onPatch,
  onReset,
  types,
  countries,
  countryCounts,
  resultCount,
  totalCount,
  dossier,
}: Props) {
  const { t } = useI18n();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const panelId = useId();

  const close = useCallback(() => setAdvancedOpen(false), []);
  const shellRef = useDismissOnOutside<HTMLDivElement>(advancedOpen, close);

  const refinements = refinementCount(criteria);

  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.15, duration: 0.6 }}
      className="mx-auto mt-9 w-full max-w-2xl px-4"
    >
      {/* the box and its panel share one shell, so a click on the handle is
          never read as a click outside the panel */}
      <div ref={shellRef} className="relative">
        <div className="group relative">
          {/* gold glow ring on focus */}
          <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-gold-500/0 via-gold-500/45 to-burgundy-500/20 opacity-0 blur transition-opacity duration-500 group-focus-within:opacity-100" />
          <div className="relative flex items-center gap-3 rounded-2xl border border-gold-600/50 bg-paper-50/85 px-4 py-3 shadow-[0_2px_12px_rgba(84,56,30,0.15)] backdrop-blur-sm transition-colors focus-within:border-gold-600">
            <ClefSpinner />
            <input
              value={criteria.query}
              onChange={(e) => {
                onPatch({ query: e.target.value });
                audio.type();
              }}
              placeholder={t("search.placeholder")}
              className="w-full bg-transparent font-body text-lg text-ink-900 placeholder:text-sepia-500/70 focus:outline-none"
              aria-label={t("search.placeholder")}
            />
            {criteria.query && (
              <button
                onClick={() => {
                  onPatch({ query: "" });
                  audio.click();
                }}
                className="rounded-full p-1 text-sepia-500 transition-colors hover:text-burgundy-600"
                aria-label={t("search.clear")}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {FEATURES.advancedSearch && (
              <AdvancedToggle
                open={advancedOpen}
                onToggle={() => setAdvancedOpen((o) => !o)}
                panelId={panelId}
                count={refinements}
              />
            )}
          </div>
        </div>

        {FEATURES.advancedSearch && (
          <AnimatePresence>
            {advancedOpen && (
              <div className="absolute inset-x-0 top-full z-40 pt-2">
                <AdvancedSearchPanel
                  id={panelId}
                  criteria={criteria}
                  onPatch={onPatch}
                  onReset={onReset}
                  onClose={close}
                  types={types}
                  countries={countries}
                  dossier={dossier}
                />
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* quick facets: craft as words, country as flags */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <ChipGroup
          values={types}
          selected={criteria.types}
          onToggle={(value) => onPatch({ types: toggleValue(criteria.types, value) })}
          label={(value) => typeLabel(t, value)}
        />
      </div>

      {countries.length > 1 && (
        <div className="mt-3">
          <CountryFilter
            values={countries}
            counts={countryCounts}
            selected={criteria.countries}
            onToggle={(value) => onPatch({ countries: toggleValue(criteria.countries, value) })}
          />
        </div>
      )}

      <p className="mt-3 text-center font-heading text-xs uppercase tracking-[0.3em] text-sepia-600/80" aria-live="polite">
        {resultCount === totalCount
          ? t("search.count", { n: totalCount })
          : t("search.countFiltered", { n: resultCount, total: totalCount })}
      </p>
    </m.div>
  );
}
