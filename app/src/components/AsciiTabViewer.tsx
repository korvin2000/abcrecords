import { useEffect, useState } from "react";
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

export function AsciiTabViewer({ tab, onClose }: Props) {
  const { t } = useI18n();
  const [load, setLoad] = useState<LoadState>(() => {
    const cached = documentCache.get(tab.src);
    return cached ? { status: "ready", document: cached } : { status: "loading" };
  });
  const [mode, setMode] = useState<"score" | "raw">("score");
  const [zoom, setZoom] = useState(1);
  const tabDocument = load.status === "ready" ? load.document : null;
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
        setZoom((value) => clamp(value + 0.15, 0.65, 2));
      } else if (mode === "score" && (event.key === "-" || event.key === "_")) {
        event.preventDefault();
        setZoom((value) => clamp(value - 0.15, 0.65, 2));
      } else if (mode === "score" && event.key === "0") {
        event.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [mode, onClose]);

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
      <div className="parchment ornate-border relative z-10 flex h-full max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-sm shadow-[0_18px_70px_rgba(26,15,8,0.6)]">
        <CornerOrnament className="pointer-events-none absolute left-[5px] top-[5px] z-10 h-8 w-8 opacity-60" />
        <CornerOrnament flipX className="pointer-events-none absolute right-[5px] top-[5px] z-10 h-8 w-8 opacity-60" />

        <header className="relative shrink-0 border-b border-gold-600/45 px-14 pb-3 pt-4 text-center sm:px-28">
          <p className="font-display text-[0.65rem] uppercase tracking-[0.3em] text-sepia-600">{t("tab.title")}</p>
          <h1 className="truncate font-heading text-xl font-semibold tracking-wide text-burgundy-700 sm:text-2xl" title={heading}>
            {heading}
          </h1>
          <p className="truncate font-body text-xs italic text-sepia-600">{name}</p>
          <button type="button" onClick={onClose} className="btn-rpg absolute right-9 top-4 z-20 !px-3" aria-label={t("viewer.close")} title={t("viewer.close")}>
            ✕
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
              zoom={zoom}
              setZoom={setZoom}
              playback={playback}
              src={tab.src}
              name={name}
              t={t}
            />
            <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-7">
              {mode === "raw" ? (
                <pre className="tab-raw mx-auto max-w-full rounded-sm border border-gold-600/45 bg-paper-50/80 p-4 text-[0.72rem] leading-[1.35] text-ink-900 sm:text-[0.8rem]">
                  {load.document.rawText}
                </pre>
              ) : (
                <TabScore document={load.document} zoom={zoom} activeSystem={playback.activeSystem} t={t} />
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
  const decoded = decodeAsciiTab(await response.arrayBuffer());
  if (response.headers.get("content-type")?.includes("text/html") && /^\s*(?:<!doctype|<html)/i.test(decoded.text)) {
    throw new Error("The server returned an HTML page instead of the requested text file.");
  }
  return parseAsciiTab(decoded.text, {
    sourceName,
    encoding: decoded.encoding,
    newline: decoded.newline,
  });
}

function TabToolbar({
  document,
  mode,
  setMode,
  zoom,
  setZoom,
  playback,
  src,
  name,
  t,
}: {
  document: TabDocument;
  mode: "score" | "raw";
  setMode: (mode: "score" | "raw") => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  playback: ReturnType<typeof useAsciiTabPlayback>;
  src: string;
  name: string;
  t: TFunc;
}) {
  const playing = playback.status === "playing";
  const progress = playback.duration ? (playback.currentTime / playback.duration) * 100 : 0;
  return (
    <div className="shrink-0 border-b border-gold-600/35 bg-paper-100/70 px-3 py-2.5 sm:px-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <ControlButton active={mode === "score"} onClick={() => setMode("score")} label={t("tab.graphical")} />
        <ControlButton active={mode === "raw"} onClick={() => setMode("raw")} label={t("tab.raw")} />

        {mode === "score" && (
          <>
            <Separator />
            <SmallButton onClick={() => setZoom((value) => clamp(value - 0.15, 0.65, 2))} label={t("viewer.zoomOut")}>
              −
            </SmallButton>
            <span className="w-12 text-center font-heading text-xs tabular-nums text-ink-800">{Math.round(zoom * 100)}%</span>
            <SmallButton onClick={() => setZoom((value) => clamp(value + 0.15, 0.65, 2))} label={t("viewer.zoomIn")}>
              +
            </SmallButton>
            <SmallButton onClick={() => setZoom(1)} label={t("viewer.actualSize")}>
              1:1
            </SmallButton>
          </>
        )}

        <Separator />
        <button
          type="button"
          onClick={playback.toggle}
          disabled={!playback.hasNotes || playback.status === "error"}
          className="btn-rpg !px-3 !py-1.5 !text-[0.68rem] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {playing ? `Ⅱ ${t("audio.pause")}` : `▶ ${t("audio.play")}`}
        </button>
        <button
          type="button"
          onClick={playback.stop}
          disabled={playback.status === "idle"}
          className="btn-rpg !px-3 !py-1.5 !text-[0.68rem] disabled:cursor-not-allowed disabled:opacity-45"
        >
          ■ {t("tab.stop")}
        </button>
        <a href={src} download={name} className="btn-rpg !px-3 !py-1.5 !text-[0.68rem] no-underline" onClick={(event) => event.stopPropagation()}>
          ⇩ {t("audio.download")}
        </a>
      </div>

      <div className="mx-auto mt-2 flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-1 font-body text-xs text-sepia-600">
        <span>{t("tab.systemCount", { count: document.systems.length })}</span>
        {document.meter && <span>· {t("tab.meter")}: {document.meter}</span>}
        <span>· {t("tab.tuning")}: {t(`tab.tuning.${document.tuning.kind}`)}</span>
        <span>· {document.encoding.toUpperCase()}</span>
      </div>

      <div className="mx-auto mt-2 max-w-3xl">
        <div className="h-1 overflow-hidden rounded-full bg-paper-300" aria-hidden>
          <div className="h-full bg-burgundy-600 transition-[width] duration-100" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-0.5 flex justify-between gap-3 font-body text-[0.68rem] text-sepia-600">
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
  const diagram = /(?:[|:-].*){3}/.test(visible) && /[-|]{6}/.test(visible);
  return diagram ? (
    <pre className="tab-raw overflow-x-auto rounded-sm border border-gold-600/35 bg-paper-100/60 p-3 text-xs leading-snug text-sepia-700">{visible}</pre>
  ) : (
    <div className="whitespace-pre-wrap break-words rounded-sm border-l-2 border-gold-600/45 bg-paper-100/35 px-4 py-2 font-body text-[1rem] leading-relaxed text-ink-800">
      {visible}
    </div>
  );
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
    <button type="button" aria-pressed={active} onClick={onClick} className={clsx("rounded border px-3 py-1 font-heading text-[0.7rem] uppercase tracking-wider transition-colors", active ? "border-burgundy-600 bg-burgundy-600 text-paper-50" : "border-gold-600/45 bg-paper-50/50 text-sepia-700 hover:bg-paper-200")}>
      {label}
    </button>
  );
}

function SmallButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className="grid h-7 min-w-7 place-items-center rounded border border-gold-600/45 bg-paper-50/60 px-1.5 font-heading text-xs font-semibold text-gold-800 hover:bg-gold-200/50">{children}</button>;
}

function Separator() {
  return <span className="mx-0.5 h-6 w-px bg-gold-600/35" aria-hidden />;
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
