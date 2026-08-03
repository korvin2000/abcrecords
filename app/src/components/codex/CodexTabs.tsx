import clsx from "clsx";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { useCodexScroll } from "./codexScroll";

export type CodexTab = "biography" | "gallery" | "documents" | "lore";

export const CODEX_TABS: readonly CodexTab[] = ["biography", "gallery", "documents", "lore"];

/** The four-tab strip of a biography codex (docs/Biography_card_Design.md).
 *  A page has no dossier and therefore no tab bar at all. */
export function CodexTabs({
  value,
  onChange,
}: {
  value: CodexTab;
  onChange: (tab: CodexTab) => void;
}) {
  const { t } = useI18n();
  const scrollToTop = useCodexScroll();

  const select = (next: CodexTab) => {
    if (next === value) return;
    audio.pageTurn();
    onChange(next);
    scrollToTop();
  };

  return (
    <nav
      className="mb-6 flex flex-wrap justify-center gap-1 rounded-md border border-gold-600/40 bg-paper-100/60 p-1 sm:gap-2"
      role="tablist"
    >
      {CODEX_TABS.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={value === tab}
          onClick={() => select(tab)}
          onMouseEnter={() => audio.hover()}
          className={clsx(
            "rounded px-3 py-1.5 font-heading text-[0.72rem] uppercase tracking-[0.18em] transition-all duration-200 sm:px-5 sm:text-[0.8rem]",
            value === tab
              ? "bg-burgundy-600 text-paper-50 shadow-[0_2px_10px_rgba(122,31,43,0.4)]"
              : "text-sepia-600 hover:bg-paper-200/80 hover:text-ink-800",
          )}
        >
          {t(`tabs.${tab}`)}
        </button>
      ))}
    </nav>
  );
}
