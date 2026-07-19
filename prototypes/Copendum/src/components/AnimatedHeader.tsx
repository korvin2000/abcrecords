import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const RUNE_CHARS = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

/**
 * Animated header with rune-decryption reveal effect.
 * Random runes progressively resolve to the final characters.
 */
export function AnimatedHeader() {
  const title = "CODEX OF LEGENDS";
  const subtitle = "A Compendium of Heroes, Villains & Wandering Souls";

  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setRevealed((r) => {
        if (r >= title.length) {
          clearInterval(timer);
          return r;
        }
        return r + 1;
      });
    }, 70);
    return () => clearInterval(timer);
  }, []);

  const displayed = title
    .split("")
    .map((char, i) => {
      if (i < revealed) return char;
      return RUNE_CHARS[Math.floor(Math.random() * RUNE_CHARS.length)];
    })
    .join("");

  return (
    <header className="relative z-10 flex flex-col items-center justify-center px-4 pt-14 pb-8 text-center">
      {/* Ornate divider top */}
      <div className="mb-4 flex items-center gap-3 text-amber-400/80">
        <span className="h-px w-24 bg-gradient-to-r from-transparent to-amber-400/80" />
        <span className="text-xl tracking-widest">☩</span>
        <span className="h-px w-24 bg-gradient-to-l from-transparent to-amber-400/80" />
      </div>

      <motion.h1
        className="rune-title font-display text-4xl font-black tracking-[0.2em] sm:text-6xl md:text-7xl"
        aria-label={title}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <span className="gold-text">{displayed}</span>
      </motion.h1>

      <motion.p
        className="mt-4 max-w-2xl font-accent text-base italic text-amber-100/70 sm:text-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
      >
        {subtitle}
      </motion.p>

      <div className="mt-4 flex items-center gap-3 text-amber-400/80">
        <span className="h-px w-32 bg-gradient-to-r from-transparent to-amber-400/80" />
        <span className="text-xl">❦</span>
        <span className="h-px w-32 bg-gradient-to-l from-transparent to-amber-400/80" />
      </div>

      {/* Floating decorative runes on the sides */}
      <div
        className="pointer-events-none absolute left-6 top-1/3 hidden text-4xl text-amber-500/20 md:block"
        aria-hidden
      >
        <span className="floating" style={{ animationDelay: "0s" }}>ᚠ</span>
      </div>
      <div
        className="pointer-events-none absolute right-6 top-1/3 hidden text-4xl text-amber-500/20 md:block"
        aria-hidden
      >
        <span className="floating" style={{ animationDelay: "1.5s" }}>ᛟ</span>
      </div>
    </header>
  );
}
