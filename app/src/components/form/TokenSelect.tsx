import { useMemo, type ReactNode } from "react";
import { Chip } from "./Chip";
import { SelectField } from "./SelectField";

/**
 * A many-of-many choice over a list too long for chips: what is chosen shows
 * as removable tokens, and the picker below offers only what is left.
 *
 * This is the shape that survives the catalogue growing. Craft has five values
 * and belongs in a `ChipGroup`; country already has dozens and will have a
 * hundred, at which point a wall of chips stops being a control and the
 * platform's own picker starts being the fastest way in.
 */
export function TokenSelect({
  selected,
  values,
  onToggle,
  label,
  icon,
  labelledBy,
  placeholder,
}: {
  readonly selected: ReadonlySet<string>;
  /** Every selectable code, in the order the caller wants them offered. */
  readonly values: readonly string[];
  onToggle: (value: string) => void;
  /** code → localized label. */
  label: (value: string) => string;
  /** code → a small decorative mark for the chosen token (a flag, today). */
  icon?: (value: string) => ReactNode;
  labelledBy: string;
  /** Label of the picker's idle option ("Any country"). */
  placeholder: string;
}) {
  const chosen = useMemo(() => values.filter((v) => selected.has(v)), [values, selected]);
  const offered = useMemo(
    () => values.filter((v) => !selected.has(v)).map((value) => ({ value, label: label(value) })),
    [values, selected, label],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {chosen.length > 0 && (
        <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
          {chosen.map((value) => (
            <Chip
              key={value}
              label={`${label(value)} ✕`}
              icon={icon?.(value)}
              active
              onClick={() => onToggle(value)}
              size="sm"
            />
          ))}
        </div>
      )}
      {offered.length > 0 && (
        <SelectField
          value=""
          onChange={onToggle}
          options={offered}
          labelledBy={labelledBy}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
