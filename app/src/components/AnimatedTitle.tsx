import { useMemo } from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";
import { Divider } from "./OrnateFrame";
import { useI18n } from "@/lib/i18n";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.15 } },
};

const letter: Variants = {
  hidden: { opacity: 0, y: "0.7em", filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * The headline: letters condense out of ink-blur one by one, then a single
 * light-sweep passes over — engraved burgundy on paper, no neon glow.
 */
export function AnimatedTitle() {
  const { t, lang } = useI18n();
  const reduced = useReducedMotion();
  const title = t("app.title");
  // words stay unbreakable; letters animate individually inside them
  const words = useMemo(() => title.split(" ").map((w) => Array.from(w)), [title]);

  return (
    <header className="relative mx-auto max-w-5xl px-4 text-center">
      <m.span
        className="absolute -left-2 top-6 hidden text-2xl text-gold-600/60 sm:block"
        animate={reduced ? undefined : { y: [0, -10, 0], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 6, repeat: Infinity }}
        aria-hidden
      >
        ✦
      </m.span>
      <m.span
        className="absolute -right-1 top-12 hidden text-xl text-burgundy-500/40 sm:block"
        animate={reduced ? undefined : { y: [0, 12, 0], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, delay: 1 }}
        aria-hidden
      >
        ❦
      </m.span>

      <m.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="font-heading text-[0.7rem] uppercase tracking-[0.5em] text-gold-700"
      >
        {t("app.volume")}
      </m.p>

      <h1 className="relative mx-auto mt-3 font-display text-4xl font-bold leading-tight tracking-[0.06em] sm:text-6xl md:text-7xl">
        {/* one-time light sweep across the lettering */}
        {!reduced && (
          <m.span
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ delay: 0.7, duration: 1.1, times: [0, 0.2, 1] }}
            aria-hidden
          >
            <m.span
              className="absolute -inset-y-4 left-0 w-1/3"
              style={{
                background: "linear-gradient(100deg, transparent, rgba(251,243,210,0.85), transparent)",
                filter: "blur(2px)",
              }}
              initial={{ x: "-120%" }}
              animate={{ x: "420%" }}
              transition={{ delay: 0.7, duration: 1.1, ease: "easeInOut" }}
            />
          </m.span>
        )}

        <m.span
          key={lang} /* re-run the reveal when the language flips */
          className="relative inline-block"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {words.map((word, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap">
              {word.map((ch, i) => (
                <m.span
                  key={i}
                  variants={letter}
                  className="burgundy-gradient-text inline-block"
                  style={{ filter: "drop-shadow(0 1px 1px rgba(51,34,15,0.25))" }}
                >
                  {ch}
                </m.span>
              ))}
              {wi < words.length - 1 && <span className="inline-block"> </span>}
            </span>
          ))}
        </m.span>
      </h1>

      <m.div initial={{ opacity: 0, scaleX: 0.4 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.9, duration: 0.8 }}>
        <Divider className="mx-auto mt-5 w-full max-w-md" />
      </m.div>

      <m.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05 }}
        className="mx-auto mt-3 max-w-2xl font-body text-base italic text-sepia-600 sm:text-lg"
      >
        {t("app.subtitle")}
      </m.p>
    </header>
  );
}
