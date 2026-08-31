import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * The four presentational atoms the statistics panel is built from. Each one
 * is layout and nothing else — no data, no fetching, no locale rules — so the
 * panel reads as a list of sections rather than a wall of markup.
 */

/** One titled section of the panel. `wide` takes a whole row of the grid. */
export function SectionCard({
  title,
  hint,
  wide = false,
  children,
}: {
  title: string;
  /** A short line under the heading — a total, a scale, a caveat. */
  hint?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={clsx("stats-card", wide && "stats-card--wide")}>
      <h3 className="stats-card-title">{title}</h3>
      {hint !== undefined && <p className="stats-card-hint">{hint}</p>}
      {children}
    </section>
  );
}

/** A single figure with its caption. The panel opens on a row of these. */
export function StatTile({
  value,
  caption,
  accent = false,
  live = false,
}: {
  value: string;
  caption: string;
  /** The headline figure of the row — burgundy rather than ink. */
  accent?: boolean;
  /** Adds the breathing dot: this number is true *now*, not cumulative. */
  live?: boolean;
}) {
  return (
    <div className={clsx("stats-tile", accent && "stats-tile--accent")}>
      <span className="stats-tile-value">
        {live && <span className="stats-live-dot" aria-hidden />}
        {value}
      </span>
      <span className="stats-tile-caption">{caption}</span>
    </div>
  );
}

/**
 * A labelled proportion bar: name, filled rule, count. The fill is a fraction
 * of the largest row in its own group, so a group with one dominant value
 * still shows the shape of the rest.
 */
export function Meter({
  label,
  value,
  fraction,
  icon,
  onClick,
  title,
}: {
  label: ReactNode;
  /** Already formatted — the meter does not know the reader's locale. */
  value: string;
  /** 0–1. */
  fraction: number;
  /** A flag, a rank, a glyph — anything narrow that leads the row. */
  icon?: ReactNode;
  /** Present only for rows that go somewhere; absent rows stay plain text. */
  onClick?: () => void;
  title?: string;
}) {
  const body = (
    <>
      {icon !== undefined && <span className="stats-meter-icon">{icon}</span>}
      <span className="stats-meter-label">{label}</span>
      <span className="stats-meter-track" aria-hidden>
        <span className="stats-meter-fill" style={{ inlineSize: `${(fraction * 100).toFixed(1)}%` }} />
      </span>
      <span className="stats-meter-value">{value}</span>
    </>
  );

  if (!onClick) {
    return <div className="stats-meter">{body}</div>;
  }
  return (
    <button type="button" className="stats-meter stats-meter--link" onClick={onClick} title={title}>
      {body}
    </button>
  );
}

/**
 * A histogram of a day series or of the hours of a day. Bars are CSS boxes
 * rather than SVG: thirty flexed divs cost less than a scaled vector on a weak
 * phone, they inherit the palette, and each one can carry its own tooltip.
 *
 * The peak is named in the section's own text, never only in a hover — a bar
 * whose value can be read *only* by hovering it is unreadable on a phone.
 */
export function BarChart({
  bars,
  ariaLabel,
  axis,
}: {
  bars: readonly { key: string; fraction: number; title: string; now?: boolean }[];
  ariaLabel: string;
  /** Two or three labels spread under the plot. */
  axis?: readonly string[];
}) {
  return (
    <div className="stats-chart">
      <div className="stats-chart-plot" role="img" aria-label={ariaLabel}>
        {bars.map((bar) => (
          <span
            key={bar.key}
            className={clsx("stats-bar", bar.now && "stats-bar--now")}
            style={{ blockSize: `${Math.max(bar.fraction * 100, bar.fraction > 0 ? 4 : 1.5).toFixed(1)}%` }}
            title={bar.title}
          />
        ))}
      </div>
      {axis && axis.length > 0 && (
        <div className="stats-chart-axis" aria-hidden>
          {axis.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
