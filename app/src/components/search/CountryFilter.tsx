import { useMemo, useState } from "react";
import clsx from "clsx";
import { FLAG_SELECTION } from "@/config";
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
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : t("facet.country.group")}
      /* Open, this used to be every nation in the catalogue in one unbounded
         block — six rows of flags on a phone. `.country-row--open` caps it and
         gives it its own scroll (search.css). */
      className={clsx("country-row", expanded && "country-row--open")}
      /* Which of the four selection marks is drawn (config.ts). The row, not
         the flag, carries it: the gap between flags has to reserve room for
         whichever mark is in use, and only the row can set a gap. */
      data-select={FLAG_SELECTION}
    >
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
               adding more colour to one — it is signalled first by taking it
               away from the others. An unchosen flag is dimmed and desaturated;
               a chosen one stands at full strength and takes whichever mark
               `FLAG_SELECTION` names. The look lives entirely in search.css so
               that the mark, and the gap that makes room for it, are written
               next to each other. */
            className={clsx("country-flag", on ? "country-flag--on" : "country-flag--off")}
          >
            {hasCountryFlag(code) ? (
              <CountryFlag code={code} className="h-full w-full" />
            ) : (
              <span className="country-flag-code">{code}</span>
            )}
          </button>
        );
      })}

      {(hidden > 0 || expanded) && (
        /* A toggle, not a one-way door: the row could be opened and never shut
           again, which on a phone left the whole catalogue's flags standing
           between the search box and the first card. The glyph carries the
           state visually and `aria-expanded` carries it to a screen reader, so
           no new string is needed in ten dictionaries. */
        <button
          type="button"
          onClick={() => {
            audio.click();
            setExpanded((was) => !was);
          }}
          onMouseEnter={() => audio.hover()}
          aria-expanded={expanded}
          aria-label={t("facet.country.group")}
          className="country-flag country-flag--more"
        >
          {expanded ? "−" : `+${hidden}`}
        </button>
      )}
    </div>
  );
}

/** Flags shown before the tail is folded away — about two rows on a phone. */
const COMPACT_COUNT = 18;
