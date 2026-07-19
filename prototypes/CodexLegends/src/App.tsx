import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CHARACTERS, PORTRAIT_POOL, SCENES } from "@/data/characters";
import { buildRandomHero } from "@/lib/procedural";
import { searchCharacters, type SearchFilters } from "@/lib/search";
import { audio } from "@/lib/audioEngine";
import type { Character } from "@/types/character";
import { Background } from "@/components/Background";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { SearchBar } from "@/components/SearchBar";
import { CharacterGrid } from "@/components/CharacterGrid";
import { CharacterDetail } from "@/components/CharacterDetail";

export default function App() {
  const [characters, setCharacters] = useState<Character[]>(CHARACTERS);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({
    archetypes: new Set<string>(),
    elements: new Set<string>(),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [ambient, setAmbient] = useState(false);

  // unlock audio on first user gesture (autoplay policy)
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const allById = useMemo(
    () => new Map(characters.map((c) => [c.meta.id, c])),
    [characters]
  );

  const filtered = useMemo(
    () => searchCharacters(characters, query, filters),
    [characters, query, filters]
  );

  // resonate to the search result (chime on a match, hum when none)
  const prevHasResults = useRef(true);
  useEffect(() => {
    if (!query.trim()) {
      prevHasResults.current = true;
      return;
    }
    const has = filtered.length > 0;
    if (has && !prevHasResults.current) audio.found();
    else if (!has && prevHasResults.current) audio.error();
    prevHasResults.current = has;
  }, [filtered.length, query]);

  const facets = useMemo(() => {
    const arch = new Set<string>();
    const el = new Set<string>();
    for (const c of characters) {
      arch.add(c.meta.archetype);
      el.add(c.meta.element);
    }
    return {
      archetypes: [...arch].sort(),
      elements: [...el].sort(),
    };
  }, [characters]);

  const toggleFilter = useCallback(
    (key: "archetypes" | "elements", val: string) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: new Set(prev[key]) };
        if (next[key].has(val)) next[key].delete(val);
        else next[key].add(val);
        return next;
      });
    },
    []
  );

  const summon = useCallback(() => {
    audio.unlock();
    audio.open();
    const hero = buildRandomHero({ portraits: PORTRAIT_POOL, scenes: SCENES });
    setCharacters((prev) => [hero, ...prev]);
    window.setTimeout(() => setSelectedId(hero.meta.id), 220);
  }, []);

  const toggleSound = () => {
    audio.unlock();
    const next = !sound;
    setSound(next);
    audio.setEnabled(next);
    if (!next) setAmbient(false);
  };

  const toggleAmbient = () => {
    audio.unlock();
    const next = !ambient;
    setAmbient(next);
    audio.setAmbient(next);
  };

  const selected = selectedId ? allById.get(selectedId) ?? null : null;

  return (
    <div className="relative min-h-screen">
      <Background />

      {/* fixed top control bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-gold-500/10 bg-ink-950/50 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-base anim-floaty">✦</span>
          <span className="font-display text-sm font-bold tracking-[0.25em] text-gold-300">
            CODEX
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CtrlButton active={ambient} onClick={toggleAmbient} title="Ambient drone">
            <span className="text-sm">{ambient ? "🎼" : "🎵"}</span>
          </CtrlButton>
          <CtrlButton active={sound} onClick={toggleSound} title="Sound effects">
            <span className="text-sm">{sound ? "🔊" : "🔇"}</span>
          </CtrlButton>
        </div>
      </header>

      <main className="relative z-10 px-2 pb-24 pt-20">
        <AnimatedTitle />

        <SearchBar
          value={query}
          onChange={setQuery}
          filters={filters}
          onToggleArchetype={(a) => toggleFilter("archetypes", a)}
          onToggleElement={(e) => toggleFilter("elements", e)}
          archetypes={facets.archetypes}
          elements={facets.elements}
          resultCount={filtered.length}
          totalCount={characters.length}
        />

        {/* summon */}
        <div className="mx-auto mt-6 flex max-w-2xl justify-center px-4">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={summon}
            onMouseEnter={() => sound && audio.hover()}
            className="group relative overflow-hidden rounded-full border border-mystic-400/40 bg-ink-900/60 px-5 py-2 font-heading text-sm uppercase tracking-[0.2em] text-mystic-200 backdrop-blur-sm transition-colors hover:border-mystic-300/70 hover:text-white"
          >
            <span className="relative z-10">⟡ Summon a Wanderer ⟡</span>
            <span className="absolute inset-0 -z-0 bg-gradient-to-r from-mystic-500/0 via-mystic-400/30 to-mystic-500/0 opacity-0 transition-opacity group-hover:opacity-100" />
          </motion.button>
        </div>

        <div className="mt-10">
          <CharacterGrid characters={filtered} onSelect={setSelectedId} />
        </div>

        <footer className="mx-auto mt-12 max-w-md px-6 text-center">
          <div className="mx-auto mb-3 h-px w-32 bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />
          <p className="font-body text-xs italic text-parchment/40">
            ✦ Bound in starlight · click any name within a tale to cross to their page ·
            use ← → to turn between souls ✦
          </p>
        </footer>
      </main>

      <AnimatePresence>
        {selected && (
          <CharacterDetail
            key={selected.meta.id}
            character={selected}
            siblings={filtered}
            allById={allById}
            onClose={() => setSelectedId(null)}
            onNavigate={(id) => allById.has(id) && setSelectedId(id)}
            audioEnabled={sound}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CtrlButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid h-9 w-9 place-items-center rounded-full border transition-all ${
        active
          ? "border-gold-400/60 bg-gold-500/15 shadow-[0_0_14px_rgba(212,175,55,0.4)]"
          : "border-gold-500/20 hover:border-gold-400/40 hover:bg-gold-500/10"
      }`}
    >
      {children}
    </button>
  );
}
