import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Character } from "../engine/Character";
import { AppEvents, bus } from "../engine/EventBus";
import { StatsPanel } from "./StatsPanel";

interface Props {
  character: Character | null;
  onClose: () => void;
}

export function CharacterDetail({ character, onClose }: Props) {
  const [closing, setClosing] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (character) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [character]);

  // Lock scroll
  useEffect(() => {
    if (character) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      bus.emit(AppEvents.PAGE_TURN, character.id);
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [character]);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    bus.emit(AppEvents.CARD_CLOSE);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 450);
  };

  return (
    <AnimatePresence>
      {character && (
        <motion.div
          key={character.id + (closing ? "-close" : "-open")}
          className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Book panel */}
          <motion.div
            className={`relative z-10 flex h-full max-h-[90vh] w-full max-w-6xl flex-col ${closing ? "page-turn-close" : "page-turn-open"}`}
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="parchment ornate-border relative flex-1 overflow-hidden rounded-sm">
              {/* Corner ornaments */}
              <div className="pointer-events-none absolute left-2 top-2 text-2xl text-amber-900/50">❧</div>
              <div className="pointer-events-none absolute right-2 top-2 rotate-90 text-2xl text-amber-900/50">❧</div>
              <div className="pointer-events-none absolute bottom-2 left-2 -rotate-90 text-2xl text-amber-900/50">❧</div>
              <div className="pointer-events-none absolute bottom-2 right-2 rotate-180 text-2xl text-amber-900/50">❧</div>

              {/* Close button */}
              <button
                onClick={handleClose}
                className="btn-rpg absolute right-4 top-4 z-20"
                aria-label="Close"
              >
                ✕ Close Codex
              </button>

              {/* Scrollable interior */}
              <div className="h-full overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">
                <div className="mx-auto max-w-5xl">
                  {/* Top banner with name + class */}
                  <header className="mb-6 text-center">
                    <div className="mb-2 font-display text-xs tracking-[0.4em] text-amber-900/60">
                      ❖ ENTRY IN THE CODEX ❖
                    </div>
                    <h1 className="rune-title font-display text-4xl font-black tracking-widest text-crimson sm:text-6xl">
                      {character.metadata.firstName}
                    </h1>
                    <h2 className="rune-title font-display text-3xl font-bold tracking-widest text-crimson sm:text-5xl">
                      {character.metadata.surname}
                    </h2>
                    <p className="mt-2 font-accent text-base italic text-amber-900/80 sm:text-lg">
                      {character.data.class} of {character.metadata.nationality}
                      {" · "}Level {character.data.level}
                      {" · "}{character.data.alignment}
                    </p>
                    <div className="divider-ornament mt-4">
                      <span className="text-xl">❦</span>
                    </div>
                  </header>

                  {/* Two column layout */}
                  <div className="grid gap-8 md:grid-cols-[280px_1fr]">
                    {/* Left column: portrait + quote + stats */}
                    <aside>
                      <div
                        className="ornate-border relative overflow-hidden"
                        style={{ boxShadow: `0 0 30px ${character.data.accent}40` }}
                      >
                        <img
                          src={character.data.portrait}
                          alt={character.fullName}
                          className="h-auto w-full"
                        />
                        <div
                          className="absolute inset-0 mix-blend-overlay opacity-30"
                          style={{
                            background: `radial-gradient(circle at 50% 30%, ${character.data.accent}, transparent 70%)`,
                          }}
                        />
                      </div>

                      <blockquote className="mt-4 border-l-2 border-amber-900/40 px-3 font-accent text-base italic text-amber-950">
                        "{character.data.quote}"
                      </blockquote>

                      <div className="mt-4 parchment-dark ornate-border p-4">
                        <h3 className="mb-3 font-display text-xs tracking-widest text-amber-400">
                          ATTRIBUTES
                        </h3>
                        <StatsPanel stats={character.data.stats} />
                      </div>

                      <div className="mt-4 parchment-dark ornate-border p-4">
                        <h3 className="mb-2 font-display text-xs tracking-widest text-amber-400">
                          MASTERIES
                        </h3>
                        <ul className="space-y-1.5">
                          {character.data.skills.map((s) => (
                            <li key={s.name} className="flex items-center gap-2">
                              <span className="font-accent text-sm text-amber-200">
                                {s.name}
                              </span>
                              <span className="ml-auto flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span
                                    key={i}
                                    className={
                                      i < s.rank
                                        ? "text-amber-400"
                                        : "text-amber-400/20"
                                    }
                                  >
                                    ◆
                                  </span>
                                ))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-4 parchment-dark ornate-border p-4">
                        <h3 className="mb-2 font-display text-xs tracking-widest text-amber-400">
                          EQUIPMENT
                        </h3>
                        <ul className="space-y-1 font-accent text-sm text-amber-200">
                          {character.data.equipment.map((e) => (
                            <li key={e} className="flex gap-2">
                              <span className="text-amber-500">⚜</span>
                              <span>{e}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </aside>

                    {/* Right column: biography */}
                    <div className="bio-content">
                      <div
                        ref={bioRef}
                        dangerouslySetInnerHTML={{ __html: character.data.biography }}
                      />
                    </div>
                  </div>

                  <footer className="mt-8 text-center font-accent text-xs italic text-amber-900/50">
                    ❦ End of entry · Turn the page to return ❦
                  </footer>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
