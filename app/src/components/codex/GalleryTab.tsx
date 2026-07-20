import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import clsx from "clsx";
import type { EntryBundle, IndexEntry, MediaItem } from "@/lib/types";
import { resolveContentPath, resolveResourcePath } from "@/lib/paths";
import { audio, themeFromSeed } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { Divider } from "../OrnateFrame";

interface Props {
  entry: IndexEntry;
  slug: string;
  bundle: EntryBundle;
}

/** Gallery — media.photos + media.music (docs/MetaData.md), plus the
 *  entry's procedurally generated theme (f = f₀·2^(n/12), seeded by name). */
export function GalleryTab({ entry, slug, bundle }: Props) {
  const { t } = useI18n();
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);

  const photos: MediaItem[] = [
    // the index portrait always leads the gallery
    { label: entry.title, target: resolveContentPath(entry.img) },
    ...(bundle.data?.media?.photos ?? []).map((photo) => ({
      ...photo,
      target: resolveResourcePath(photo.target),
    })),
  ];
  const music = bundle.data?.media?.music ?? [];

  // close lightbox on ESC (capture phase beats the modal's own ESC handler)
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setLightbox(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lightbox]);

  return (
    <div>
      <h3 className="mb-3 text-center font-heading text-sm uppercase tracking-[0.25em] text-burgundy-700">
        {t("gallery.photos")}
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photos.map((p, i) => (
          <figure
            key={i}
            className="bio-figure m-0 cursor-zoom-in"
            onClick={() => setLightbox({ src: p.target, label: p.label })}
          >
            <img
              src={p.target}
              alt={p.label}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full object-cover"
              onError={(e) => {
                e.currentTarget.closest("figure")!.style.display = "none";
              }}
            />
            <figcaption>{p.label}</figcaption>
          </figure>
        ))}
      </div>

      <Divider className="my-7" />

      <h3 className="mb-3 text-center font-heading text-sm uppercase tracking-[0.25em] text-burgundy-700">
        {t("gallery.music")}
      </h3>
      <div className="mx-auto max-w-xl space-y-2">
        {music.map((track, i) => (
          <TrackRow key={i} track={track} />
        ))}
        <ThemeRow slug={slug} name={entry.title} />
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <m.div
            className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            role="button"
            aria-label={t("gallery.close")}
          >
            <m.img
              src={lightbox.src}
              alt={lightbox.label}
              className="max-h-[82vh] max-w-full border-2 border-gold-500/80 object-contain shadow-[0_20px_70px_rgba(0,0,0,0.6)]"
              initial={{ scale: 0.92, rotateY: -8 }}
              animate={{ scale: 1, rotateY: 0 }}
              exit={{ scale: 0.94 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
            <p className="mt-3 max-w-xl text-center font-body italic text-paper-100">{lightbox.label}</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One archival recording. Missing files fail soft into an archive note. */
function TrackRow({ track }: { track: MediaItem }) {
  const { t } = useI18n();
  const ref = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<"idle" | "playing" | "broken">("idle");

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el || state === "broken") return;
    if (state === "playing") {
      el.pause();
      setState("idle");
    } else {
      audio.stopTheme();
      el.play().then(
        () => setState("playing"),
        () => setState("broken"),
      );
    }
  }, [state]);

  return (
    <div
      className={clsx(
        "flex items-center gap-3 border border-gold-600/40 bg-paper-100/70 px-4 py-2.5",
        state === "broken" && "opacity-70",
      )}
    >
      <button
        onClick={toggle}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold-600/60 text-gold-800 transition-colors hover:bg-gold-500/20 disabled:cursor-not-allowed"
        aria-label={track.label}
        disabled={state === "broken"}
      >
        {state === "playing" ? "❚❚" : "♪"}
      </button>
      <div className="min-w-0">
        <div className="truncate font-heading text-sm text-ink-800">{track.label}</div>
        {state === "broken" && <div className="text-xs italic text-sepia-600">{t("audio.unavailable")}</div>}
      </div>
      <audio
        ref={ref}
        src={resolveResourcePath(track.target)}
        preload="none"
        onEnded={() => setState("idle")}
        onError={() => setState("broken")}
      />
    </div>
  );
}

/** The entry's generated leitmotif — same name, same melody, every visit. */
function ThemeRow({ slug, name }: { slug: string; name: string }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);

  // stop when leaving the tab/modal
  useEffect(() => () => audio.stopTheme(), []);

  const toggle = () => {
    audio.unlock();
    if (playing) {
      audio.stopTheme();
      setPlaying(false);
    } else {
      audio.startTheme(themeFromSeed(slug));
      setPlaying(true);
    }
  };

  return (
    <div className="border border-gold-600/60 bg-gradient-to-r from-paper-100 to-paper-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-heading text-sm uppercase tracking-wider text-burgundy-700">
            ✦ {t("gallery.theme")} — {name}
          </div>
          <div className="mt-0.5 text-xs italic text-sepia-600">{t("gallery.themeHint")}</div>
        </div>
        <button onClick={toggle} className="btn-rpg shrink-0 !text-[0.7rem]">
          {playing ? t("gallery.themeStop") : t("gallery.themePlay")}
        </button>
      </div>
      {playing && <EqualizerBars />}
    </div>
  );
}

/** Purely decorative CSS equalizer — no analyser polling, near-zero cost. */
function EqualizerBars() {
  return (
    <div className="mt-2 flex h-5 items-end gap-1" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 origin-bottom rounded-t bg-gold-600/80"
          style={{
            height: `${30 + ((i * 37) % 60)}%`,
            animation: `eq-bounce ${0.7 + (i % 5) * 0.13}s ease-in-out ${i * 0.06}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}
