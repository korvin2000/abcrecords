import { useState } from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { CornerOrnament, Divider } from "./OrnateFrame";

const FOOTER_ITEMS = [
  { key: "footer.about", numeral: "I" },
  { key: "footer.sources", numeral: "II" },
  { key: "footer.literature", numeral: "III" },
  { key: "footer.links", numeral: "IV" },
  { key: "footer.news", numeral: "V" },
  { key: "footer.guestbook", numeral: "VI" },
  { key: "footer.search", numeral: "VII" },
  { key: "footer.email", numeral: "VIII" },
  { key: "footer.audioMap", numeral: "IX" },
] as const;

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Project-wide footer / colophon. Menu entries intentionally remain local
 * placeholders until their sections exist; activating one gives translated
 * feedback instead of navigating to a broken route.
 */
export function SiteFooter() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const activatePlaceholder = (label: string) => {
    audio.unlock();
    audio.click();
    setAnnouncement(t("footer.placeholder", { section: label }));
  };

  return (
    <m.footer
      className="relative z-10 mt-8 px-2 pb-4 sm:px-5 sm:pb-6"
      initial={reduced ? undefined : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="site-footer-title"
    >
      <div className="site-footer-shell relative mx-auto max-w-7xl overflow-hidden">
        <CornerOrnament className="pointer-events-none absolute left-1 top-1 h-7 w-7 opacity-55 sm:h-8 sm:w-8" />
        <CornerOrnament flipX className="pointer-events-none absolute right-1 top-1 h-7 w-7 opacity-55 sm:h-8 sm:w-8" />
        <CornerOrnament flipY className="pointer-events-none absolute bottom-1 left-1 h-7 w-7 opacity-40 sm:h-8 sm:w-8" />
        <CornerOrnament flipX flipY className="pointer-events-none absolute bottom-1 right-1 h-7 w-7 opacity-40 sm:h-8 sm:w-8" />

        <div className="relative px-4 pb-5 pt-7 sm:px-8 sm:pb-7 sm:pt-8 lg:px-10">
          <div className="footer-string-rule mx-auto max-w-3xl" aria-hidden>
            <span className="footer-rosette">𝄞</span>
          </div>

          <div className="mt-4 text-center">
            <p className="font-heading text-[0.65rem] uppercase tracking-[0.48em] text-gold-800">
              {t("footer.kicker")}
            </p>
            <h2
              id="site-footer-title"
              className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.16em] text-burgundy-700 sm:text-3xl"
            >
              {t("footer.title")}
            </h2>
            <p className="mx-auto mt-2 max-w-2xl font-body text-sm italic text-sepia-600 sm:text-base">
              {t("app.footer")}
            </p>
          </div>

          <Divider className="mx-auto my-5 max-w-xl" />

          <nav aria-label={t("footer.navLabel")}>
            <m.ul
              className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-9"
              variants={listVariants}
              initial={reduced ? undefined : "hidden"}
              whileInView="show"
              viewport={{ once: true, amount: 0.18 }}
            >
              {FOOTER_ITEMS.map((item) => {
                const label = t(item.key);
                return (
                  <m.li key={item.key} variants={itemVariants} className="min-w-0">
                    <m.button
                      type="button"
                      className="footer-menu-item group"
                      onMouseEnter={() => audio.hover()}
                      onClick={() => activatePlaceholder(label)}
                      whileHover={reduced ? undefined : { y: -3, scale: 1.015 }}
                      whileTap={{ scale: 0.97 }}
                      title={t("footer.placeholderTitle")}
                    >
                      <span className="footer-menu-numeral" aria-hidden>
                        {item.numeral}
                      </span>
                      <span className="relative z-10 leading-tight">{label}</span>
                      <span className="footer-menu-flourish" aria-hidden>
                        ❦
                      </span>
                    </m.button>
                  </m.li>
                );
              })}
            </m.ul>
          </nav>

          <div
            className="mt-3 min-h-5 text-center font-body text-xs italic text-sepia-600"
            aria-live="polite"
            aria-atomic="true"
          >
            {announcement}
          </div>

          <div className="footer-colophon mx-auto mt-4 max-w-4xl px-4 py-4 text-center sm:px-8">
            <p className="font-heading text-[0.68rem] font-semibold uppercase leading-relaxed tracking-[0.1em] text-burgundy-700 sm:text-xs">
              {t("footer.usageNotice")}
            </p>
            <div className="mx-auto my-3 flex max-w-md items-center justify-center gap-3 text-gold-700" aria-hidden>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-600/60" />
              <span className="text-base">✦</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-600/60" />
            </div>
            <p className="font-body text-sm font-semibold text-ink-800 sm:text-base">{t("footer.rights")}</p>
          </div>
        </div>
      </div>
    </m.footer>
  );
}
