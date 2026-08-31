import { useCallback, useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import {
  adoptPulse,
  fillMissingDays,
  formatCount,
  freshStats,
  formatHour,
  formatLongDay,
  formatRatio,
  formatShortDay,
  loadStats,
  OTHER_KEY,
  peakOf,
  rememberStats,
  share,
  weekdayNames,
  type Slice,
  type Stats,
} from "@/lib/counter";
import { isLang, langInfo } from "@/lib/languages";
import { audio } from "@/lib/audio";
import { useI18n, type TFunc } from "@/lib/i18n";
import type { MsgKey } from "@/lib/messages";
import { Flag } from "../Flag";
import { Glyph } from "../Glyph";
import { CornerOrnament } from "../OrnateFrame";
import { SIGN } from "@/lib/signs";
import { BarChart, Meter, SectionCard, StatTile } from "./StatParts";

interface Props {
  onClose: () => void;
  /** The catalogue's name for a slug, or null when it lists no such entry. */
  resolveTitle: (slug: string) => string | null;
  /** Opening an entry from the "most-read" list closes the panel behind it. */
  onOpenEntry: (slug: string) => void;
}

/**
 * The visitors' chronicle — everything the counter knows, in the codex's own
 * furniture: a parchment plate, filigree corners, one scrolling reading pane.
 *
 * It fetches its own document on mount (one request, no polling) and hands the
 * fresher tally inside it back to the store, so the odometer in the header is
 * up to date the moment the panel opens.
 *
 * Overlay conventions this shares with the rest of the app, and must keep:
 * Escape is handled in the **capture** phase and stopped, so it closes this
 * and not the codex behind it; the body scroll-lock is owned here because this
 * overlay is not the codex's (see `App`'s lock, which is keyed on the codex);
 * and focus is taken on open and returned to whatever had it on close.
 */
export function StatsModal({ onClose, resolveTitle, onOpenEntry }: Props) {
  const { t, lang, locale } = useI18n();
  const reduced = useReducedMotion();
  // Opened again within the store's window: render the document it kept and
  // ask for nothing. `hadDocument` is captured at mount, so the effect below
  // has one dependency — the retry — instead of depending on state it sets.
  const [stats, setStats] = useState<Stats | null>(freshStats);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const hadDocument = useRef(stats !== null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The document itself is not localized — every label in it is drawn here, in
  // the reader's tongue — so a language change is not a reason to fetch again.
  useEffect(() => {
    if (hadDocument.current && attempt === 0) return;
    let alive = true;
    setFailed(false);
    loadStats(lang)
      .then((fresh) => {
        rememberStats(fresh);
        adoptPulse(fresh);
        if (alive) setStats(fresh);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Escape in the capture phase, so nothing behind this overlay also closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const restoreFocus = document.activeElement as HTMLElement | null;
    audio.open();
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocus?.focus?.();
    };
  }, []);

  const close = useCallback(() => {
    audio.close();
    onClose();
  }, [onClose]);

  return (
    <div
      className="stats-overlay fixed inset-0 z-50 flex items-center justify-center bg-ink-950/55 backdrop-blur-sm"
      // A press on the scrim closes; a press inside the plate does not. Both
      // are pointer events, so a drag that starts inside and ends outside — a
      // text selection — cannot close the panel either.
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <m.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("stats.title")}
        initial={reduced ? undefined : { opacity: 0, scale: 0.97, y: 10 }}
        animate={reduced ? undefined : { opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="stats-panel parchment ornate-border"
      >
        {CORNERS.map((corner) => (
          <CornerOrnament
            key={corner.className}
            flipX={corner.flipX}
            flipY={corner.flipY}
            className={`stats-corner ${corner.className}`}
          />
        ))}

        <header className="stats-header">
          <p className="stats-kicker">
            <Glyph char={SIGN.source} size="var(--stats-kicker-glyph)" className="text-gold-600" />
            <span>{t("stats.title")}</span>
            <Glyph char={SIGN.source} size="var(--stats-kicker-glyph)" className="text-gold-600" />
          </p>
          {stats && (
            <p className="stats-subtitle">
              {t("stats.since", {
                date: formatLongDay(stats.since, locale),
                days: t("stats.dayCount", {
                  n: stats.daysRunning,
                  v: formatCount(stats.daysRunning, locale),
                }),
              })}
            </p>
          )}
          <button type="button" className="stats-close btn-rpg" onClick={close} aria-label={t("stats.close")}>
            <Glyph char={SIGN.close} size="var(--stats-close-glyph)" />
          </button>
        </header>

        <div className="stats-body codex-scroll">
          {!stats && !failed && <p className="stats-note">{t("stats.loading")}</p>}

          {failed && (
            <div className="stats-note">
              <p>{t("stats.error")}</p>
              <button type="button" className="btn-rpg mt-3" onClick={() => setAttempt((n) => n + 1)}>
                {t("stats.retry")}
              </button>
            </div>
          )}

          {stats && (
            <StatsSheet
              stats={stats}
              t={t}
              locale={locale}
              resolveTitle={resolveTitle}
              onOpenEntry={(slug) => {
                onOpenEntry(slug);
                onClose();
              }}
            />
          )}
        </div>

        <footer className="stats-footer">{t("stats.privacy")}</footer>
      </m.div>
    </div>
  );
}

const CORNERS = [
  { className: "stats-corner--tl", flipX: false, flipY: false },
  { className: "stats-corner--tr", flipX: true, flipY: false },
  { className: "stats-corner--bl", flipX: false, flipY: true },
  { className: "stats-corner--br", flipX: true, flipY: true },
] as const;

/* ------------------------------------------------------------------ sheet */

/**
 * The document itself. Split from the shell so the shell holds the modal
 * mechanics (focus, scrim, Escape, fetching) and this holds only the reading
 * of numbers — which is the half that changes when a figure is added.
 */
function StatsSheet({
  stats,
  t,
  locale,
  resolveTitle,
  onOpenEntry,
}: {
  stats: Stats;
  t: TFunc;
  locale: string;
  resolveTitle: (slug: string) => string | null;
  onOpenEntry: (slug: string) => void;
}) {
  // `n` selects the plural form, `v` is what the sentence prints — the two
  // differ because a grouped "1 234" is not a number `Intl.PluralRules` can
  // read. See the `t()` contract in lib/i18n.tsx.
  const count = (n: number) => formatCount(n, locale);
  const views = (n: number) => t("stats.views", { n, v: count(n) });
  const days = (n: number) => t("stats.dayCount", { n, v: count(n) });
  const hourNow = new Date().getHours();
  const weekdays = weekdayNames(locale);
  const hoursPeak = peakOf(stats.hours);
  const busiestHour = stats.hours.indexOf(hoursPeak);
  // Thirty slots, always — see `fillMissingDays`.
  const series = fillMissingDays(stats.series, 30);
  const daysPeak = peakOf(series.map((day) => day.views));
  const weekPeak = peakOf(stats.weekdays);
  const pagesPeak = peakOf(stats.pages.map((page) => page.count));
  const langsPeak = peakOf(stats.langs.map((row) => row.count));
  const refsPeak = peakOf(stats.referrers.map((row) => row.count));
  const lastDay = stats.series[stats.series.length - 1];

  return (
    <>
      <div className="stats-tiles">
        <StatTile value={count(stats.uniques)} caption={t("stats.tile.uniques")} accent />
        <StatTile value={count(stats.views)} caption={t("stats.tile.views")} />
        <StatTile value={count(stats.visits)} caption={t("stats.tile.visits")} />
        <StatTile value={count(stats.today.views)} caption={t("stats.tile.today")} />
        <StatTile value={count(stats.online)} caption={t("stats.tile.online")} live />
      </div>

      <div className="stats-grid">
        <SectionCard
          title={t("stats.days.title")}
          hint={t("stats.days.hint", {
            d7: count(stats.windows.d7.views),
            d30: count(stats.windows.d30.views),
          })}
          wide
        >
          <BarChart
            ariaLabel={`${t("stats.days.title")} — ${views(daysPeak)}`}
            bars={series.map((day) => ({
              key: day.date,
              fraction: share(day.views, daysPeak),
              title: `${formatLongDay(day.date, locale)} · ${views(day.views)}`,
              now: day.date === lastDay?.date,
            }))}
            axis={axisOf(series.map((day) => day.date), locale)}
          />
        </SectionCard>

        <SectionCard
          title={t("stats.hours.title")}
          hint={
            hoursPeak > 0
              ? t("stats.hours.hint", { hour: formatHour(busiestHour, locale), n: count(hoursPeak) })
              : t("stats.empty")
          }
          wide
        >
          <BarChart
            ariaLabel={t("stats.hours.title")}
            bars={stats.hours.map((value, hour) => ({
              key: String(hour),
              fraction: share(value, hoursPeak),
              title: `${formatHour(hour, locale)} · ${views(value)}`,
              now: hour === hourNow,
            }))}
            axis={[formatHour(0, locale), formatHour(12, locale), formatHour(23, locale)]}
          />
        </SectionCard>

        <SectionCard title={t("stats.week.title")}>
          {stats.weekdays.map((value, index) => (
            <Meter
              key={index}
              label={weekdays[index]}
              value={count(value)}
              fraction={share(value, weekPeak)}
            />
          ))}
        </SectionCard>

        <SectionCard title={t("stats.pages.title")}>
          {stats.pages.length === 0 && <p className="stats-note">{t("stats.empty")}</p>}
          {stats.pages.map((slice) => {
            const title = resolveTitle(slice.key);
            return (
              <Meter
                key={slice.key}
                label={title ?? slice.key}
                icon={
                  <Glyph
                    char={title ? SIGN.article : SIGN.source}
                    size="var(--stats-meter-glyph)"
                    className="text-gold-700"
                  />
                }
                value={count(slice.count)}
                fraction={share(slice.count, pagesPeak)}
                onClick={title ? () => onOpenEntry(slice.key) : undefined}
                title={title ?? t("stats.entryUnknown")}
              />
            );
          })}
        </SectionCard>

        <SectionCard title={t("stats.langs.title")}>
          {stats.langs.length === 0 && <p className="stats-note">{t("stats.empty")}</p>}
          {stats.langs.map((slice) => (
            <Meter
              key={slice.key}
              label={isLang(slice.key) ? langInfo(slice.key).native : sliceLabel(slice, t)}
              icon={isLang(slice.key) ? <Flag code={slice.key} className="stats-flag" /> : undefined}
              value={count(slice.count)}
              fraction={share(slice.count, langsPeak)}
            />
          ))}
        </SectionCard>

        <SectionCard title={t("stats.tech.title")}>
          {TECH_GROUPS.map((group) => {
            const rows = stats.tech[group.field];
            if (rows.length === 0) return null;
            return (
              <div key={group.field} className="stats-group">
                <h4 className="stats-group-title">{t(group.titleKey)}</h4>
                {rows.map((slice) => (
                  <Meter
                    key={slice.key}
                    label={group.field === "device" ? deviceLabel(slice, t) : sliceLabel(slice, t)}
                    value={count(slice.count)}
                    fraction={share(slice.count, peakOf(rows.map((r) => r.count)))}
                  />
                ))}
              </div>
            );
          })}
        </SectionCard>

        <SectionCard title={t("stats.refs.title")}>
          {stats.referrers.length === 0 && <p className="stats-note">{t("stats.refs.none")}</p>}
          {stats.referrers.map((slice) => (
            <Meter
              key={slice.key}
              label={sliceLabel(slice, t)}
              value={count(slice.count)}
              fraction={share(slice.count, refsPeak)}
            />
          ))}
        </SectionCard>

        <SectionCard title={t("stats.records.title")}>
          <dl className="stats-records">
            <Record
              term={t("stats.record.peakDay")}
              value={
                stats.peak.day.views > 0
                  ? `${formatShortDay(stats.peak.day.date, locale)} · ${count(stats.peak.day.views)}`
                  : "—"
              }
            />
            <Record
              term={t("stats.record.peakHour")}
              value={
                stats.peak.hour.views > 0
                  ? `${formatHour(stats.peak.hour.hour, locale)} · ${count(stats.peak.hour.views)}`
                  : "—"
              }
            />
            <Record term={t("stats.record.streak")} value={days(stats.streak)} />
            <Record term={t("stats.record.perDay")} value={formatRatio(stats.avg.viewsPerDay, locale)} />
            <Record term={t("stats.record.perVisit")} value={formatRatio(stats.avg.viewsPerVisit, locale)} />
            <Record term={t("stats.record.bots")} value={count(stats.bots)} />
          </dl>
        </SectionCard>
      </div>
    </>
  );
}

function Record({ term, value }: { term: string; value: string }) {
  return (
    <div className="stats-record">
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const TECH_GROUPS: readonly { field: "device" | "browser" | "os"; titleKey: MsgKey }[] = [
  { field: "device", titleKey: "stats.tech.device" },
  { field: "browser", titleKey: "stats.tech.browser" },
  { field: "os", titleKey: "stats.tech.os" },
];

/** The server's "everything else" bucket is one character; everything else is
 *  a host, a browser name or a code, and passes through as it arrived. */
function sliceLabel(slice: Slice, t: TFunc): string {
  return slice.key === OTHER_KEY ? t("stats.other") : slice.key;
}

function deviceLabel(slice: Slice, t: TFunc): string {
  if (slice.key === "desktop") return t("stats.device.desktop");
  if (slice.key === "mobile") return t("stats.device.mobile");
  if (slice.key === "tablet") return t("stats.device.tablet");
  return sliceLabel(slice, t);
}

/** First, middle and last day of a series — three labels, never thirty. */
function axisOf(dates: readonly string[], locale: string): string[] {
  if (dates.length === 0) return [];
  if (dates.length < 4) return dates.map((date) => formatShortDay(date, locale));
  return [
    formatShortDay(dates[0], locale),
    formatShortDay(dates[Math.floor((dates.length - 1) / 2)], locale),
    formatShortDay(dates[dates.length - 1], locale),
  ];
}
