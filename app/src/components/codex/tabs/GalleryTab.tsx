import { useEffect, useState } from "react";
import type { EntryBundle, MediaItem } from "@/lib/types";
import type { CatalogRecord } from "@/lib/catalog";
import { resolveContentPath, resolveResourcePath } from "@/lib/paths";
import { audio, themeFromSeed } from "@/lib/audio";
import { audioKind, isUnplayableAudioUrl, stopAllPlayback } from "@/lib/playback";
import { useI18n } from "@/lib/i18n";
import { useImageViewer } from "@/lib/imageViewer";
import { isAsciiTabUrl } from "@/lib/asciiTab";
import { useAsciiTabViewer } from "@/lib/asciiTabViewer";
import { AudioDownload, AudioPlayer } from "@/components/AudioPlayer";
import { Divider } from "@/components/OrnateFrame";
import { CurlFrame } from "@/components/CurlFrame";

interface Props {
  record: CatalogRecord;
  bundle: EntryBundle;
}

/** Gallery — media.photos + media.music (docs/MetaData.md), plus the
 *  entry's procedurally generated theme (f = f₀·2^(n/12), seeded by name). */
export function GalleryTab({ record, bundle }: Props) {
  const { entry, slug, display } = record;
  const { t } = useI18n();
  const openImage = useImageViewer();
  const openTab = useAsciiTabViewer();

  const photos: MediaItem[] = dedupeByName([
    // A declared index portrait leads the gallery; the synthetic default
    // portrait is chrome, not a photograph, so it stays out.
    ...(entry.img ? [{ label: display, target: resolveContentPath(entry.img) }] : []),
    ...(bundle.data?.media?.photos ?? []).map((photo) => ({
      ...photo,
      target: resolveResourcePath(photo.target),
    })),
  ]);
  // Real recordings first, MIDI next, tab/text transcriptions last — the
  // archive's own priority order for "music", not the filesystem's alphabetical
  // one the source data happens to arrive in. `Array#sort` is a stable sort, so
  // within one tier the original order survives.
  const music = [...(bundle.data?.media?.music ?? [])].sort((a, b) => trackRank(a.target) - trackRank(b.target));

  return (
    <div>
      <h3 className="mb-3 text-center font-heading text-sm uppercase tracking-[0.25em] text-burgundy-700">
        {t("gallery.photos")}
      </h3>
      {/* Column count from the pane, the way the catalogue derives its own. */}
      <div className="gallery-grid">
        {photos.map((p) => (
          <figure
            key={p.target}
            className="bio-figure m-0 cursor-zoom-in"
            onClick={() => openImage({ src: p.target, alt: p.label, caption: p.label })}
          >
            <CurlFrame>
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
            </CurlFrame>
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
          ) : isUnplayableAudioUrl(track.target) ? (
            // A recording this browser has no decoder for (the archive's WMA
            // and RealAudio). Offering it beats a play button that only errors.
            <AudioDownload key={track.target} src={src} label={track.label} kind="native" />
          ) : (
            <AudioPlayer key={track.target} src={src} label={track.label} kind={audioKind(track.target) ?? "native"} />
          );
        })}
        <ThemeRow slug={slug} name={display} />
      </div>

    </div>
  );
}

/** One figure per *file name*, not per URL. The index portrait and a
 *  media.photos entry sometimes name the same picture through two different
 *  paths — the same JPEG filed once under the entry's own bucket and once
 *  under a shared `photo/` folder — which a same-URL check does not catch,
 *  so the same face appeared twice under "Portraits & photographs". Entries
 *  are compared by filename instead, first occurrence keeping the slot (so
 *  the declared portrait still leads by default), but a later duplicate with
 *  a longer, more descriptive caption takes over that slot — a plain repeat
 *  of the entry's name should not beat an actual description of the photo. */
function dedupeByName(items: MediaItem[]): MediaItem[] {
  const order: string[] = [];
  const best = new Map<string, MediaItem>();
  for (const item of items) {
    const name = fileName(item.target);
    const current = best.get(name);
    if (!current) {
      order.push(name);
      best.set(name, item);
    } else if (item.label.trim().length > current.label.trim().length) {
      best.set(name, item);
    }
  }
  return order.map((name) => best.get(name)!);
}

function fileName(target: string): string {
  return target.split(/[?#]/, 1)[0].split("/").pop()?.toLowerCase() ?? target;
}

/** Real recordings (mp3, m4a, wma, ogg, …) before MIDI before tab/text —
 *  ask the same format tables the players already use rather than hand-
 *  rolling an extension list. */
function trackRank(target: string): number {
  if (isAsciiTabUrl(target)) return 2;
  if (audioKind(target) === "midi") return 1;
  return 0;
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
