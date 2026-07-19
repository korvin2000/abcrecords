import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RARITY_STYLES, type Character } from "@/types/character";
import { audio } from "@/lib/audioEngine";
import { powerRating } from "@/lib/procedural";
import { OrnateFrame, RarityStars, Divider } from "./OrnateFrame";
import { BiographyView } from "./BiographyView";
import { StatPanel } from "./StatPanel";
import { MediaGallery } from "./MediaGallery";
import { MusicPlayer } from "./MusicPlayer";

interface Props {
  character: Character;
  siblings: Character[];
  allById: Map<string, Character>;
  onClose: () => void;
  onNavigate: (id: string) => void;
  audioEnabled: boolean;
}

const TABS = [
  { id: "bio", label: "Biography", icon: "📖" },
  { id: "stats", label: "Attributes", icon: "⚔️" },
  { id: "gallery", label: "Gallery", icon: "🖼️" },
  { id: "lore", label: "Lore", icon: "🕯️" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const GENDER_GLYPH: Record<string, string> = { Female: "♀", Male: "♂", Nonbinary: "⚧" };

export function CharacterDetail({
  character,
  siblings,
  allById,
  onClose,
  onNavigate,
  audioEnabled,
}: Props) {
  const { meta } = character;
  const rarity = RARITY_STYLES[meta.rarity];
  const accent = meta.accent;
  const [tab, setTab] = useState<TabId>("bio");

  // entrance / exit sound + scroll lock
  useEffect(() => {
    audio.open();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      audio.stopTheme();
      document.body.style.overflow = prev;
    };
  }, []);

  // keyboard navigation
  const index = siblings.findIndex((c) => c.meta.id === meta.id);
  const canCycle = index >= 0 && siblings.length > 1;
  const go = (dir: number) => {
    if (!canCycle) return;
    const next = siblings[(index + dir + siblings.length) % siblings.length];
    audio.pageTurn();
    onNavigate(next.meta.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (document.querySelector("[data-lightbox]")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, siblings, canCycle]);

  const changeTab = (t: TabId) => {
    if (t === tab) return;
    audio.pageTurn();
    setTab(t);
  };

  const power = powerRating(character.stats);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* backdrop */}
      <div className="fixed inset-0 -z-10 bg-ink-950/80 backdrop-blur-md" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className="relative my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-gold-500/25 bg-ink-900/90 shadow-[0_30px_120px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      >
        {/* accent ambient wash */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[120%] -translate-x-1/2 opacity-30 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${accent}, transparent)` }}
        />

        {/* top bar */}
        <div className="relative flex items-center justify-between border-b border-gold-500/15 bg-ink-950/40 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <NavBtn dir="prev" disabled={!canCycle} onClick={() => go(-1)} accent={accent} />
            <span className="hidden font-heading text-xs uppercase tracking-[0.25em] text-parchment/40 sm:inline">
              Codex · Entry
            </span>
          </div>
          <span className={`font-heading text-[0.7rem] uppercase tracking-[0.3em] ${rarity.text}`}>
            {rarity.label}
          </span>
          <div className="flex items-center gap-2">
            <NavBtn dir="next" disabled={!canCycle} onClick={() => go(1)} accent={accent} />
            <button
              onClick={() => {
                audio.close();
                onClose();
              }}
              onMouseEnter={() => audio.hover()}
              className="rounded-full border border-gold-500/30 p-2 text-gold-200 transition-colors hover:bg-gold-500/15"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.8fr_1.2fr]">
          {/* LEFT — portrait + music */}
          <div className="space-y-4">
            <OrnateFrame accent={rarity.border}>
              <div className="relative overflow-hidden rounded-xl border border-gold-500/20">
                <div
                  className="absolute -inset-6 -z-10 opacity-50 blur-2xl anim-aura"
                  style={{ background: `radial-gradient(closest-side, ${accent}, transparent)` }}
                />
                <img
                  src={character.portrait}
                  alt={`${meta.firstName} ${meta.surname}`}
                  className="aspect-[3/4] w-full object-cover object-top anim-floaty-slow"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-transparent to-transparent" />
                <div className="absolute left-3 top-3 flex gap-1.5">
                  <span className="rounded-md px-2 py-0.5 font-heading text-[0.6rem] font-bold uppercase tracking-wider text-ink-950" style={{ backgroundColor: accent }}>
                    {meta.archetype}
                  </span>
                  <span className="rounded-md border border-white/15 bg-ink-950/60 px-2 py-0.5 font-heading text-[0.55rem] uppercase tracking-wider text-parchment/80 backdrop-blur">
                    {meta.element}
                  </span>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="mb-1 flex items-center justify-between">
                    <RarityStars count={rarity.stars} accent={rarity.border} />
                    <span className="font-heading text-[0.6rem] uppercase tracking-wider text-parchment/60">
                      Power {power}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl font-black leading-none text-gold-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                    {meta.firstName}
                  </h2>
                  <h2 className="font-display text-2xl font-black leading-none" style={{ color: accent }}>
                    {meta.surname}
                  </h2>
                  <p className="mt-1 font-body text-sm italic text-parchment/75">{meta.title}</p>
                </div>
              </div>
            </OrnateFrame>

            <MusicPlayer theme={character.theme} accent={accent} enabled={audioEnabled} />

            {/* quick relations */}
            {character.relations.length > 0 && (
              <div>
                <p className="mb-2 font-heading text-[0.65rem] uppercase tracking-[0.25em] text-parchment/45">
                  Connections
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {character.relations.map((r) => {
                    const t = allById.get(r.targetId);
                    return (
                      <button
                        key={r.targetId}
                        onClick={() => {
                          audio.pageTurn();
                          onNavigate(r.targetId);
                        }}
                        onMouseEnter={() => audio.hover()}
                        className="group rounded-lg border border-gold-500/20 bg-ink-800/50 px-2.5 py-1.5 text-left transition-colors hover:border-gold-400/50 hover:bg-ink-700/50"
                      >
                        <span className="block font-heading text-xs text-gold-200">
                          {t ? `${t.meta.firstName} ${t.meta.surname}` : "Unknown"}
                        </span>
                        <span className="block text-[0.65rem] italic text-parchment/55">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — identity + tabs */}
          <div className="min-w-0">
            <div className="mb-4">
              <p className="font-body text-sm italic text-parchment/60">“{character.quote}”</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  meta.species,
                  `${meta.gender} ${GENDER_GLYPH[meta.gender] ?? ""}`.trim(),
                  `Age ${meta.age}`,
                  meta.nationality,
                ].map((chip, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-gold-500/20 bg-ink-800/40 px-2.5 py-1 font-heading text-[0.65rem] uppercase tracking-wide text-parchment/70"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <Divider accent={accent} className="mb-3 max-w-xs" />

            {/* tab nav */}
            <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-gold-500/15 bg-ink-950/40 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => changeTab(t.id)}
                  onMouseEnter={() => audio.hover()}
                  className={`relative flex-1 whitespace-nowrap rounded-lg px-3 py-2 font-heading text-xs uppercase tracking-wide transition-colors sm:text-sm ${
                    tab === t.id ? "text-ink-950" : "text-parchment/55 hover:text-gold-200"
                  }`}
                >
                  {tab === t.id && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 -z-10 rounded-lg"
                      style={{ background: accent, boxShadow: `0 0 18px ${accent}66` }}
                      transition={{ type: "spring", stiffness: 300, damping: 26 }}
                    />
                  )}
                  <span className="mr-1">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* page-turn content */}
            <div className="perspective-mid min-h-[340px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ rotateY: -75, opacity: 0, x: -30 }}
                  animate={{ rotateY: 0, opacity: 1, x: 0 }}
                  exit={{ rotateY: 75, opacity: 0, x: 30 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformOrigin: "left center" }}
                  className="preserve-3d"
                >
                  {tab === "bio" && <BiographyView character={character} onNavigate={onNavigate} accent={accent} />}
                  {tab === "stats" && <StatPanel stats={character.stats} accent={accent} />}
                  {tab === "gallery" && (
                    <MediaGallery mainPortrait={character.portrait} images={character.gallery} accent={accent} />
                  )}
                  {tab === "lore" && (
                    <LorePanel character={character} allById={allById} onNavigate={onNavigate} accent={accent} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NavBtn({
  dir,
  onClick,
  disabled,
  accent,
}: {
  dir: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && audio.hover()}
      className="rounded-full border border-gold-500/30 p-2 text-gold-200 transition-all hover:bg-gold-500/15 disabled:cursor-not-allowed disabled:opacity-25"
      style={!disabled ? { boxShadow: `0 0 12px ${accent}33` } : undefined}
      aria-label={dir === "prev" ? "Previous" : "Next"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {dir === "prev" ? (
          <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

function LorePanel({
  character,
  allById,
  onNavigate,
  accent,
}: {
  character: Character;
  allById: Map<string, Character>;
  onNavigate: (id: string) => void;
  accent: string;
}) {
  const { meta } = character;
  const power = powerRating(character.stats);
  const dossier = [
    ["Species", meta.species],
    ["Gender", meta.gender],
    ["Age", String(meta.age)],
    ["Origin", meta.nationality],
    ["Element", meta.element],
    ["Calling", meta.archetype],
    ["Born", meta.born],
    ["Tier", meta.rarity],
    ["Aliases", character.aliases.join(" · ")],
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h3 className="mb-2 font-display text-xl text-gold-300">Dossier</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {dossier.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-gold-500/10 py-1.5">
              <dt className="font-heading text-[0.7rem] uppercase tracking-wider text-parchment/45">{k}</dt>
              <dd className="text-right font-body text-sm text-parchment/85">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-b border-gold-500/10 py-1.5">
            <dt className="font-heading text-[0.7rem] uppercase tracking-wider text-parchment/45">Power Rating</dt>
            <dd className="text-right font-heading text-sm font-bold" style={{ color: accent }}>
              {power} / 100
            </dd>
          </div>
        </dl>
      </div>

      {character.relations.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-xl text-gold-300">Connections</h3>
          <div className="space-y-2">
            {character.relations.map((r) => {
              const t = allById.get(r.targetId);
              return (
                <button
                  key={r.targetId}
                  onClick={() => {
                    audio.pageTurn();
                    onNavigate(r.targetId);
                  }}
                  onMouseEnter={() => audio.hover()}
                  className="flex w-full items-center gap-3 rounded-lg border border-gold-500/15 bg-ink-800/40 p-2.5 text-left transition-colors hover:border-gold-400/50 hover:bg-ink-700/50"
                >
                  {t && (
                    <img src={t.portrait} alt="" className="h-10 w-10 rounded-md object-cover object-top" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-sm text-gold-200">
                      {t ? `${t.meta.firstName} ${t.meta.surname}` : "Unknown soul"}
                    </p>
                    <p className="text-xs italic text-parchment/55">{r.label}</p>
                  </div>
                  <span style={{ color: accent }}>➤</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
