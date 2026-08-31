import { useEffect, useRef } from "react";
import { m } from "framer-motion";
import Guestbook from "@guitar-codex/guestbook";
import { GUESTBOOK } from "@/config";
import { useI18n } from "@/lib/i18n";
import { audio } from "@/lib/audio";
import { Glyph } from "@/components/Glyph";
import { SIGN } from "@/lib/signs";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CornerOrnament } from "@/components/OrnateFrame";

/**
 * The host's connecting point to `@guitar-codex/guestbook` — the visitors'
 * book behind the footer's `VI` entry, at the reserved route `#/guestbook`.
 *
 * The `import Guestbook from "@guitar-codex/guestbook"` above is static, and
 * that is correct: *this module* is only ever reached through
 * `LazyGuestbookOverlay`'s dynamic import, so the package rides in that async
 * chunk (docs/guestbook-integration.md §5a). The mistake the architecture
 * guards against is the same import appearing in startup code — App.tsx,
 * main.tsx, a barrel one of them reads — which would put the guestbook, its
 * own i18next instance and its stylesheet in the initial bundle with nothing
 * visibly wrong to show for it (§34.1).
 */

interface Props {
  onClose: () => void;
}

/**
 * A codex-shaped frame around a feature that knows nothing about the codex.
 *
 * The chrome — backdrop, parchment panel, corner ornaments, the close control,
 * Esc — is the host's, and is the same furniture `CodexShell` puts around an
 * entry. The contents are the package's, mounted through the narrow contract
 * in docs/guestbook-integration.md §7: primitives and callbacks, no store, no
 * router, no context.
 *
 * What crosses the boundary and why:
 *
 *   `locale`            the reader's tongue. The package ships exactly the
 *                       eleven the codex speaks, so this always resolves.
 *   `languageSwitcher`  `"never"` — the header already has one, and two
 *                       switchers on one screen is a bug the package
 *                       anticipates (§6).
 *   `theme`             `"light"` forced, not `"system"`: this catalogue is
 *                       parchment at every hour, and `prefers-color-scheme`
 *                       knows nothing about that.
 *   `header={false}`    the panel below draws the title; the package's own
 *                       heading would be the second one on the page.
 *   `routing`           left at its default `{ mode: "memory" }`. The hash
 *                       belongs to the catalogue (§11); a page number written
 *                       into it would fight `useHashRoute` for the address.
 *   `className`         carries the `--gb-*` palette (styles/guestbook.css).
 */
export function GuestbookOverlay({ onClose }: Props) {
  const { t, lang } = useI18n();

  // Esc closes, exactly as it does over a codex. The listener is on `window`
  // and keyed to a ref rather than to `onClose`, so re-binding it is not the
  // cost of every parent render (the same reasoning as CodexShell's).
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dismiss = () => {
    audio.close();
    onClose();
  };

  return (
    <m.div
      className="codex-overlay fixed inset-0 z-40 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-label={t("footer.guestbook")}
    >
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={dismiss} />

      <div className="relative z-10 flex h-full max-h-[94dvh] w-full max-w-[84rem] flex-col">
        <div className="parchment ornate-border relative flex-1 overflow-hidden rounded-sm">
          <CornerOrnament className="pointer-events-none absolute left-[5px] top-[5px] z-20 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipX className="pointer-events-none absolute right-[5px] top-[5px] z-20 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipY className="pointer-events-none absolute bottom-[5px] left-[5px] z-10 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipX flipY className="pointer-events-none absolute bottom-[5px] right-[5px] z-10 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />

          <div className="codex-topfade" aria-hidden />

          <div className="codex-ctrl-row">
            <button
              onClick={dismiss}
              className="btn-rpg codex-ctrl"
              aria-label={t("guestbook.close")}
              title={t("guestbook.close")}
            >
              <span className="hidden lg:inline">{t("guestbook.close")}</span>
              <Glyph char={SIGN.close} size="var(--codex-ctrl-glyph)" className="glyph--until-lg" />
            </button>
          </div>

          {/* The same scroll pane an entry is read in: the ribbon scrollbar and
              the clearance under the control row are both derived there. */}
          <div className="codex-scroll codex-pane">
            <div className="guestbook-measure">
              <header className="mb-stack text-center">
                <p className="font-heading text-[0.58rem] uppercase tracking-[clamp(0.2em,0.05em+0.6vw,0.48em)] text-gold-800">
                  {t("footer.kicker")}
                </p>
                <h2 className="mt-0.5 font-display text-[clamp(1.15rem,0.9rem+1.1vw,1.875rem)] font-bold uppercase tracking-[0.16em] text-burgundy-700">
                  {t("footer.guestbook")}
                </h2>
              </header>

              {/* Two boundaries, doing different jobs: the package puts one
                  around its own subtree and shows a translated message there,
                  this one catches what that one cannot — a render failure in
                  the package's own boundary, or in this frame (§12). */}
              <ErrorBoundary label="guestbook" resetKey="guestbook" fallback={<GuestbookError />}>
                <Guestbook
                  locale={lang}
                  languageSwitcher="never"
                  theme="light"
                  header={false}
                  className="guestbook-skin"
                  config={{ apiBaseUrl: GUESTBOOK.apiBaseUrl }}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </m.div>
  );
}

/** The feature refused to render. A retry is not offered because React caches
 *  a rejected `lazy()` payload — only a reload fetches the chunk again, which
 *  is what the message says. */
function GuestbookError() {
  const { t } = useI18n();
  return (
    <p className="py-16 text-center font-display text-xl text-burgundy-600">{t("guestbook.error")}</p>
  );
}
