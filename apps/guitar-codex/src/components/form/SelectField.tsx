import { audio } from "@/lib/audio";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/**
 * A one-of-many field over a native `<select>`.
 *
 * Native on purpose: the country list grows with the catalogue, and the
 * platform's own picker beats any hand-rolled listbox on a phone, on a
 * keyboard and with a screen reader alike. Only the closed control is
 * restyled (`.form-ink` + `appearance: none` + a drawn chevron); the open
 * list stays the operating system's, which is the right trade.
 */
export function SelectField({
  value,
  onChange,
  options,
  labelledBy,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  labelledBy: string;
  /** Label for the "no choice" option, which carries the empty value. */
  placeholder: string;
}) {
  return (
    <div className="form-select-shell">
      <select
        value={value}
        onChange={(e) => {
          audio.click();
          onChange(e.target.value);
        }}
        aria-labelledby={labelledBy}
        className="form-ink form-select"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg className="form-select-chevron" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        <path d="M1 1l4 4 4-4" />
      </svg>
    </div>
  );
}
