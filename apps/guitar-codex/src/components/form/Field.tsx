import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * A labelled row in a codex form: small-caps label, the control, an optional
 * hint underneath.
 *
 * The label is a `<span>` and the association is left to the caller's
 * `aria-labelledby`/`htmlFor`, because the controls here are of three
 * different shapes — a native input, a native select and a group of buttons —
 * and only the first two can be wrapped in a `<label>` honestly.
 */
export function Field({
  id,
  label,
  hint,
  className,
  children,
}: {
  /** Id of the label element, for the control's `aria-labelledby`. */
  id: string;
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx("flex flex-col gap-[0.15rem]", className)}>
      <span
        id={id}
        className="font-heading text-[0.56rem] font-bold uppercase tracking-[0.18em] text-sepia-600"
      >
        {label}
      </span>
      {children}
      {hint && <span className="font-body text-[0.72rem] italic leading-snug text-sepia-500">{hint}</span>}
    </div>
  );
}
