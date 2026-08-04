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

  return (
    <div className="flex items-center gap-2" role="group" aria-labelledby={labelledBy}>
      <span className="font-body text-[0.78rem] italic text-sepia-500">{fromLabel}</span>
      <div className="w-[4.8rem]">
        <TextField
          value={value.from}
          onChange={set("from")}
          labelledBy={labelledBy}
          placeholder="1885"
          inputMode="numeric"
          maxLength={4}
          className="text-center"
        />
      </div>
      <span className="font-body text-[0.78rem] italic text-sepia-500">{toLabel}</span>
      <div className="w-[4.8rem]">
        <TextField
          value={value.to}
          onChange={set("to")}
          labelledBy={labelledBy}
          placeholder="1944"
          inputMode="numeric"
          maxLength={4}
          className="text-center"
        />
      </div>
    </div>
  );
}
