import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { COUNTER, EFFECTS } from "@/config";
import { formatCount, primeCounter, useCounter } from "@/lib/counter";
import { useFx } from "@/lib/fx";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { Glyph } from "../Glyph";
import { SIGN } from "@/lib/signs";
import { Odometer } from "./Odometer";
import { preloadStatsModal } from "./LazyStatsModal";

/**
 * The counter in the corner of the header — a small brass-and-parchment plate
 * with a mechanical drum counter in it, and the door to the visitors'
 * chronicle. It stands where the wordmark used to.
 *
 * It opens on the tally the reader left last time (`remembered`, from
 * lib/settings) and turns to the one the server returns, so the drums move
 * exactly as far as the count has actually moved. A first visit has nothing to
 * remember and spins up from zero, which is both the truth and the prettiest
 * thing the widget does.
 *
 * If the endpoint cannot be reached the plate simply keeps the remembered
 * number and says so in its tooltip. A counter is chrome: it must never turn
 * into an error the reader has to deal with.
 *
 * Whether the drums *turn* is the reader's ornament switch, not the machine's
 * `prefers-reduced-motion` hint — the same rule the rest of the ornaments
 * follow (`lib/fx`), and for the same reason: the hint picks that switch's
 * default, but a great many corporate Windows images set it without their
 * users ever knowing, and a hint must not be able to freeze something the
 * reader has explicitly asked for. With the ornaments compiled out entirely
 * (`EFFECTS.enabled: false`) there is no switch to read, and the hint is then
 * the only honest answer. `counter.css` re-arms the CSS side off the same
 * `data-fx` attribute, so the two can never disagree.
 */
export function VisitorCounter({ onOpen }: { onOpen: () => void }) {
  const { t, lang, locale } = useI18n();
  const reduced = useReducedMotion();
  const fx = useFx();
  const { status, pulse, remembered } = useCounter();
  const rolling = EFFECTS.enabled ? fx.on : !reduced;

  // The store records at most one visit per page load however often this runs
  // (StrictMode double-invokes effects in development).
  useEffect(() => primeCounter(lang), [lang]);

  const value = pulse ? pulse[COUNTER.display] : (remembered ?? 0);
  const silent = status === "failed" && !pulse;
  const reading = formatCount(value, locale);

  return (
    <button
      type="button"
      className="counter-plate"
      onClick={() => {
        audio.click();
        onOpen();
      }}
      onPointerEnter={() => {
        audio.hover();
        preloadStatsModal();
      }}
      onFocus={preloadStatsModal}
      title={silent ? t("counter.silent") : t("counter.open")}
      aria-label={`${t("counter.label")}: ${reading}. ${t("counter.open")}`}
      aria-busy={status === "loading" || undefined}
    >
      <Glyph char={SIGN.source} size="var(--counter-digit)" className="counter-mark" />
      <Odometer
        value={value}
        digits={COUNTER.digits}
        animate={rolling}
        className={silent ? "is-silent" : undefined}
      />
      <span className="counter-label">{t("counter.label")}</span>
    </button>
  );
}
