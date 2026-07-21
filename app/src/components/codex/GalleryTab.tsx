import { useEffect, useState } from "react";
import type { EntryBundle, IndexEntry, MediaItem } from "@/lib/types";
import { resolveContentPath, resolveResourcePath } from "@/lib/paths";
import { audio, themeFromSeed } from "@/lib/audio";
import { audioKind, stopAllPlayback } from "@/lib/playback";
import { useI18n } from "@/lib/i18n";
import { useImageViewer } from "@/lib/imageViewer";
import { isAsciiTabUrl } from "@/lib/asciiTab";
import { useAsciiTabViewer } from "@/lib/asciiTabViewer";
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
  const openImage = useImageViewer();
  const openTab = useAsciiTabViewer();

  const photos: MediaItem[] = [
    // the index portrait always leads the gallery
    { label: entry.title, target: resolveContentPath(entry.img) },
    ...(bundle.data?.media?.photos ?? []).map((photo) => ({
      ...photo,
      target: resolveResourcePath(photo.target),
    })),
  ];
  const music = bundle.data?.media?.music ?? [];

  return (
    <div>
      <h3 className="mb-3 text-center font-heading text-sm uppercase tracking-[0.25em] text-burgundy-700">
        {t("gallery.photos")}
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photos.map((p) => (
          <figure
            key={p.target}
            className="bio-figure m-0 cursor-zoom-in"
            onClick={() => openImage({ src: p.target, alt: p.label, caption: p.label })}
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
        {music.map((track) => {
          const src = resolveResourcePath(track.target);
          return isAsciiTabUrl(track.target) ? (
            <button
              type="button"
              key={track.target}
              onClick={() => openTab({ src, label: track.label, download: track.target.split(/[?#]/, 1)[0].split("/").pop() })}
              className="flex w-full items-center gap-3 border border-gold-600/40 bg-paper-100/70 px-4 py-2.5 text-left transition-shadow hover:shadow-[0_2px_14px_rgba(138,106,31,0.25)]"
            >
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold-600/60 text-lg text-gold-800">𝄞</span>
              <span className="min-w-0 flex-1 truncate font-heading text-sm text-ink-800">{track.label}</span>
              <span className="rounded-sm border border-gold-600/50 bg-paper-200/70 px-1.5 py-0.5 font-heading text-[0.6rem] font-bold tracking-wider text-gold-800">TAB</span>
              <span className="btn-rpg !px-3 !py-1 !text-[0.65rem]">{t("docs.open")}</span>
            </button>
          ) : (
            <AudioPlayer key={track.target} src={src} label={track.label} kind={audioKind(track.target) ?? "native"} />
          );
        })}
        <ThemeRow slug={slug} name={entry.title} />
      </div>

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
