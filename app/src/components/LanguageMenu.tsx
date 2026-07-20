import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import clsx from "clsx";
import { LANGUAGES, type Lang } from "@/lib/languages";
import { audio } from "@/lib/audio";
import { Flag } from "./Flag";

interface Props {
  /** Currently selected language code. */
  value: Lang;
  /** Codes to offer (rendered in canonical LANGUAGES order). */
  options: readonly Lang[];
  onSelect: (code: Lang) => void;
  /**
   * header — round-ish trigger for the fixed top bar, panel drops to the right edge.
   * codex — dark RPG-button trigger for the codex top bar, panel drops centered.
   */
  variant: "header" | "codex";
  /** Tooltip / aria-label for the trigger. */
  title: string;
  /** Small ornamental heading inside the panel. */
  heading: string;
}

/**
 * The language menu of the codex — a parchment panel listing each tongue by
 * its own name beside its colorful flag, in the same antique gold/burgundy
 * style as the rest of the chrome. Used in the site header (all ten
 * languages) and inside the codex modal (only the entry's editions).
 */
export function LanguageMenu({ value, options, onSelect, variant, title, heading }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = LANGUAGES.filter((l) => options.includes(l.code));
  const current = LANGUAGES.find((l) => l.code === value) ?? items[0];

  // Dismiss on outside click / Escape — a menu, not a modal. The key handler
  // runs in the capture phase and stops propagation so that Escape closes
  // ONLY the menu, not the codex modal listening behind it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [open]);

  const toggle = () => {
    audio.click();
    setOpen((o) => !o);
  };

  const choose = (code: Lang) => {
    setOpen(false);
    if (code !== value) {
      audio.pageTurn();
      onSelect(code);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={toggle}
        onMouseEnter={() => audio.hover()}
        title={title}
        aria-label={`${title}: ${current.native}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          "flex items-center gap-1.5 transition-all",
          variant === "header"
            ? clsx(
                "h-9 rounded-full border px-2.5",
                open
                  ? "border-gold-600/80 bg-gold-500/25 shadow-[0_0_12px_rgba(184,144,42,0.45)]"
                  : "border-gold-600/40 hover:border-gold-600/70 hover:bg-gold-500/15",
              )
            : "btn-rpg !px-3 !py-[0.4rem]",
        )}
      >
        <Flag code={current.code} className="h-3.5 w-[1.35rem] drop-shadow-sm" />
        <span
          className={clsx(
            "font-heading text-[0.68rem] font-bold uppercase tracking-wider",
            variant === "header" && "text-ink-800",
          )}
        >
          {current.code}
        </span>
        <svg
          viewBox="0 0 10 6"
          className={clsx(
            "h-1.5 w-2.5 transition-transform duration-200",
            open && "rotate-180",
            variant === "header" ? "text-gold-700" : "text-gold-300",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <div
            className={clsx(
              "absolute top-full z-50 pt-2",
              variant === "codex" ? "left-1/2 -translate-x-1/2" : "right-0",
            )}
          >
            <m.div
              initial={{ opacity: 0, y: -7, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.97, transition: { duration: 0.14 } }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={clsx(
                "overflow-hidden rounded-md border border-gold-600/60 bg-paper-50/95 backdrop-blur-sm",
                "shadow-[0_10px_34px_rgba(51,34,15,0.32),inset_0_0_24px_rgba(138,106,31,0.08)]",
                variant === "codex" ? "w-48 origin-top" : "w-52 origin-top-right",
              )}
              role="listbox"
              aria-label={heading}
            >
              <div className="border-b border-gold-600/35 bg-paper-100/85 px-3 py-1.5 text-center font-heading text-[0.58rem] font-bold uppercase tracking-[0.28em] text-sepia-600">
                <span className="mr-1.5 text-gold-600" aria-hidden>✦</span>
                {heading}
                <span className="ml-1.5 text-gold-600" aria-hidden>✦</span>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto py-1">
                {items.map((l) => {
                  const selected = l.code === value;
                  return (
                    <li key={l.code}>
                      <button
                        role="option"
                        aria-selected={selected}
                        onClick={() => choose(l.code)}
                        onMouseEnter={() => audio.hover()}
                        className={clsx(
                          "flex w-full items-center gap-2.5 px-3 py-[0.4rem] text-left transition-colors duration-150",
                          selected
                            ? "bg-gold-500/25 text-burgundy-700"
                            : "text-ink-800 hover:bg-gold-500/12 hover:text-burgundy-600",
                        )}
                      >
                        <Flag code={l.code} className="h-[0.95rem] w-6 shrink-0 drop-shadow-sm" />
                        <span className="font-heading text-[0.92rem] font-semibold leading-tight tracking-wide">
                          {l.native}
                        </span>
                        {selected && (
                          <span className="ml-auto text-[0.7rem] text-gold-700" aria-hidden>
                            ✦
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
