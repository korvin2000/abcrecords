import clsx from "clsx";

interface Props {
  /** Small-caps line above the title. */
  kicker?: string;
  title: string;
  /** Second title line (a surname). Dropped when absent or equal to `title`. */
  secondary?: string;
  /** Joined with " · "; empty parts drop out, an empty result renders nothing. */
  subtitleParts?: readonly (string | null | undefined)[];
}

/** Past this many characters the title is a comma-list roster, not a name —
 *  balance it at a smaller size instead of letting it overflow the plate. */
const LONG_TITLE = 24;

/**
 * The plate at the top of an open codex. Both modes compose this same header;
 * the difference between a biography and a page is which data reaches it, not
 * a branch in here.
 */
export function CodexHeader({ kicker, title, secondary, subtitleParts = [] }: Props) {
  const subtitle = subtitleParts.filter(Boolean).join(" · ");
  const long = title.length > LONG_TITLE;

  return (
    <header className="mb-5 text-center">
      {kicker && <div className="mb-2 font-display text-xs tracking-[0.4em] text-sepia-600/80">{kicker}</div>}

      <h1
        className={clsx(
          "font-display font-bold uppercase text-burgundy-600 [text-shadow:0_1px_0_rgba(251,243,210,0.8),0_2px_3px_rgba(51,34,15,0.25)]",
          long ? "text-balance text-2xl tracking-[0.06em] sm:text-3xl" : "text-4xl tracking-[0.12em] sm:text-5xl",
        )}
      >
        {title}
      </h1>

      {secondary && secondary !== title && (
        <h2 className="mt-1 font-display text-3xl font-semibold uppercase tracking-[0.14em] text-burgundy-700 [text-shadow:0_1px_0_rgba(251,243,210,0.8),0_2px_3px_rgba(51,34,15,0.2)] sm:text-4xl">
          {secondary}
        </h2>
      )}

      {subtitle && <p className="mt-2 font-body text-base italic text-sepia-600 sm:text-lg">{subtitle}</p>}

      <div className="divider-ornament mt-4">
        <span className="text-xl" aria-hidden>
          ❦
        </span>
      </div>
    </header>
  );
}
