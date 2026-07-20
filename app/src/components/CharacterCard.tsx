import { useState } from "react";
import {
  m,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import type { IndexEntry } from "@/lib/types";
import { langInfo, type Lang } from "@/lib/languages";
import { resolveContentPath } from "@/lib/paths";
import { accentFor, countryDisplay, rankStars } from "@/lib/metadata";
import { initialsOf, placeholderPortrait } from "@/lib/placeholder";
import { audio } from "@/lib/audio";
import { typeLabel, useI18n } from "@/lib/i18n";
import { preloadCodexModal } from "./codex/LazyCodexModal";
import clsx from "clsx";
import { Flag } from "./Flag";
import { OrnateFrame, RankStars } from "./OrnateFrame";

interface Props {
  entry: IndexEntry;
  slug: string;
  /** metadata.ranking once the entry's bio.json is prefetched. */
  ranking?: number;
  /** Entry has no edition in the reader's language — render dimmed with a
   *  burgundy cast and flag chips of the tongues it IS written in. */
  foreign?: boolean;
  /** Languages this entry is available in (shown on foreign cards). */
  langs?: Lang[];
  /** Load above-the-fold portraits immediately; defer the rest. */
  eager?: boolean;
  onSelect: (slug: string) => void;
}

/**
 * Catalogue card — CodexLegends' pointer-tilt 3D card with cursor glare and
 * shine sweep, re-themed to the light manuscript palette. The 3D tilt only
 * engages on fine pointers; touch devices get the cheap path.
 */
export function CharacterCard({ entry, slug, ranking, foreign = false, langs = [], eager = false, onSelect }: Props) {
  const { t, locale } = useI18n();
  const accent = foreign ? "#8b2635" : accentFor(slug);
  const stars = rankStars(ranking);
  const [imgFailed, setImgFailed] = useState(false);
  const langNames = langs.map((c) => langInfo(c).native).join(" · ");

  // pointer-driven tilt
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 95, damping: 18, mass: 0.7 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [12, -12]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-12, 12]), spring);

  // cursor glare (warm paper light, not white neon)
  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(251,243,210,0.5), transparent 46%)`;

  function onMove(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  const displayTitle = entry.title;
  const subtitle = [typeLabel(t, entry.type), countryDisplay(entry.country, locale)]
    .filter(Boolean)
    .join(" · ");

  const portraitSrc = imgFailed
    ? placeholderPortrait(slug, initialsOf(entry.forename, entry.surname))
    : resolveContentPath(entry.img);

  return (
    <m.button
      type="button"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onPointerEnter={preloadCodexModal}
      onFocus={preloadCodexModal}
      onMouseEnter={() => audio.hover()}
      onClick={() => {
        audio.unlock();
        window.setTimeout(() => onSelect(slug), 70);
      }}
      style={{ rotateX, rotateY, transformPerspective: 720 }}
      whileHover={{ y: -8, scale: 1.045 }}
      transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.7 }}
      whileTap={{ scale: 0.97 }}
      className="group preserve-3d relative block w-full cursor-pointer text-left"
      aria-label={t("card.open", { name: displayTitle })}
    >
      <OrnateFrame
        accent={foreign ? "#8b2635" : "#b8902a"}
        cornerClassName="h-6 w-6 opacity-65 transition-opacity duration-500 group-hover:opacity-90 sm:h-7 sm:w-7"
      >
        <div
          className={clsx(
            "relative overflow-hidden rounded-lg border bg-paper-100",
            foreign
              ? "border-burgundy-500/40 opacity-90 shadow-[0_4px_18px_rgba(94,18,32,0.2)] saturate-[0.82] transition-opacity duration-300 group-hover:opacity-100"
              : "border-gold-600/40 shadow-[0_4px_18px_rgba(84,56,30,0.22)]",
          )}
        >
          {/* portrait */}
          <div className="relative aspect-[3/4] overflow-hidden">
            <img
              src={portraitSrc}
              alt={displayTitle}
              loading={eager ? "eager" : "lazy"}
              fetchPriority={eager ? "high" : undefined}
              decoding="async"
              className={clsx(
                "absolute inset-0 h-full w-full object-cover object-top transition-[transform,filter] duration-[1200ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110",
                foreign
                  ? "[filter:sepia(0.42)_grayscale(0.38)_brightness(0.96)_blur(0.5px)] group-hover:[filter:sepia(0.2)_grayscale(0.12)_blur(0)]"
                  : "[filter:sepia(0.28)_blur(0.5px)] group-hover:[filter:sepia(0.05)_blur(0)]",
              )}
              onError={() => setImgFailed(true)}
            />
            {/* archival colour grade — foreign pages take a burgundy cast */}
            <div
              className={clsx("absolute inset-0 mix-blend-soft-light", foreign ? "opacity-60" : "opacity-45")}
              style={{ background: `radial-gradient(120% 80% at 50% 0%, ${accent}${foreign ? "66" : "44"}, transparent 62%)` }}
            />
            {/* aged fade towards the name plate */}
            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-paper-100 to-transparent" />

            {/* cursor glare */}
            <m.div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: glare }}
            />

            {/* shine sweep */}
            <span className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="absolute -inset-y-2 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-gold-100/50 to-transparent opacity-0 transition-all duration-1000 group-hover:left-[120%] group-hover:opacity-100" />
            </span>

            {/* top badges */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
              <span className="rounded-sm bg-burgundy-600/90 px-1.5 py-0.5 font-heading text-[0.6rem] font-bold uppercase tracking-wider text-paper-50">
                {typeLabel(t, entry.type)}
              </span>
              <span className="flex flex-col items-end gap-1">
                {stars !== null && <RankStars count={stars} accent={foreign ? "#8b2635" : "#8a6a1f"} />}
                {/* foreign find — flags of the tongues this entry IS written in */}
                {foreign && langs.length > 0 && (
                  <span
                    className="flex flex-col items-end gap-0.5"
                    title={t("card.foreignHint", { langs: langNames })}
                    aria-label={t("card.foreignHint", { langs: langNames })}
                  >
                    {langs.slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className="flex items-center gap-1 rounded-sm border border-burgundy-500/50 bg-paper-50/92 px-1 py-0.5 shadow-[0_1px_4px_rgba(94,18,32,0.25)]"
                      >
                        <Flag code={c} className="h-2.5 w-4" />
                        <span className="font-heading text-[0.52rem] font-bold uppercase tracking-wider text-burgundy-700">
                          {c}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* name plate — below the portrait, on paper */}
          <div className="relative px-3 pb-3 pt-1.5 text-center">
            <h3
              className={clsx(
                "font-heading text-lg font-bold leading-tight sm:text-xl",
                foreign ? "text-ink-900/75" : "text-ink-900",
              )}
            >
              {displayTitle}
            </h3>
            <p
              className={clsx(
                "mt-0.5 truncate font-body text-xs italic",
                foreign ? "text-burgundy-700/65" : "text-sepia-600",
              )}
            >
              {subtitle}
            </p>
            {/* hover underline flourish */}
            <span
              className={clsx(
                "mx-auto mt-1.5 block h-px w-10 transition-all duration-500 group-hover:w-24",
                foreign ? "bg-burgundy-500/50 group-hover:bg-burgundy-500" : "bg-gold-600/50 group-hover:bg-gold-600",
              )}
            />
          </div>

          {/* hover glow ring — gold for native finds, burgundy for foreign */}
          <div
            className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{
              boxShadow: foreign
                ? `inset 0 0 0 1.5px #8b2635, 0 10px 34px rgba(122,31,43,0.3)`
                : `inset 0 0 0 1.5px #b8902a, 0 10px 34px rgba(138,106,31,0.35)`,
            }}
          />
        </div>
      </OrnateFrame>
    </m.button>
  );
}
