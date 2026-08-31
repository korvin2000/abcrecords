import type { YearRange } from "@/lib/search";
import { TextField } from "./TextField";

const YEAR_INPUT = /^\d{0,4}$/;

/**
 * A "from … to" pair of year boxes.
 *
 * Text inputs rather than `type="number"`: spinners and locale-dependent
 * grouping have no business on a year, and `inputMode="numeric"` still brings
 * up the digit keypad on a phone. Anything that is not up to four digits is
 * refused at the keystroke, so the search never has to interpret half a year —
 * an empty end simply means "open", and a reversed pair is read the way it was
 * meant (see `compile` in lib/search/criteria.ts).
 *
 * The boxes are narrowed by their wrappers, not by a class on the input: see
 * the note in TextField.
 *
 * `.form-ink--figures` is what makes a year sit level in its box — Cormorant's
 * default figures are *oldstyle*, and half of them hang below the baseline. See
 * the rule in search.css.
 */
export function YearRangeField({
  value,
  onChange,
  labelledBy,
  fromLabel,
  toLabel,
}: {
  value: YearRange;
  onChange: (range: YearRange) => void;
  labelledBy: string;
  fromLabel: string;
  toLabel: string;
}) {
  const set = (key: keyof YearRange) => (next: string) => {
    if (YEAR_INPUT.test(next)) onChange({ ...value, [key]: next });
  };

  // The boxes share whatever the row has instead of claiming a fixed 4 rem
  // each: that is what lets the two year ranges sit side by side on a phone
  // (`min-w-0 flex-1`, capped so they do not sprawl on a wide panel).
  const box = "min-w-0 flex-1 max-w-[4.75rem]";

  return (
    <div className="flex items-center gap-1.5" role="group" aria-labelledby={labelledBy}>
      <span className="shrink-0 font-body text-[0.72rem] italic text-sepia-500">{fromLabel}</span>
      <div className={box}>
        <TextField
          value={value.from}
          onChange={set("from")}
          labelledBy={labelledBy}
          placeholder="1885"
          inputMode="numeric"
          maxLength={4}
          className="form-ink--figures text-center"
        />
      </div>
      <span className="shrink-0 font-body text-[0.72rem] italic text-sepia-500">{toLabel}</span>
      <div className={box}>
        <TextField
          value={value.to}
          onChange={set("to")}
          labelledBy={labelledBy}
          placeholder="1944"
          inputMode="numeric"
          maxLength={4}
          className="form-ink--figures text-center"
        />
      </div>
    </div>
  );
}
