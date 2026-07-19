import { motion, type Variants } from "framer-motion";
import { Divider } from "./OrnateFrame";

const TITLE = "THE CODEX OF LEGENDS";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } },
};

const letter: Variants = {
  hidden: { opacity: 0, y: "0.7em", filter: "blur(12px)" },
  show: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

/** The headline — letters manifest from a blur, with a gold light-sweep. */
export function AnimatedTitle() {
  return (
    <header className="relative mx-auto max-w-5xl px-4 text-center">
      {/* floating glyphs */}
      <motion.span
        className="absolute -left-2 top-6 hidden text-2xl text-gold-400/50 sm:block"
        animate={{ y: [0, -10, 0], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
        aria-hidden
      >
        ✦
      </motion.span>
      <motion.span
        className="absolute -right-1 top-12 hidden text-xl text-arcane-300/50 sm:block"
        animate={{ y: [0, 12, 0], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, delay: 1 }}
        aria-hidden
      >
        ◈
      </motion.span>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="font-heading text-[0.7rem] uppercase tracking-[0.55em] text-gold-500/80"
      >
        ✦ Volume I ✦
      </motion.p>

      <h1 className="relative mx-auto mt-3 font-display text-4xl font-black leading-tight tracking-tight sm:text-6xl md:text-7xl">
        {/* one-time gold light sweep */}
        <motion.span
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ delay: 0.6, duration: 1.1, times: [0, 0.2, 1] }}
          aria-hidden
        >
          <motion.span
            className="absolute -inset-y-4 left-0 w-1/3"
            style={{
              background:
                "linear-gradient(100deg, transparent, rgba(255,250,230,0.9), transparent)",
              filter: "blur(2px)",
            }}
            initial={{ x: "-120%" }}
            animate={{ x: "420%" }}
            transition={{ delay: 0.6, duration: 1.1, ease: "easeInOut" }}
          />
        </motion.span>

        <motion.span
          className="relative inline-block"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {TITLE.split("").map((ch, i) => (
            <motion.span
              key={i}
              variants={letter}
              className="gold-gradient-text inline-block"
              style={{ textShadow: "0 0 26px rgba(212,175,55,0.35)" }}
            >
              {ch === " " ? "\u00A0" : ch}
            </motion.span>
          ))}
        </motion.span>
      </h1>

      <motion.div
        initial={{ opacity: 0, scaleX: 0.4 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.9, duration: 0.8 }}
      >
        <Divider className="mx-auto mt-5 w-full max-w-md" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05 }}
        className="mx-auto mt-3 max-w-2xl font-body text-base italic text-parchment/70 sm:text-lg"
      >
        An arcane compendium of heroes, villains &amp; legends — their names, their
        nature, and the tales inked in starlight.
      </motion.p>
    </header>
  );
}
