import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import type { EntryBundle, IndexEntry, MediaItem } from "@/lib/types";
import { resolveContentPath, resolveResourcePath } from "@/lib/paths";
import { audio, themeFromSeed } from "@/lib/audio";
import { audioKind, stopAllPlayback } from "@/lib/playback";
import { useI18n } from "@/lib/i18n";
import { AudioPlayer } from "../AudioPlayer";
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
          <AudioPlayer
            key={i}
            src={resolveResourcePath(track.target)}
            label={track.label}
            kind={audioKind(track.target) ?? "native"}
          />
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
      stopAllPlayback(); // any playing recording yields to the hero theme
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
