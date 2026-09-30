import { memo, useMemo, type CSSProperties } from "react";
import { Divider } from "./OrnateFrame";
import { useI18n } from "@/lib/i18n";

/**
 * The headline: letters condense out of ink-blur one by one, then a single
 * light-sweep passes over — engraved burgundy on paper, no neon glow.
 *
 * All of it is CSS (`.hero-*` in styles/home.css). It used to be ~25 framer
 * components, two of them looping on the JS thread for ever; now the only
 * thing React decides is each letter's place in the stagger (`--i`), and the
 * stylesheet reads `data-perf` / `data-fx` to thin the choreography on a weak
 * machine or with the ornaments switched off. `memo`: this takes no props, and
 * its parent re-renders on every keystroke in the search box.
 */
export const AnimatedTitle = memo(function AnimatedTitle() {
  const { t, lang } = useI18n();
  const title = t("app.title");
  // words stay unbreakable; letters animate individually inside them. Each
  // letter carries its running index across the whole title (spaces do not
  // count), which is what the stagger in `.hero-letter` is derived from.
  const words = useMemo(() => {
    let n = 0;
    return title.split(" ").map((w) => Array.from(w, (ch) => ({ ch, i: n++ })));
  }, [title]);

  return (
    <header className="relative mx-auto max-w-5xl px-4 text-center">
      <span className="hero-orn hero-orn--star absolute -left-2 top-6 hidden text-2xl text-gold-600/60 sm:block" aria-hidden>
        ✦
      </span>
      <span className="hero-orn hero-orn--leaf absolute -right-1 top-12 hidden text-xl text-burgundy-500/40 sm:block" aria-hidden>
        ❦
      </span>

      <p
        // The tracking is what wrapped this line onto two rows at 390 px — the
        // letters themselves are 11 px. Loosening it with the viewport keeps
        // the engraved look wide and the line single on a phone.
        className="hero-kicker font-heading text-[0.7rem] uppercase tracking-[clamp(0.2em,0.02em+0.65vw,0.5em)] text-gold-700"
      >
        {t("app.volume")}
      </p>

      {/* One fluid size instead of 36 / 60 / 72 px steps: the old ladder put a
          72 px headline on a 1280 px laptop, where it cost a fifth of the first
          screen. Bounded at both ends — it never drops below a headline and
          never grows past one. */}
      <h1 className="hero-title relative mx-auto mt-2 font-display font-bold leading-tight tracking-[0.06em]">
        {/* one-time light sweep across the lettering */}
        <span className="hero-sweep pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
          <span className="hero-sweep-bar absolute -inset-y-4 left-0 w-1/3" />
        </span>

        <span
          key={lang} /* re-mount, and so re-run the reveal, when the language flips */
          className="hero-letters relative inline-block"
        >
          {words.map((word, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap">
              {word.map(({ ch, i }) => (
                <span
                  key={i}
                  className="hero-letter burgundy-gradient-text inline-block"
                  style={{ "--i": i } as CSSProperties}
                >
                  {ch}
                </span>
              ))}
              {/* U+00A0, spelled out: an ordinary space alone in an inline-block
                  collapses to nothing and the words run together. */}
              {wi < words.length - 1 && <span className="inline-block">{"\u00A0"}</span>}
            </span>
          ))}
        </span>
      </h1>

      <div className="hero-rule">
        <Divider className="mx-auto mt-stack w-full max-w-md" />
      </div>

      {/* The line under the rule is no longer static: `<HeraldBanner>` (mounted
          by App right below this header) opens with `app.subtitle` and then
          takes turns with "on this day" and the book of sayings. */}
    </header>
  );
});
