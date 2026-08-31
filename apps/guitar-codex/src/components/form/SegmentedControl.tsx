import clsx from "clsx";
import { audio } from "@/lib/audio";
import { Glyph } from "@/components/Glyph";

export interface Segment<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Drawn instead of the label, which then becomes the accessible name.
   *  For choices whose words are long and whose signs are universal — the
   *  three genders spell out to 24 characters and draw in three.
   *
   *  A sign, not a word: it comes from a symbol face the platform chooses, so
   *  it is drawn through `<Glyph>` and never with a bare `font-size`. See
   *  `lib/glyph.ts` for why that distinction is load-bearing. */
  readonly icon?: string;
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
  iconSizedBy,
}: {
  value: T;
  onChange: (value: T) => void;
  segments: readonly Segment<T>[];
  labelledBy: string;
  /** One sign of the set whose ink height scales all of them, so the strip
   *  keeps the proportions the face drew rather than stretching every sign to
   *  a common height (see `Glyph`'s `sizedBy`). */
  iconSizedBy?: string;
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
            aria-label={segment.icon ? segment.label : undefined}
            title={segment.icon ? segment.label : undefined}
            className={clsx("form-segment", segment.icon && "form-segment--icon", active && "form-segment--on")}
          >
            {segment.icon ? (
              <>
                <Glyph char={segment.icon} sizedBy={iconSizedBy ?? segment.icon} size="var(--segment-icon)" />
                {/* Shown once the strip has room for a word beside the sign;
                    below that this collapses to icon-only buttons (see
                    `.form-segment--icon` / `.form-segment-text` in search.css).
                    `aria-label` above keeps the accessible name stable either
                    way, so nothing changes for a screen reader at the
                    breakpoint. */}
                <span className="form-segment-text">{segment.label}</span>
              </>
            ) : (
              segment.label
            )}
          </button>
        );
      })}
    </div>
  );
}
