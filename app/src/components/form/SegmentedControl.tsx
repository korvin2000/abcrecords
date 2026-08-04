import clsx from "clsx";
import { audio } from "@/lib/audio";

export interface Segment<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * A short one-of-few choice, as an inlaid strip of buttons.
 *
 * A radio group semantically (`role="radiogroup"` + `aria-checked`) so arrow
 * keys and screen readers behave, but drawn as one continuous plaque — cheaper
 * to read at a glance than three loose chips, and there is never a hidden
 * "nothing selected" state, because "any" is one of the options.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  labelledBy,
}: {
  value: T;
  onChange: (value: T) => void;
  segments: readonly Segment<T>[];
  labelledBy: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="form-segments">
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (!active) audio.click();
              onChange(segment.value);
            }}
            onMouseEnter={() => audio.hover()}
            className={clsx("form-segment", active && "form-segment--on")}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
