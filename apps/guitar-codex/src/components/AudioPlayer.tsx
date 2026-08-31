import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import { useAudioPlayback, type AudioKind } from "@/lib/playback";
import { Glyph } from "@/components/Glyph";
import { SIGN } from "@/lib/signs";

/**
 * Built-in audio player, styled in the manuscript theme. `AudioPlayer` is the
 * full block control (Gallery, document cards); `InlineAudioPlayer` is a
 * compact pill for audio links inside prose/tables. Both play every container
 * the browser has a decoder for (mp3, m4a/AAC, wav, ogg/opus, flac, aiff, …)
 * plus MIDI through the built-in synth, and always offer a download alongside
 * playback.
 *
 * `AudioDownload` / `InlineAudioDownload` are the same two shapes for a
 * recording the browser *cannot* decode — the archive's WMA and RealAudio
 * files. They are still recordings and still worth offering, so they get the
 * card and the download without a play button that could only ever fail.
 */

interface Props {
  src: string;
  label: string;
  kind: AudioKind;
}

export function AudioPlayer({ src, label, kind }: Props) {
  const { t } = useI18n();
  const { status, currentTime, duration, toggle, seek } = useAudioPlayback(src, kind);
  const playing = status === "playing";
  const error = status === "error";
  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={clsx(
        "flex items-center gap-3 border border-gold-600/40 bg-paper-100/70 px-4 py-2.5",
        error && "opacity-70",
      )}
    >
      <button
        onClick={toggle}
        disabled={error}
        aria-label={`${playing ? t("audio.pause") : t("audio.play")}: ${label}`}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold-600/60 text-gold-800 transition-colors hover:bg-gold-500/20 disabled:cursor-not-allowed"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-heading text-sm text-ink-800">{label}</span>
          <FormatBadge kind={kind} src={src} />
        </div>

        {error ? (
          <div className="mt-1 text-xs italic text-sepia-600">{t("audio.unavailable")}</div>
        ) : (
          <>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
              onClick={(e) => {
                if (!duration) return;
                const r = e.currentTarget.getBoundingClientRect();
                seek(clamp01((e.clientX - r.left) / r.width) * duration);
              }}
              className={clsx(
                "relative mt-1.5 h-2 overflow-hidden rounded-full border border-gold-700/40 bg-paper-300",
                duration ? "cursor-pointer" : "opacity-60",
              )}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-burgundy-600 via-gold-600 to-gold-400"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-0.5 flex justify-between font-body text-[0.7rem] tabular-nums text-sepia-600">
              <span>{formatTime(currentTime)}</span>
              <span>{duration ? formatTime(duration) : "--:--"}</span>
            </div>
          </>
        )}
      </div>

      <DownloadLink src={src} label={label} className="btn-rpg shrink-0 !px-3 !py-1 !text-[0.65rem]">
        {t("audio.download")}
      </DownloadLink>
    </div>
  );
}

export function InlineAudioPlayer({ src, label, kind }: Props) {
  const { t } = useI18n();
  const { status, currentTime, toggle } = useAudioPlayback(src, kind);
  const playing = status === "playing";
  const error = status === "error";
  const format = formatWord(label, src);

  return (
    <span className="audio-pill">
      <button
        onClick={toggle}
        disabled={error}
        aria-label={`${playing ? t("audio.pause") : t("audio.play")}: ${label}`}
        className="inline-grid h-4 w-4 place-items-center text-gold-800 transition-colors hover:text-burgundy-600 disabled:opacity-50"
      >
        {playing ? <PauseIcon small /> : <PlayIcon small />}
      </button>
      {format ? (
        <FormatIcon kind={kind} format={format} />
      ) : (
        <span className="font-heading text-[0.85em] tracking-wide text-ink-800">{label}</span>
      )}
      {playing && (
        <span className="font-body text-[0.72em] tabular-nums text-sepia-600">{formatTime(currentTime)}</span>
      )}
      <DownloadLink
        src={src}
        label={label}
        className="inline-grid h-4 w-4 place-items-center text-sepia-500 transition-colors hover:text-burgundy-600"
      >
        <DownloadIcon small />
      </DownloadLink>
    </span>
  );
}

/** A recording in a format this browser cannot decode: everything the player
 *  gives except playback. */
export function AudioDownload({ src, label, kind }: { src: string; label: string; kind: AudioKind }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 border border-gold-600/40 bg-paper-100/70 px-4 py-2.5">
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold-600/40 text-sepia-500"
      >
        <Glyph char={SIGN.note} font="var(--font-music)" size="1.05rem" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-heading text-sm text-ink-800">{label}</span>
          <FormatBadge kind={kind} src={src} />
        </div>
        <div className="mt-1 text-xs italic text-sepia-600">{t("audio.noCodec")}</div>
      </div>
      <DownloadLink src={src} label={label} className="btn-rpg shrink-0 !px-3 !py-1 !text-[0.65rem]">
        {t("audio.download")}
      </DownloadLink>
    </div>
  );
}

/** The inline pill for the same case. */
export function InlineAudioDownload({ src, label }: { src: string; label: string }) {
  const { t } = useI18n();
  const format = formatWord(label, src);
  return (
    <span className="audio-pill audio-pill--mute" title={t("audio.noCodec")}>
      <Glyph char={SIGN.note} font="var(--font-music)" size="0.8em" className="text-sepia-500" />
      {format ? (
        <FormatIcon kind="native" format={format} />
      ) : (
        <span className="font-heading text-[0.85em] tracking-wide text-ink-800">{label}</span>
      )}
      <DownloadLink
        src={src}
        label={label}
        className="inline-grid h-4 w-4 place-items-center text-sepia-500 transition-colors hover:text-burgundy-600"
      >
        <DownloadIcon small />
      </DownloadLink>
    </span>
  );
}

function DownloadLink({
  src,
  label,
  className,
  children,
}: {
  src: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <a
      href={src}
      download
      aria-label={`${t("audio.download")}: ${label}`}
      title={t("audio.download")}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
}

/**
 * Formats the archive links a recording *as*, rather than by name: the legacy
 * tables are full of `[MIDI](…)` and `[MP3](…)`, so the pill's label is the
 * word "MIDI" — set in small caps between a play triangle and a download
 * arrow, three pieces of chrome around one redundant word, inside a table cell
 * that has to fit on a phone. Where the label says nothing the icon does not,
 * the word is drawn as its sign and moves into the accessible name.
 *
 * A label that carries real information ("Tico-Tico, Duo Hill/Wilczynski")
 * is never replaced.
 */
const FORMAT_WORD = /^(midi?|rmi|kar|mp3|mp4|m4a|m4b|aac|wma|wav|wave|ogg|oga|opus|flac|aiff?|ra|ram|rm|au|snd|audio)$/i;

function formatWord(label: string, src: string): string | null {
  const word = label.trim().replace(/^[[({]+|[\])}.]+$/g, "");
  if (!word) return null;
  const extension = src.split(/[?#]/, 1)[0].split(".").pop() ?? "";
  if (FORMAT_WORD.test(word) || word.toLowerCase() === extension.toLowerCase()) {
    return word.toUpperCase();
  }
  return null;
}

/** Two signs, not eight: what a reader needs from this glyph is "synthesised
 *  or recorded", and the exact container is in the tooltip and the accessible
 *  name where it belongs. */
function FormatIcon({ kind, format }: { kind: AudioKind; format: string }) {
  const shared = { viewBox: "0 0 24 24", className: "audio-format-icon", role: "img" as const };
  return kind === "midi" ? (
    <svg {...shared} fill="none" stroke="currentColor" strokeWidth="2">
      <title>{format}</title>
      <rect x="3" y="5.5" width="18" height="13" rx="1.6" />
      <path d="M8.5 5.5v7.5M15.5 5.5v7.5" />
    </svg>
  ) : (
    <svg {...shared} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <title>{format}</title>
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor" />
      <path d="M16 9a4.5 4.5 0 0 1 0 6" strokeLinecap="round" />
    </svg>
  );
}

function FormatBadge({ kind, src }: { kind: AudioKind; src: string }) {
  const ext = src.split(/[?#]/, 1)[0].split(".").pop() ?? "";
  const label = kind === "midi" ? "MIDI" : ext.toUpperCase() || "AUDIO";
  return (
    <span className="shrink-0 rounded-sm border border-gold-600/50 bg-paper-200/70 px-1.5 py-0.5 font-heading text-[0.6rem] font-bold uppercase tracking-wider text-gold-800">
      {label}
    </span>
  );
}

function PlayIcon({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={small ? "h-2.5 w-2.5" : "h-4 w-4"} fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={small ? "h-2.5 w-2.5" : "h-4 w-4"} fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function DownloadIcon({ small }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={small ? "h-3 w-3" : "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
    </svg>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
