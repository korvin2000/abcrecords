import clsx from "clsx";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";

/**
 * The handle that opens the refinement panel — a disclosure button, not a
 * menu: `aria-expanded` + `aria-controls` tell assistive tech exactly what it
 * reveals, and focus stays here so the reader tabs into the panel.
 *
 * The badge is the point of the control: with the panel shut, it is the only
 * sign that something other than the typed name is narrowing the results.
 */
export function AdvancedToggle({
  open,
  onToggle,
  panelId,
  count,
}: {
  open: boolean;
  onToggle: () => void;
  panelId: string;
  /** Active refinements; 0 hides the badge. */
  count: number;
}) {
  const { t } = useI18n();
  const title = open ? t("search.advanced.hide") : t("search.advanced");

  return (
    <button
      type="button"
      onClick={() => {
        audio.click();
        onToggle();
      }}
      onMouseEnter={() => audio.hover()}
      aria-expanded={open}
      aria-controls={panelId}
      title={title}
      aria-label={count ? `${title} · ${t("search.refinements", { n: count })}` : title}
      className={clsx(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all duration-200",
        open || count
          ? "border-gold-600/80 bg-gold-500/20 text-burgundy-700"
          : "border-gold-600/40 text-sepia-600 hover:border-gold-600/75 hover:bg-gold-500/12 hover:text-ink-800",
      )}
    >
      {/* three sliders — a filter, drawn in the same hairline as the loupe */}
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
        <path d="M4 7h11M18.5 7H20M4 12h4M11.5 12H20M4 17h9M16.5 17H20" />
        <circle cx="16.5" cy="7" r="1.9" />
        <circle cx="9.5" cy="12" r="1.9" />
        <circle cx="14.5" cy="17" r="1.9" />
      </svg>
      {count > 0 && (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-burgundy-600 px-1 font-heading text-[0.6rem] font-bold text-paper-50" aria-hidden>
          {count}
        </span>
      )}
      <svg
        viewBox="0 0 10 6"
        className={clsx("h-1.5 w-2.5 transition-transform duration-200", open && "rotate-180")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M1 1l4 4 4-4" />
      </svg>
    </button>
  );
}
