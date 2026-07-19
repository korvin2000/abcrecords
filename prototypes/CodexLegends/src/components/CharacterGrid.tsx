import { AnimatePresence, motion } from "framer-motion";
import type { Character } from "@/types/character";
import { CharacterCard } from "./CharacterCard";

interface Props {
  characters: Character[];
  onSelect: (id: string) => void;
}

export function CharacterGrid({ characters, onSelect }: Props) {
  if (characters.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto mt-16 max-w-md px-6 text-center"
      >
        <div className="mb-4 text-5xl opacity-60">🏺</div>
        <p className="font-display text-2xl text-gold-300">No soul answers to that name.</p>
        <p className="mt-2 font-body italic text-parchment/60">
          The codex holds no record matching your seek. Try another name, or release
          your filters.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 pb-24 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4"
    >
      <AnimatePresence mode="popLayout">
        {characters.map((c, i) => (
          <motion.div
            key={c.meta.id}
            layout
            initial={{ opacity: 0, y: 36, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{
              duration: 0.5,
              delay: Math.min(i, 9) * 0.045,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <CharacterCard character={c} onSelect={onSelect} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
