import clsx from "clsx";
import type { ReactNode } from "react";
import { audio } from "@/lib/audio";

/**
 * A pressable pill. Burgundy when engaged, gold-outlined paper when not.
 *
 * The one chip in the app: the quick facets under the search bar and the craft
 * selector inside the refinement panel are the same control bound to the same
 * state, which is why they cannot drift apart.
 */
export function Chip({
  label,
  icon,
  active,
  onClick,
  size = "md",
}: {
  label: string;
  /** A small mark before the label — a flag, today. Decorative: the label
   *  still carries the meaning, so nothing is lost when there is none. */
  icon?: ReactNode;
  active: boolean;
  onClick: () => void;
  size?: "md" | "sm";
}) {
  return (
    <button
      type="button"
      onClick={() => {
        audio.click();
        onClick();
      }}
      onMouseEnter={() => audio.hover()}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border font-heading uppercase tracking-wider transition-all duration-200",
        size === "md" ? "px-3 py-1 text-[0.7rem]" : "px-2.5 py-0.5 text-[0.64rem]",
        active
          ? "border-burgundy-600 bg-burgundy-600 text-paper-50 shadow-[0_0_12px_rgba(122,31,43,0.35)]"
          : "border-gold-600/45 bg-paper-50/60 text-sepia-600 hover:border-gold-600 hover:text-ink-800",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
