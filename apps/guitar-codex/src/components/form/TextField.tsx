import clsx from "clsx";
import { audio } from "@/lib/audio";

/**
 * A single-line ink field: aged paper, a gold hairline that warms on focus.
 * Controlled — the panel owns every value, so the search state stays one object.
 *
 * The field always fills its container: `.form-ink` sets `width: 100%`, and
 * that rule is unlayered, so it would beat any Tailwind `w-*` utility put on
 * the input itself. Narrow it by sizing the wrapper, never the input.
 */
export function TextField({
  value,
  onChange,
  labelledBy,
  placeholder,
  className,
  inputMode,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
  placeholder?: string;
  className?: string;
  inputMode?: "text" | "numeric";
  maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        audio.type();
      }}
      aria-labelledby={labelledBy}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      className={clsx("form-ink", className)}
    />
  );
}
