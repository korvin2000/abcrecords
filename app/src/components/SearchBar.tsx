import { m } from "framer-motion";
import clsx from "clsx";
import { audio } from "@/lib/audio";
import type { SearchFilters } from "@/lib/search";
import { countryDisplay } from "@/lib/metadata";
import { typeLabel, useI18n } from "@/lib/i18n";

interface Props {
  value: string;
  onChange: (v: string) => void;
  filters: SearchFilters;
  onToggleType: (t: string) => void;
  onToggleCountry: (c: string) => void;
  types: string[];
  countries: string[];
  resultCount: number;
  totalCount: number;
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => {
        audio.click();
        onClick();
      }}
      onMouseEnter={() => audio.hover()}
      className={clsx(
        "rounded-full border px-3 py-1 font-heading text-[0.7rem] uppercase tracking-wider transition-all duration-200",
        active
          ? "border-burgundy-600 bg-burgundy-600 text-paper-50 shadow-[0_0_12px_rgba(122,31,43,0.35)]"
          : "border-gold-600/45 bg-paper-50/60 text-sepia-600 hover:border-gold-600 hover:text-ink-800",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

export function SearchBar({
  value,
  onChange,
  filters,
  onToggleType,
  onToggleCountry,
  types,
  countries,
  resultCount,
  totalCount,
}: Props) {
  const { t, locale } = useI18n();

  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.15, duration: 0.6 }}
      className="mx-auto mt-9 w-full max-w-2xl px-4"
    >
      <div className="group relative">
        {/* gold glow ring on focus */}
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-gold-500/0 via-gold-500/45 to-burgundy-500/20 opacity-0 blur transition-opacity duration-500 group-focus-within:opacity-100" />
        <div className="relative flex items-center gap-3 rounded-2xl border border-gold-600/50 bg-paper-50/85 px-4 py-3 shadow-[0_2px_12px_rgba(84,56,30,0.15)] backdrop-blur-sm transition-colors focus-within:border-gold-600">
          <svg
            className="h-5 w-5 shrink-0 text-gold-700"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              audio.type();
            }}
            placeholder={t("search.placeholder")}
            className="w-full bg-transparent font-body text-lg text-ink-900 placeholder:text-sepia-500/70 focus:outline-none"
            aria-label={t("search.placeholder")}
          />
          {value && (
            <button
              onClick={() => {
                onChange("");
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
        </div>
      </div>

      {/* facets: craft & country */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap justify-center gap-1.5">
          {types.map((ty) => (
            <Chip key={ty} label={typeLabel(t, ty)} active={filters.types.has(ty)} onClick={() => onToggleType(ty)} />
          ))}
        </div>
        {countries.length > 1 && (
          <>
            <span className="hidden text-gold-600/40 sm:inline">|</span>
            <div className="flex flex-wrap justify-center gap-1.5">
              {countries.map((c) => (
                <Chip
                  key={c}
                  label={countryDisplay(c, locale)}
                  active={filters.countries.has(c)}
                  onClick={() => onToggleCountry(c)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <p className="mt-3 text-center font-heading text-xs uppercase tracking-[0.3em] text-sepia-600/80" aria-live="polite">
        {resultCount === totalCount
          ? t("search.count", { n: totalCount })
          : t("search.countFiltered", { n: resultCount, total: totalCount })}
      </p>
    </m.div>
  );
}
