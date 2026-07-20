import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import { useAudioPlayback, type AudioKind } from "@/lib/playback";

/**
 * Built-in audio player, styled in the manuscript theme. `AudioPlayer` is the
 * full block control (Gallery, document cards); `InlineAudioPlayer` is a
 * compact pill for audio links inside prose/tables. Both play mp3 & MIDI via
 * useAudioPlayback and always offer a download alongside playback.
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

  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded border border-gold-600/50 bg-paper-100/80 px-1.5 py-0.5 align-baseline leading-none">
      <button
        onClick={toggle}
        disabled={error}
        aria-label={`${playing ? t("audio.pause") : t("audio.play")}: ${label}`}
        className="inline-grid h-4 w-4 place-items-center text-gold-800 transition-colors hover:text-burgundy-600 disabled:opacity-50"
      >
        {playing ? <PauseIcon small /> : <PlayIcon small />}
      </button>
      <span className="font-heading text-[0.85em] tracking-wide text-ink-800">{label}</span>
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
