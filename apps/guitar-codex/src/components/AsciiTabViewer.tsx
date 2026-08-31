import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import clsx from "clsx";
import {
  decodeAsciiTab,
  parseAsciiTab,
  type TabAnnotation,
  type TabDiagnostic,
  type TabDocument,
  type TabSystem,
} from "@/lib/asciiTab";
import { useAsciiTabPlayback } from "@/lib/asciiTabPlayback";
import type { ViewerTab } from "@/lib/asciiTabViewer";
import { useI18n, type TFunc } from "@/lib/i18n";
import { SIGN } from "@/lib/signs";
import { Glyph } from "./Glyph";
import { CornerOrnament } from "./OrnateFrame";

interface Props {
  tab: ViewerTab;
  onClose: () => void;
}

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly document: TabDocument }
  | { readonly status: "error"; readonly detail: string };

const documentCache = new Map<string, TabDocument>();
const COLUMN_WIDTH = 10;
const STRING_GAP = 22;
const LEFT = 50;
const RIGHT = 20;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
/**
 * How far "fit the pane" is allowed to shrink the score before it stops.
 *
 * Fitting to the *widest* system guarantees that nothing ever scrolls
 * sideways, but one unusually long line then decides the size of all ninety
 * others: this archive's typical system is 610 units wide and its longest is
 * 800, so a 333 px phone pane would draw everything at 42 % — a 4.6 px note
 * head. Half size is the floor. Below it the handful of systems that are
 * wider than the rest keep their own scrollbar, which is the right trade:
 * a few lines to drag instead of every line unreadable.
 *
 * 0.4 is where the two archives tested (`da_8lz`, `da_etcz`, 92 and 11
 * systems) fit end to end on a 360 px phone. It sounds severe as a percentage
 * and is not one in practice: such a phone reports 360 CSS px at a device
 * ratio of 3, so a note head drawn at 4.4 CSS px is 13 real ones.
 */
const MIN_FIT = 0.4;

/** How wide the widest system draws, in SVG units — the divisor for "fit". */
function widestSystemWidth(document: TabDocument): number {
  let widest = 0;
  for (const system of document.systems) {
    widest = Math.max(widest, LEFT + Math.max(12, system.widthColumns) * COLUMN_WIDTH + RIGHT);
  }
  return widest;
}

export function AsciiTabViewer({ tab, onClose }: Props) {
  const { t } = useI18n();
  const [load, setLoad] = useState<LoadState>(() => {
    const cached = documentCache.get(tab.src);
    return cached ? { status: "ready", document: cached } : { status: "loading" };
  });
  const [mode, setMode] = useState<"score" | "raw">("score");
  /**
   * `null` means "whatever fits the pane" — the state the viewer opens in, and
   * the one that makes it usable on a phone at all. A system of this archive's
   * typical width draws 610 px; the reading pane on a 360 px screen is 322,
   * so every one of a document's ninety-odd systems had its own horizontal
   * scrollbar and the reader had to drag each of them separately. Once the
   * zoom buttons are touched the number is theirs and the pane stops deciding.
   */
  const [zoom, setZoom] = useState<number | null>(null);
  const scoreRef = useRef<HTMLElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  const tabDocument = load.status === "ready" ? load.document : null;
  const widestSystem = tabDocument ? widestSystemWidth(tabDocument) : 0;
  /* Never above 1: fitting is for making a wide system readable, not for
     blowing a short one up to fill a desktop. */
  const fitZoom = paneWidth && widestSystem ? clamp(paneWidth / widestSystem, MIN_FIT, 1) : 1;
  const scale = zoom ?? fitZoom;
  const nudgeZoom = useCallback(
    (delta: number) => setZoom((value) => clamp((value ?? fitZoom) + delta, MIN_ZOOM, MAX_ZOOM)),
    [fitZoom],
  );
  const playback = useAsciiTabPlayback(tabDocument);
  const name = tab.download ?? filename(tab.src);
  const label = tab.label ?? name;
  const heading = tab.label && tab.label !== name ? tab.label : tabDocument?.title ?? label;

  useEffect(() => {
    const cached = documentCache.get(tab.src);
    if (cached) {
      setLoad({ status: "ready", document: cached });
      return;
    }
    const controller = new AbortController();
    setLoad({ status: "loading" });
    void fetchTab(tab.src, name, controller.signal)
      .then((next) => {
        documentCache.set(tab.src, next);
        setLoad({ status: "ready", document: next });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoad({ status: "error", detail: error instanceof Error ? error.message : String(error) });
        }
      });
    return () => controller.abort();
  }, [name, tab.src]);

  useEffect(() => {
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (mode === "score" && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        nudgeZoom(0.15);
      } else if (mode === "score" && (event.key === "-" || event.key === "_")) {
        event.preventDefault();
        nudgeZoom(-0.15);
      } else if (mode === "score" && event.key === "0") {
        event.preventDefault();
        setZoom(null);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [mode, nudgeZoom, onClose]);

  // What the score has to fit into. Observed rather than measured once: the
  // pane changes with an orientation flip and with the toolbar rewrapping.
  useLayoutEffect(() => {
    const element = scoreRef.current;
    if (!element) return;
    const read = () => setPaneWidth(element.clientWidth - horizontalPadding(element));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [load.status]);

  return (
    <m.div
      className="fixed inset-0 z-[70] flex items-center justify-center p-1.5 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`${t("tab.title")}: ${heading}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="parchment ornate-border relative z-10 flex h-full max-h-[96dvh] w-full max-w-7xl flex-col overflow-hidden rounded-sm shadow-[0_18px_70px_rgba(26,15,8,0.6)]">
        <CornerOrnament className="pointer-events-none absolute left-[5px] top-[5px] z-10 h-8 w-8 opacity-60" />
        <CornerOrnament flipX className="pointer-events-none absolute right-[5px] top-[5px] z-10 h-8 w-8 opacity-60" />

        {/* The plate. Its side padding has to clear the close control on the
            right and the corner filigree on the left, so it is stated once as
            a fluid pair rather than as `px-14 sm:px-28` — 56 px of a 360 px
            screen was a third of the title's own room, and the heading ran
            under the button anyway. */}
        <header className="tabview-plate relative shrink-0 border-b border-gold-600/45 text-center">
          <p className="tabview-kicker font-display uppercase tracking-[0.3em] text-sepia-600">{t("tab.title")}</p>
          <h1 className="tabview-title truncate font-heading font-semibold tracking-wide text-burgundy-700" title={heading}>
            {heading}
          </h1>
          <p className="tabview-meta truncate font-body italic text-sepia-600">{name}</p>
          <button type="button" onClick={onClose} className="btn-rpg codex-ctrl tabview-close z-20" aria-label={t("viewer.close")} title={t("viewer.close")}>
            <Glyph char={SIGN.close} size="var(--codex-ctrl-glyph)" />
          </button>
        </header>

        {load.status === "loading" ? (
          <Loading label={t("tab.loading")} />
        ) : load.status === "error" ? (
          <LoadError tab={tab} name={name} detail={load.detail} t={t} />
        ) : (
          <>
            <TabToolbar
              document={load.document}
              mode={mode}
              setMode={setMode}
              scale={scale}
              fitted={zoom === null}
              onNudge={nudgeZoom}
              onFit={() => setZoom(null)}
              playback={playback}
              src={tab.src}
              name={name}
              t={t}
            />
            <main ref={scoreRef} className="tabview-body min-h-0 flex-1 overflow-y-auto">
              {mode === "raw" ? (
                <pre className="tab-raw mx-auto max-w-full rounded-sm border border-gold-600/45 bg-paper-50/80 p-4 text-[0.72rem] leading-[1.35] text-ink-900 sm:text-[0.8rem]">
                  {load.document.rawText}
                </pre>
              ) : (
                <TabScore document={load.document} zoom={scale} activeSystem={playback.activeSystem} t={t} />
              )}
            </main>
          </>
        )}
      </div>
    </m.div>
  );
}

async function fetchTab(src: string, sourceName: string, signal: AbortSignal): Promise<TabDocument> {
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  const contentType = response.headers.get("content-type") ?? "";
  // A charset on the response is a hint, not a verdict: these files are older
  // than the servers that carry them, and the header is often just a default.
  const decoded = decodeAsciiTab(await response.arrayBuffer(), charsetOf(contentType));
  if (contentType.includes("text/html") && /^\s*(?:<!doctype|<html)/i.test(decoded.text)) {
    throw new Error("The server returned an HTML page instead of the requested text file.");
  }
  return parseAsciiTab(decoded.text, {
    sourceName,
    encoding: decoded.encoding,
    encodingInferred: decoded.inferred,
    newline: decoded.newline,
  });
}

function horizontalPadding(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
}

function charsetOf(contentType: string): string | undefined {
  return /;\s*charset\s*=\s*([^;]+)/i.exec(contentType)?.[1].trim();
}

function TabToolbar({
  document,
  mode,
  setMode,
  scale,
  fitted,
  onNudge,
  onFit,
  playback,
  src,
  name,
  t,
}: {
  document: TabDocument;
  mode: "score" | "raw";
  setMode: (mode: "score" | "raw") => void;
  /** The scale actually in force, fitted or chosen. */
  scale: number;
  /** Is that scale the pane's own answer rather than the reader's? */
  fitted: boolean;
  onNudge: (delta: number) => void;
  onFit: () => void;
  playback: ReturnType<typeof useAsciiTabPlayback>;
  src: string;
  name: string;
  t: TFunc;
}) {
  const playing = playback.status === "playing";
  const progress = playback.duration ? (playback.currentTime / playback.duration) * 100 : 0;
  return (
    <div className="tabview-toolbar shrink-0 border-b border-gold-600/35 bg-paper-100/70">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <ControlButton active={mode === "score"} onClick={() => setMode("score")} label={t("tab.graphical")} />
        <ControlButton active={mode === "raw"} onClick={() => setMode("raw")} label={t("tab.raw")} />

        {mode === "score" && (
          <>
            <Separator />
            <SmallButton onClick={() => onNudge(-0.15)} label={t("viewer.zoomOut")}>
              −
            </SmallButton>
            {/* The percentage is annotated, not merely shown: "53 %" with no
                explanation reads as a fault on a phone, where the pane and not
                the reader chose it. */}
            <span
              className="tabview-zoom text-center font-heading tabular-nums text-ink-800"
              title={fitted ? t("viewer.fitWidth") : undefined}
            >
              {Math.round(scale * 100)}%{fitted && <span aria-hidden> ⤡</span>}
            </span>
            <SmallButton onClick={() => onNudge(0.15)} label={t("viewer.zoomIn")}>
              +
            </SmallButton>
            <SmallButton onClick={onFit} label={t("viewer.fitWidth")}>
              ⤡
            </SmallButton>
          </>
        )}

        <Separator />
        <button
          type="button"
          onClick={playback.toggle}
          disabled={!playback.hasNotes || playback.status === "error"}
          className="btn-rpg tabview-btn disabled:cursor-not-allowed disabled:opacity-45"
        >
          {playing ? `Ⅱ ${t("audio.pause")}` : `▶︎ ${t("audio.play")}`}
        </button>
        <button
          type="button"
          onClick={playback.stop}
          disabled={playback.status === "idle"}
          className="btn-rpg tabview-btn disabled:cursor-not-allowed disabled:opacity-45"
        >
          ■ {t("tab.stop")}
        </button>
        <a href={src} download={name} className="btn-rpg tabview-btn no-underline" onClick={(event) => event.stopPropagation()}>
          ⇩ {t("audio.download")}
        </a>
      </div>

      <div className="tabview-meta mx-auto mt-1.5 flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-0.5 font-body text-sepia-600">
        <span>{t("tab.systemCount", { count: document.systems.length })}</span>
        {document.meter && <span>· {t("tab.meter")}: {document.meter}</span>}
        <span>· {t("tab.tuning")}: {t(`tab.tuning.${document.tuning.kind}`)}</span>
        <span title={document.encodingInferred ? t("tab.encodingGuessed") : undefined}>
          · {document.encoding.toUpperCase()}
          {document.encodingInferred && <span aria-hidden> ?</span>}
        </span>
      </div>

      <div className="mx-auto mt-1.5 max-w-3xl">
        <div className="h-1 overflow-hidden rounded-full bg-paper-300" aria-hidden>
          <div className="h-full bg-burgundy-600 transition-[width] duration-100" style={{ width: `${progress}%` }} />
        </div>
        <div className="tabview-meta mt-0.5 flex justify-between gap-3 font-body text-sepia-600">
          <span>{t("tab.approximate")}</span>
          <span className="shrink-0 tabular-nums">{formatTime(playback.currentTime)} / {formatTime(playback.duration)}</span>
        </div>
      </div>
    </div>
  );
}

function TabScore({ document, zoom, activeSystem, t }: { document: TabDocument; zoom: number; activeSystem: number | null; t: TFunc }) {
  if (!document.systems.length) {
    return <p className="py-12 text-center font-body italic text-sepia-600">{t("tab.noSystems")}</p>;
  }
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {document.sections.map((section, index) =>
        section.kind === "prose" ? (
          <ProseSection key={`p-${section.startLine}-${index}`} text={section.text} />
        ) : (
          <TabSystemSvg
            key={`s-${section.system.index}`}
            system={section.system}
            tuning={document.tuning.labels}
            zoom={zoom}
            active={section.system.index === activeSystem}
            title={t("tab.system", { number: section.system.index + 1 })}
          />
        ),
      )}
      <Diagnostics diagnostics={document.diagnostics} systems={document.systems} t={t} />
    </div>
  );
}

function ProseSection({ text }: { text: string }) {
  const visible = text.replace(/^\s*\n|\n\s*$/g, "").trimEnd();
  if (!visible.trim()) return null;
  const diagram = looksLikeDiagram(visible);
  return diagram ? (
    <pre className="tab-raw overflow-x-auto rounded-sm border border-gold-600/35 bg-paper-100/60 p-3 text-xs leading-snug text-sepia-700">{visible}</pre>
  ) : (
    <div className="tabview-prose whitespace-pre-wrap break-words rounded-sm border-l-2 border-gold-600/45 bg-paper-100/35 font-body leading-relaxed text-ink-800">
      {visible}
    </div>
  );
}

/**
 * Is this stretch of plain text a tab fragment or a chord chart — something
 * whose columns are data and which must therefore keep its line breaks and
 * scroll rather than wrap?
 *
 * A staff line is the conjunction of two things: a bar `|` and a run of rule.
 * The test used to be "three lines containing any of `|:-` anywhere, plus six
 * rule characters somewhere", which every legacy file's `#-------PLEASE
 * NOTE-------` header satisfies — so the English preamble of half the archive
 * was put in a horizontal scroller and read four words at a time on a phone.
 */
function looksLikeDiagram(text: string): boolean {
  let staffLines = 0;
  for (const line of text.split("\n")) {
    if (line.includes("|") && /-{4,}/.test(line)) staffLines += 1;
    if (staffLines >= 3) return true;
  }
  return false;
}

function TabSystemSvg({
  system,
  tuning,
  zoom,
  active,
  title,
}: {
  system: TabSystem;
  tuning: readonly string[] | null;
  zoom: number;
  active: boolean;
  title: string;
}) {
  const top = 24 + system.annotationsAbove.length * 18;
  const stringsBottom = top + STRING_GAP * 5;
  const bottom = 24 + system.annotationsBelow.length * 18;
  const width = LEFT + Math.max(12, system.widthColumns) * COLUMN_WIDTH + RIGHT;
  const height = stringsBottom + bottom;
  const titleId = `tab-system-title-${system.index}`;
  const eventCount = system.rows.reduce((total, row) => total + row.events.length, 0);
  const prefixedRows = system.rows.filter((row) => row.prefix.includes("|"));
  const hasOpeningBar = prefixedRows.length >= 4;
  const hasDoubleOpeningBar = prefixedRows.filter((row) => row.prefix.includes("||")).length >= 4;
  const hasOpeningRepeat = prefixedRows.some((row) => row.prefix.includes("*"));

  return (
    <figure id={`tab-system-${system.index}`} className={clsx("scroll-mt-4 rounded-sm", active && "ring-2 ring-burgundy-500 ring-offset-2 ring-offset-paper-100")}>
      <div className="mx-auto w-fit max-w-full overflow-x-auto rounded-sm border border-gold-600/45 bg-paper-50/75 shadow-[0_2px_10px_rgba(84,56,30,0.1)]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width * zoom}
          height={height * zoom}
          className="block max-w-none"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{title}; {eventCount} notes; source lines {system.startLine}–{system.endLine}</title>
          <rect width={width} height={height} fill={active ? "#f7e7b4" : "#faf5e6"} />
          <rect x="0.75" y="0.75" width={width - 1.5} height={height - 1.5} fill="none" stroke="#b8902a" strokeOpacity="0.38" />

          {system.annotationsAbove.map((annotation, index) => (
            <Annotation key={`a-${annotation.sourceLine}`} annotation={annotation} y={16 + index * 18} bodyStart={system.rows[0].bodyStartColumn} />
          ))}

          {system.rows.map((row, index) => {
            const y = top + index * STRING_GAP;
            return (
              <g key={row.string}>
                <text x="24" y={y + 4} textAnchor="middle" fill="#6b4a2a" fontFamily="ui-sans-serif, sans-serif" fontSize="11" fontWeight="600">
                  {row.label ?? tuning?.[index] ?? row.string}
                </text>
                <text x="40" y={y + 3.5} textAnchor="middle" fill="#8a6f4d" fontFamily="ui-sans-serif, sans-serif" fontSize="8">{row.string}</text>
                <line x1={LEFT} x2={width - RIGHT} y1={y} y2={y} stroke="#4a3423" strokeWidth={0.7 + index * 0.16} strokeOpacity="0.82" />
                {row.events.map((event) => {
                  const tokenWidth = Math.max(14, event.raw.length * 8.5);
                  const x = LEFT + (event.onsetColumn + 0.5) * COLUMN_WIDTH;
                  const display = event.raw.startsWith("r(") ? event.raw : String(event.fret);
                  return (
                    <g key={event.id}>
                      {event.harmonic ? (
                        <path d={`M ${x} ${y - 9} L ${x + tokenWidth / 2} ${y} L ${x} ${y + 9} L ${x - tokenWidth / 2} ${y} Z`} fill="#fbf3d2" stroke="#b8902a" strokeWidth="1.2" />
                      ) : (
                        <rect x={x - tokenWidth / 2} y={y - 8} width={tokenWidth} height="16" rx="4" fill="#faf5e6" />
                      )}
                      <text x={x} y={y + 4} textAnchor="middle" fill={event.harmonic ? "#6e5419" : "#2a1810"} fontFamily="ui-sans-serif, sans-serif" fontSize={display.length > 2 ? "9" : "11"} fontWeight="700">
                        {display}
                      </text>
                    </g>
                  );
                })}
                {row.glyphs.map((glyph, glyphIndex) => (
                  <text key={`${glyph.column}-${glyphIndex}`} x={LEFT + (glyph.column + 0.5) * COLUMN_WIDTH} y={y + 4} textAnchor="middle" fill="#7a1f2b" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="700">
                    {glyph.raw}
                  </text>
                ))}
              </g>
            );
          })}

          {hasOpeningBar && (
            <g>
              <line x1={LEFT} x2={LEFT} y1={top - 4} y2={stringsBottom + 4} stroke="#54381e" strokeWidth="1.2" />
              {hasDoubleOpeningBar && <line x1={LEFT + 3} x2={LEFT + 3} y1={top - 4} y2={stringsBottom + 4} stroke="#54381e" strokeWidth="0.8" />}
              {hasOpeningRepeat && <><circle cx={LEFT + 5} cy={top + STRING_GAP * 2.2} r="1.6" fill="#7a1f2b" /><circle cx={LEFT + 5} cy={top + STRING_GAP * 2.8} r="1.6" fill="#7a1f2b" /></>}
            </g>
          )}

          {system.barlines.map((barline, index) => {
            const x = LEFT + (barline.column + 0.5) * COLUMN_WIDTH;
            return (
              <g key={`${barline.column}-${index}`}>
                <line x1={x} x2={x} y1={top - 4} y2={stringsBottom + 4} stroke="#54381e" strokeWidth={index && barline.column === system.barlines[index - 1].column + 1 ? 1.4 : 1} />
                {barline.repeat && <><circle cx={x - 4} cy={top + STRING_GAP * 2.2} r="1.6" fill="#7a1f2b" /><circle cx={x - 4} cy={top + STRING_GAP * 2.8} r="1.6" fill="#7a1f2b" /></>}
              </g>
            );
          })}

          {system.techniques.map((technique, index) => {
            const y = top + (technique.string - 1) * STRING_GAP;
            const x1 = LEFT + (technique.fromColumn + 0.7) * COLUMN_WIDTH;
            const x2 = LEFT + (technique.toColumn + 0.3) * COLUMN_WIDTH;
            if (technique.kind === "slide" || technique.kind === "sustain") {
              return <line key={index} x1={x1} x2={x2} y1={technique.kind === "slide" ? y + 6 : y - 7} y2={technique.kind === "slide" ? y - 6 : y - 7} stroke={technique.kind === "slide" ? "#7a1f2b" : "#8a6a1f"} strokeWidth="1.2" />;
            }
            const curveY = technique.kind === "hammer-on" ? y - 12 : y + 12;
            return <path key={index} d={`M ${x1} ${y} Q ${(x1 + x2) / 2} ${curveY} ${x2} ${y}`} fill="none" stroke={technique.kind === "hammer-on" ? "#6e5419" : "#7a1f2b"} strokeWidth="1.1" />;
          })}

          {system.annotationsBelow.map((annotation, index) => (
            <Annotation key={`b-${annotation.sourceLine}`} annotation={annotation} y={stringsBottom + 20 + index * 18} bodyStart={system.rows[0].bodyStartColumn} />
          ))}
        </svg>
      </div>
      <figcaption className="mt-1 text-center font-body text-xs italic text-sepia-600">{title} · {eventCount} notes · lines {system.startLine}–{system.endLine}</figcaption>
    </figure>
  );
}

function Annotation({ annotation, y, bodyStart }: { annotation: TabAnnotation; y: number; bodyStart: number }) {
  const color = annotation.kind === "navigation" ? "#7a1f2b" : annotation.kind === "barre" ? "#8a6a1f" : "#6b4a2a";
  if (annotation.kind === "beats") {
    return (
      <g>
        {[...annotation.raw].map((character, column) => character === "|" ? (
          <line key={column} x1={LEFT + (column - bodyStart + 0.5) * COLUMN_WIDTH} x2={LEFT + (column - bodyStart + 0.5) * COLUMN_WIDTH} y1={y - 5} y2={y + 3} stroke="#8a6a1f" strokeWidth="1" />
        ) : null)}
      </g>
    );
  }
  const tokens = [...annotation.raw.matchAll(/\S+/g)];
  return (
    <g>
      {tokens.map((match, index) => (
        <text
          key={`${match.index}-${index}`}
          x={LEFT + Math.max(0, (match.index ?? 0) - bodyStart) * COLUMN_WIDTH}
          y={y}
          fill={color}
          fontFamily={annotation.kind === "fingering" ? "ui-monospace, monospace" : "Georgia, serif"}
          fontSize={annotation.kind === "fingering" ? "9" : "10"}
          fontStyle={annotation.kind === "direction" ? "italic" : "normal"}
          fontWeight={annotation.kind === "navigation" || annotation.kind === "barre" ? "700" : "500"}
        >
          {match[0]}
        </text>
      ))}
    </g>
  );
}

function Diagnostics({ diagnostics, systems, t }: { diagnostics: readonly TabDiagnostic[]; systems: readonly TabSystem[]; t: TFunc }) {
  if (!diagnostics.length) return null;
  return (
    <details className="rounded-sm border border-gold-600/40 bg-paper-100/60 px-4 py-3 font-body text-sm text-sepia-700">
      <summary className="cursor-pointer font-heading text-xs uppercase tracking-wider text-burgundy-700">⚠ {t("tab.diagnostics")} ({diagnostics.length})</summary>
      <ul className="mt-2 space-y-1 pl-5">
        {diagnostics.map((diagnostic, index) => {
          const system = diagnostic.line == null ? undefined : systems.find((candidate) => diagnostic.line! >= candidate.startLine && diagnostic.line! <= candidate.endLine);
          return (
            <li key={`${diagnostic.code}-${diagnostic.line ?? 0}-${index}`}>
              {system ? <a className="text-burgundy-700 underline decoration-dotted underline-offset-2" href={`#tab-system-${system.index}`}>{diagnostic.message}</a> : diagnostic.message}
              {diagnostic.line && <span className="ml-1 text-xs">(line {diagnostic.line})</span>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center" role="status" aria-busy="true">
      <div className="text-center">
        <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-2 border-gold-600/30 border-t-burgundy-600" />
        <p className="mt-3 font-body italic text-sepia-600">{label}</p>
      </div>
    </div>
  );
}

function LoadError({ tab, name, detail, t }: { tab: ViewerTab; name: string; detail: string; t: TFunc }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
      <div>
        <p className="font-display text-xl text-burgundy-700">{t("tab.error")}</p>
        <p className="mt-2 max-w-xl font-body text-sm text-sepia-600">{detail}</p>
        <a href={tab.src} download={name} className="btn-rpg mt-5 inline-block no-underline">{t("audio.download")}</a>
      </div>
    </div>
  );
}

function ControlButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={clsx("tabview-btn rounded border font-heading uppercase tracking-wider transition-colors", active ? "border-burgundy-600 bg-burgundy-600 text-paper-50" : "border-gold-600/45 bg-paper-50/50 text-sepia-700 hover:bg-paper-200")}>
      {label}
    </button>
  );
}

function SmallButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className="tabview-small grid place-items-center rounded border border-gold-600/45 bg-paper-50/60 font-heading font-semibold text-gold-800 hover:bg-gold-200/50">{children}</button>;
}

function Separator() {
  return <span className="mx-0.5 h-5 w-px bg-gold-600/35" aria-hidden />;
}

function filename(url: string): string {
  const raw = url.split(/[?#]/, 1)[0].split("/").pop() || "tablature.txt";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
