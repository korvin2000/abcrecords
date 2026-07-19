import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ParticleCanvas } from "./components/ParticleCanvas";
import { AnimatedHeader } from "./components/AnimatedHeader";
import { SearchBar } from "./components/SearchBar";
import { CharacterCard } from "./components/CharacterCard";
import { CharacterDetail } from "./components/CharacterDetail";
import { Character } from "./engine/Character";
import { charactersData } from "./data/characters";
import { audio } from "./engine/AudioEngine";
import { AppEvents, bus } from "./engine/EventBus";

// Catalogue instance (OOP core domain — filters, looks up, sorts).
class Catalogue {
  private readonly characters: Character[];
  constructor(data = charactersData) {
    this.characters = data.map((d) => new Character(d));
  }
  all(): Character[] {
    return this.characters;
  }
  find(id: string): Character | undefined {
    return this.characters.find((c) => c.id === id);
  }
  search(query: string): Character[] {
    const q = query.trim();
    if (!q) return this.characters;
    return this.characters.filter((c) => c.matches(q));
  }
  sorted(list: Character[]): Character[] {
    return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
}

const catalogue = new Catalogue();

export default function App() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [musicOn, setMusicOn] = useState(false);

  // Initialize audio engine lazily on first user gesture.
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    const onFirstInteraction = () => {
      if (initialized) return;
      audio.init();
      setInitialized(true);
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
    window.addEventListener("pointerdown", onFirstInteraction);
    window.addEventListener("keydown", onFirstInteraction);
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, [initialized]);

  // Memoize filtered list
  const filtered = useMemo(
    () => catalogue.search(query),
    [query],
  );

  const selected = useMemo(
    () => (selectedId ? catalogue.find(selectedId) : null),
    [selectedId],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  const toggleMusic = () => {
    if (!initialized) audio.init();
    setMusicOn((m) => {
      const next = !m;
      if (next) audio.startMusic();
      else audio.stopMusic();
      return next;
    });
  };

  return (
    <div className="vignette noise relative min-h-screen">
      <ParticleCanvas />

      <main className="relative z-10">
        <AnimatedHeader />

        <section className="mb-8">
          <SearchBar value={query} onChange={setQuery} />
        </section>

        {/* Result count */}
        <div className="mx-auto mb-4 flex max-w-6xl items-center justify-center gap-3 px-4 text-center">
          <span className="font-accent text-sm italic text-amber-200/60">
            {filtered.length === catalogue.all().length
              ? `Displaying all ${filtered.length} entries in the codex`
              : `${filtered.length} entr${filtered.length === 1 ? "y" : "ies"} found`}
          </span>
        </div>

        {/* Cards grid */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <motion.div
            className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4"
            layout
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((c, i) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  onSelect={handleSelect}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-16 text-center"
            >
              <p className="font-display text-2xl tracking-widest text-amber-300/60">
                The codex is silent.
              </p>
              <p className="mt-2 font-accent text-base italic text-amber-200/40">
                No entries match your inquiry, traveler.
              </p>
            </motion.div>
          )}
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-amber-400/20 py-6 text-center font-accent text-xs italic text-amber-200/40">
          <div className="divider-ornament mb-3 max-w-md mx-auto">
            <span>✦</span>
          </div>
          <p>Scribed in the Hall of Memory · Year of the Wandering Star</p>
          <p className="mt-1 opacity-60">A Codex Compendium · Interactive Engine Demo</p>
        </footer>
      </main>

      {/* Music toggle */}
      <button
        onClick={toggleMusic}
        className="btn-rpg fixed bottom-4 right-4 z-30 flex items-center gap-2"
        aria-label={musicOn ? "Mute ambient music" : "Play ambient music"}
        title="Toggle ambient music"
      >
        <span className="text-base">{musicOn ? "♫" : "♪"}</span>
        <span className="hidden sm:inline">
          {musicOn ? "Silence the Lute" : "Summon the Lute"}
        </span>
      </button>

      {/* Hint for interaction */}
      {!initialized && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed bottom-4 left-4 z-30 rounded-sm border border-amber-400/30 bg-black/60 px-3 py-2 font-accent text-xs italic text-amber-200/70 backdrop-blur"
        >
          ✦ Click anywhere to awaken the codex ✦
        </motion.div>
      )}

      {/* Detail modal */}
      <CharacterDetail character={selected ?? null} onClose={handleClose} />

      {/* Event bridge for page close (audio engine listens on bus) */}
      <EventBridge />
    </div>
  );
}

// Emits CARD_CLOSE on bus when the detail view is actually closed.
function EventBridge() {
  // We piggy-back on unmount to fire close events; handled in CharacterDetail via bus.
  useEffect(() => {
    return () => {
      bus.emit(AppEvents.CARD_CLOSE);
    };
  }, []);
  return null;
}
