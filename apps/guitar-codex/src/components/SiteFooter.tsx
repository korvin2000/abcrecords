import { useCallback, useState } from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";
import type { MsgKey } from "@/lib/messages";
import { SITE } from "@/config";
import { audio } from "@/lib/audio";
import { useDismissOnOutside } from "@/lib/dismiss";
import { useI18n } from "@/lib/i18n";
import { Glyph } from "@/components/Glyph";
import { SIGN } from "@/lib/signs";
import { GUESTBOOK_SLUG, preloadGuestbookOverlay } from "@/components/guestbook";
import { ShareMenu } from "./ShareMenu";
import { CornerOrnament, Divider } from "./OrnateFrame";

/** What each of the nine sections does, in the order they are numbered.
 *
 *  Most name a `slug`: a catalogue entry, resolved against the index by
 *  `canOpen`, and a placeholder until that entry exists. Three do something
 *  else, and each says so in its own field rather than by being special-cased
 *  in the markup:
 *
 *  - `VI` — `guestbook` is a **reserved route**, not an entry, and opens the
 *    guestbook feature package (components/guestbook/route.ts). `preload`
 *    warms that chunk on intent, the same bargain `CharacterCard` strikes
 *    with the codex.
 *  - `VII` — `panel: "share"` opens the share flyout below the grid. It was
 *    "Search" until the catalogue grew a live search bar of its own, at which
 *    point a second one at the bottom of the page could only ever be a worse
 *    version of the one already on screen.
 *  - `VIII` — `href` is followed as written. `mailto:` is the whole reason the
 *    field exists: the address is a fact about the project (config.ts), not a
 *    route, and the browser's mail client is the only thing that can act on
 *    it. */
const FOOTER_ITEMS = [
  { key: "footer.about", numeral: "I", slug: "about" },
  { key: "footer.sources", numeral: "II", slug: "source" },
  { key: "footer.literature", numeral: "III", slug: "biblio" },
  { key: "footer.links", numeral: "IV", slug: "links" },
  { key: "footer.news", numeral: "V", slug: "news" },
  { key: "footer.guestbook", numeral: "VI", slug: GUESTBOOK_SLUG, preload: preloadGuestbookOverlay },
  { key: "footer.share", numeral: "VII", panel: "share" },
  { key: "footer.email", numeral: "VIII", href: `mailto:${SITE.email}` },
  { key: "footer.audioMap", numeral: "IX", slug: "karta" },
] as const satisfies readonly {
  key: MsgKey;
  numeral: string;
  slug?: string;
  href?: string;
  panel?: "share";
  preload?: () => void;
}[];

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

interface Props {
  /** Slugs the app can actually open — index entries plus the reserved
   *  `#/guestbook` route. Anything else stays a placeholder. */
  canOpen: (slug: string) => boolean;
  onOpenEntry: (slug: string) => void;
}

/**
 * Project-wide footer / colophon. A menu entry becomes a real link as soon as
 * a matching catalogue entry exists; the rest give translated feedback
 * instead of navigating to a broken route.
 */
export function SiteFooter({ canOpen, onOpenEntry }: Props) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Light-dismiss, on the wrapper that holds *both* the tile and the panel —
  // anchoring it to the panel alone would make a click on "VII" read as
  // "outside" and close what it had just opened. Escape is handled in the
  // capture phase by the hook, so it closes this and nothing behind it.
  const closeShare = useCallback(() => setShareOpen(false), []);
  const shareRef = useDismissOnOutside<HTMLDivElement>(shareOpen, closeShare);

  const toggleShare = () => {
    audio.unlock();
    audio.click();
    setShareOpen((was) => !was);
  };

  const activatePlaceholder = (label: string) => {
    audio.unlock();
    audio.click();
    setAnnouncement(t("footer.placeholder", { section: label }));
  };

  const open = (slug: string) => {
    audio.unlock();
    audio.click();
    onOpenEntry(slug);
  };

  return (
    <m.footer
      className="relative z-10 mt-stack px-gutter pb-[max(1rem,env(safe-area-inset-bottom))]"
      initial={reduced ? undefined : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="site-footer-title"
    >
      <div className="site-footer-shell page-wide relative overflow-hidden">
        <CornerOrnament className="pointer-events-none absolute left-1 top-1 h-7 w-7 opacity-55 sm:h-8 sm:w-8" />
        <CornerOrnament flipX className="pointer-events-none absolute right-1 top-1 h-7 w-7 opacity-55 sm:h-8 sm:w-8" />
        <CornerOrnament flipY className="pointer-events-none absolute bottom-1 left-1 h-7 w-7 opacity-40 sm:h-8 sm:w-8" />
        <CornerOrnament flipX flipY className="pointer-events-none absolute bottom-1 right-1 h-7 w-7 opacity-40 sm:h-8 sm:w-8" />

        <div className="relative px-3 pb-3 pt-4 sm:px-8 sm:pb-6 sm:pt-7 lg:px-10">
          <div className="footer-string-rule mx-auto max-w-3xl" aria-hidden>
            <span className="footer-rosette">
              <Glyph char={SIGN.clef} font="var(--font-music)" size="0.95rem" />
            </span>
          </div>

          <div className="mt-2 text-center">
            <p className="font-heading text-[0.58rem] uppercase tracking-[clamp(0.2em,0.05em+0.6vw,0.48em)] text-gold-800">
              {t("footer.kicker")}
            </p>
            <h2
              id="site-footer-title"
              className="mt-0.5 font-display text-[clamp(1.15rem,0.9rem+1.1vw,1.875rem)] font-bold uppercase tracking-[0.16em] text-burgundy-700"
            >
              {t("footer.title")}
            </h2>
            <p className="mx-auto mt-1.5 max-w-2xl font-body text-[clamp(0.76rem,0.7rem+0.3vw,1rem)] italic text-sepia-600">
              {t("app.footer")}
            </p>
          </div>

          <Divider className="mx-auto my-2.5 max-w-xl sm:my-4" />

          <div ref={shareRef}>
            <nav aria-label={t("footer.navLabel")}>
              <m.ul
                // Nine sections. Two columns meant five rows of tiles — the
                // single largest block of furniture on a phone. Three fits the
                // longest label ("LITERATURE") at 360 px and costs three rows.
                className="m-0 grid list-none grid-cols-3 gap-1 p-0 sm:grid-cols-5 sm:gap-2.5 lg:grid-cols-9"
                variants={listVariants}
                initial={reduced ? undefined : "hidden"}
                whileInView="show"
                viewport={{ once: true, amount: 0.18 }}
              >
                {FOOTER_ITEMS.map((item) => {
                  const label = t(item.key);
                  const slug = "slug" in item && canOpen(item.slug) ? item.slug : null;
                  const preload = "preload" in item ? item.preload : undefined;
                  const href = "href" in item ? item.href : undefined;
                  const panel = "panel" in item ? item.panel : undefined;
                  const shared = {
                    className: "footer-menu-item group",
                    onMouseEnter: () => {
                      audio.hover();
                      // Only the guestbook has one: its panel is a chunk, and the
                      // hover is long enough to have it in memory by the click.
                      if (slug) preload?.();
                    },
                    whileHover: reduced ? undefined : { y: -3, scale: 1.015 },
                    whileTap: { scale: 0.97 },
                  } as const;
                  const face = (
                    <>
                      <span className="footer-menu-numeral" aria-hidden>
                        {item.numeral}
                      </span>
                      <span className="relative z-10 leading-tight">{label}</span>
                      <span className="footer-menu-flourish" aria-hidden>
                        ❦
                      </span>
                    </>
                  );

                  return (
                    <m.li key={item.key} variants={itemVariants} className="min-w-0">
                      {slug ? (
                        <m.a
                          {...shared}
                          href={`#/${slug}`}
                          onClick={(e) => {
                            e.preventDefault();
                            open(slug);
                          }}
                        >
                          {face}
                        </m.a>
                      ) : href ? (
                        // Left to the browser on purpose: `mailto:` is the
                        // platform's business, and intercepting it is how a link
                        // that works everywhere becomes one that works wherever
                        // the interception was tested.
                        <m.a {...shared} href={href} onClick={() => audio.click()}>
                          {face}
                        </m.a>
                      ) : panel === "share" ? (
                        <m.button
                          {...shared}
                          type="button"
                          onClick={toggleShare}
                          aria-expanded={shareOpen}
                          aria-controls="footer-share"
                        >
                          {face}
                        </m.button>
                      ) : (
                        <m.button
                          {...shared}
                          type="button"
                          onClick={() => activatePlaceholder(label)}
                          title={t("footer.placeholderTitle")}
                        >
                          {face}
                        </m.button>
                      )}
                    </m.li>
                  );
                })}
              </m.ul>
            </nav>

            {/* The flyout unfolds here — under the whole grid, in the footer's
                own width — rather than out of the tile. See ShareMenu.

                Mounted and unmounted outright, with the unfolding done by a
                CSS keyframe on the panel itself (`.share-flyout`, footer.css)
                — the same way `.leaf-in` and `.page-turn-open` are done. An
                `AnimatePresence` around it would buy an animated *close* as
                well, at the cost of a `height: auto → 0` exit and framer's
                presence bookkeeping for eight links and a live region. The
                cheaper trade is worth it here: opening unfolds, shutting is
                immediate, and a closed menu is gone from the document rather
                than collapsed inside it. */}
            <div id="footer-share">{shareOpen && <ShareMenu />}</div>
          </div>

          <div
            className="mt-2 min-h-4 text-center font-body text-[0.7rem] italic text-sepia-600"
            aria-live="polite"
            aria-atomic="true"
          >
            {announcement}
          </div>

          <div className="footer-colophon mx-auto mt-2 max-w-4xl px-3 py-2.5 text-center sm:px-8 sm:py-4">
            <p className="font-heading text-[clamp(0.6rem,0.56rem+0.14vw,0.75rem)] font-semibold uppercase leading-snug tracking-[0.06em] text-burgundy-700">
              {t("footer.usageNotice")}
            </p>
            <div className="mx-auto my-1.5 flex max-w-md items-center justify-center gap-3 text-gold-700" aria-hidden>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-600/60" />
              <span className="text-base">✦</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-600/60" />
            </div>
            <p className="font-body text-[clamp(0.75rem,0.7rem+0.25vw,1rem)] font-semibold text-ink-800">{t("footer.rights")}</p>
          </div>
        </div>
      </div>
    </m.footer>
  );
}
