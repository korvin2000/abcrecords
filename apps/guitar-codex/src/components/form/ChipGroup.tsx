import { Chip } from "./Chip";

/**
 * A many-of-many choice as a wrapping row of chips. Values are codes; the
 * caller supplies the localized label, because only it knows whether a code is
 * a craft, a country or something else.
 */
export function ChipGroup({
  values,
  selected,
  onToggle,
  label,
  labelledBy,
  size = "md",
}: {
  readonly values: readonly string[];
  readonly selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
  /** code → localized label. */
  label: (value: string) => string;
  labelledBy?: string;
  size?: "md" | "sm";
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <Chip
          key={value}
          label={label(value)}
          active={selected.has(value)}
          onClick={() => onToggle(value)}
          size={size}
        />
      ))}
    </div>
  );
}
