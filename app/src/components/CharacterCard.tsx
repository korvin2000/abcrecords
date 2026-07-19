import { useState } from "react";
import {
  m,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import type { IndexEntry } from "@/lib/types";
import { resolveContentPath } from "@/lib/paths";
import { accentFor, countryDisplay, rankStars } from "@/lib/metadata";
import { initialsOf, placeholderPortrait } from "@/lib/placeholder";
import { audio } from "@/lib/audio";
import { typeLabel, useI18n } from "@/lib/i18n";
import { OrnateFrame, RankStars } from "./OrnateFrame";

interface Props {
  entry: IndexEntry;
  slug: string;
  /** metadata.ranking once the entry's bio.json is prefetched. */
  ranking?: number;
  onSelect: (slug: string) => void;
}

/**
 * Catalogue card — CodexLegends' pointer-tilt 3D card with cursor glare and
 * shine sweep, re-themed to the light manuscript palette. The 3D tilt only
 * engages on fine pointers; touch devices get the cheap path.
 */
export function CharacterCard({ entry, slug, ranking, onSelect }: Props) {
  const { t, locale } = useI18n();
  const reduced = useReducedMotion();
  const accent = accentFor(slug);
  const stars = rankStars(ranking);
  const [imgFailed, setImgFailed] = useState(false);

  // pointer-driven tilt
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 180, damping: 16, mass: 0.4 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [9, -9]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), spring);

  // cursor glare (warm paper light, not white neon)
  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(251,243,210,0.5), transparent 46%)`;

  function onMove(e: React.MouseEvent<HTMLButtonElement>) {
    if (reduced) return;
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
      onMouseEnter={() => audio.hover()}
      onClick={() => {
        audio.unlock();
        audio.click();
        window.setTimeout(() => onSelect(slug), 70);
      }}
      style={reduced ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      whileHover={reduced ? undefined : { scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      className="group preserve-3d relative block w-full cursor-pointer text-left"
      aria-label={t("card.open", { name: displayTitle })}
    >
      <OrnateFrame
        accent="#b8902a"
        cornerClassName="h-6 w-6 opacity-65 transition-opacity duration-300 group-hover:opacity-90 sm:h-7 sm:w-7"
      >
        <div className="relative overflow-hidden rounded-lg border border-gold-600/40 bg-paper-100 shadow-[0_4px_18px_rgba(84,56,30,0.22)]">
          {/* portrait */}
          <div className="relative aspect-[3/4] overflow-hidden">
            <img
              src={portraitSrc}
              alt={displayTitle}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-700 ease-out [filter:sepia(0.28)] group-hover:scale-108 group-hover:[filter:sepia(0.05)]"
              onError={() => setImgFailed(true)}
            />
            {/* archival colour grade */}
            <div
              className="absolute inset-0 opacity-45 mix-blend-soft-light"
              style={{ background: `radial-gradient(120% 80% at 50% 0%, ${accent}44, transparent 62%)` }}
            />
            {/* aged fade towards the name plate */}
            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-paper-100 to-transparent" />

            {/* cursor glare */}
            {!reduced && (
              <m.div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: glare }}
              />
            )}

            {/* shine sweep */}
            <span className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="absolute -inset-y-2 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-gold-100/50 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
            </span>

            {/* top badges */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
              <span className="rounded-sm bg-burgundy-600/90 px-1.5 py-0.5 font-heading text-[0.6rem] font-bold uppercase tracking-wider text-paper-50">
                {typeLabel(t, entry.type)}
              </span>
              {stars !== null && <RankStars count={stars} accent="#8a6a1f" />}
            </div>
          </div>

          {/* name plate — below the portrait, on paper */}
          <div className="relative px-3 pb-3 pt-1.5 text-center">
            <h3 className="font-heading text-lg font-bold leading-tight text-ink-900 sm:text-xl">
              {displayTitle}
            </h3>
            <p className="mt-0.5 truncate font-body text-xs italic text-sepia-600">{subtitle}</p>
            {/* hover underline flourish */}
            <span className="mx-auto mt-1.5 block h-px w-10 bg-gold-600/50 transition-all duration-500 group-hover:w-24 group-hover:bg-gold-600" />
          </div>

          {/* hover glow ring — warm gold, restrained */}
          <div
            className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{ boxShadow: `inset 0 0 0 1.5px #b8902a, 0 10px 34px rgba(138,106,31,0.35)` }}
          />
        </div>
      </OrnateFrame>
    </m.button>
  );
}
