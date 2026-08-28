import { useMemo, useState } from "react";
import clsx from "clsx";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { countryName } from "@/lib/metadata";
import { CountryFlag, hasCountryFlag } from "@/components/CountryFlag";

/**
 * The country facet as a row of flags.
 *
 * Fifty-one countries as text chips is a wall: three or four lines of prose in
 * a control that exists to be glanced at, and — because the labels are
 * localized — a wall that changes width with the reader's language. Flags are
 * the same information in a fixed 26×17 box each, read at a glance, and they
 * carry the catalogue's antique-atlas character rather than fighting it.
 *
 * What text still does better is *naming*, so the name is never lost: it is
 * the tooltip, the accessible label, and — with the count beside it — what a
 * screen reader announces. A code with no drawn flag falls back to its ISO
 * letters rather than vanishing from the facet.
 *
 * The row opens compact. Fifty flags is six rows on a phone, which is more
 * than a facet may take from the catalogue itself, so it shows the best
 * represented nations first and hides the tail behind a counter. Anything the
 * reader has actually selected is always visible, whatever the tail says —
 * a filter you cannot see is a filter you cannot undo.
 */
export function CountryFilter({
  values,
  counts,
  selected,
  onToggle,
  labelledBy,
}: {
  /** ISO 3166-1 alpha-2 codes present in the catalogue. */
  readonly values: readonly string[];
  /** code → how many listed entries carry it; drives the order. */
  readonly counts: ReadonlyMap<string, number>;
  readonly selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
  labelledBy?: string;
}) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);

  // Most represented first: with no labels to read, alphabetical order is
  // invisible, while "which nations is this catalogue actually made of" is
  // exactly the question a flag row can answer at a glance.
  const ordered = useMemo(() => {
    const collator = new Intl.Collator(locale);
    return [...values].sort(
      (a, b) =>
        (counts.get(b) ?? 0) - (counts.get(a) ?? 0) ||
        collator.compare(countryName(a, locale) ?? a, countryName(b, locale) ?? b),
    );
  }, [values, counts, locale]);

  const shown = useMemo(
    () =>
      expanded
        ? ordered
        : ordered.filter((code, i) => i < COMPACT_COUNT || selected.has(code)),
    [ordered, expanded, selected],
  );

  const hidden = ordered.length - shown.length;

  return (
    <div role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : t("facet.country.group")} className="flex flex-wrap items-center justify-center gap-1.5">
      {shown.map((code) => {
        const name = countryName(code, locale) ?? code;
        const n = counts.get(code) ?? 0;
        const on = selected.has(code);
        return (
          <button
            key={code}
            type="button"
            onClick={() => {
              audio.click();
              onToggle(code);
            }}
            onMouseEnter={() => audio.hover()}
            aria-pressed={on}
            title={`${name} · ${n}`}
            aria-label={`${name} · ${n}`}
            /* Flags are already colourful, so selection cannot be signalled by
               adding more colour to one — it is signalled by taking it away
               from the others. An unchosen flag is dimmed and desaturated; a
               chosen one stands at full strength, a little larger, ringed and
               lifted. The difference reads at a glance across a row of fifty. */
            className={clsx(
              "relative grid h-[1.45rem] w-[2.15rem] place-items-center overflow-hidden rounded-[0.2rem] border transition-all duration-200",
              on
                ? "z-10 scale-[1.18] border-burgundy-600 shadow-[0_0_0_1px_#7a1f2b,0_3px_10px_rgba(122,31,43,0.45)]"
                : "border-gold-600/35 opacity-55 saturate-[0.7] hover:border-gold-600 hover:opacity-100 hover:saturate-100",
            )}
          >
            {hasCountryFlag(code) ? (
              <CountryFlag code={code} className="h-full w-full" />
            ) : (
              <span className="font-heading text-[0.55rem] font-bold tracking-wide text-sepia-600">
                {code}
              </span>
            )}
          </button>
        );
      })}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => {
            audio.click();
            setExpanded(true);
          }}
          onMouseEnter={() => audio.hover()}
          className="h-[1.45rem] rounded-full border border-gold-600/45 bg-paper-50/60 px-2 font-heading text-[0.6rem] font-bold uppercase tracking-wider text-sepia-600 transition-colors hover:border-gold-600 hover:text-ink-800"
        >
          +{hidden}
        </button>
      )}
    </div>
  );
}

/** Flags shown before the tail is folded away — about two rows on a phone. */
const COMPACT_COUNT = 18;
