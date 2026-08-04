import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { FEATURES } from "@/config";
import type { FactsBySlug } from "@/lib/dossier";
import { messageKey, useHerald } from "@/lib/herald";
import { useI18n } from "@/lib/i18n";
import { HeraldFrame } from "./HeraldFrame";
import { HeraldMessageView } from "./HeraldMessageView";
import { TONES } from "./tones";

/**
 * The herald — the plaque under the title that speaks in turns: the
 * catalogue's own line to open with, then "on this day" when the calendar
 * recalls one of the lives inside, then a saying from the book of sayings.
 *
 * The block itself only presents. *What* to show and *when* belong to
 * `useHerald`; how a tone looks belongs to the tone table and `.herald--*` in
 * index.css. Messages cross-fade with `mode="wait"` so only one is ever
 * mounted, while the frame's own CSS transition carries the tone across —
 * animating the whole plaque per switch would be needless compositing on the
 * weak devices this app targets.
 */
export function HeraldBanner({
  facts,
  onOpenEntry,
}: {
  /** Dossier facts read so far — the "on this day" lookup reads these. */
  facts: FactsBySlug;
  onOpenEntry?: (slug: string) => void;
}) {
  const { lang } = useI18n();
  const reduced = useReducedMotion();
  const message = useHerald(facts, lang, FEATURES.herald);

  if (!FEATURES.herald) return null;

  const shift = reduced ? 0 : 8;

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.05 }}
      className="mx-auto mt-5 w-full max-w-2xl px-4"
    >
      <HeraldFrame tone={TONES[message.tone]}>
        {/* polite, so a rotation is announced without interrupting */}
        <div aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={messageKey(message)}
              initial={{ opacity: 0, y: shift }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -shift, transition: { duration: 0.25 } }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <HeraldMessageView message={message} onOpenEntry={onOpenEntry} />
            </m.div>
          </AnimatePresence>
        </div>
      </HeraldFrame>
    </m.div>
  );
}
