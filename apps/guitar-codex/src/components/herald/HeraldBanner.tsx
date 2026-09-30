import { memo, useEffect, useRef, useState } from "react";
import { FEATURES } from "@/config";
import type { FactsBySlug } from "@/lib/dossier";
import { messageKey, useHerald, type HeraldMessage } from "@/lib/herald";
import { useI18n } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/motion";
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
 * index.css. Messages cross-fade "wait"-style — the old one leaves, *then* the
 * new one enters (`useMessageSwap` below) — so only one is ever mounted, while the frame's own CSS transition carries the tone across —
 * animating the whole plaque per switch would be needless compositing on the
 * weak devices this app targets.
 */
export const HeraldBanner = memo(function HeraldBanner({
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
  const shown = useMessageSwap(message, reduced ? 0 : LEAVE_MS);

  if (!FEATURES.herald) return null;

  return (
    <div className="herald-rise mx-auto mt-stack w-full max-w-2xl px-2">
      <HeraldFrame tone={TONES[message.tone]}>
        {/* polite, so a rotation is announced without interrupting */}
        <div aria-live="polite" aria-atomic="true">
          <div
            key={shown.key}
            className={shown.entering ? "herald-message herald-message--enter" : "herald-message"}
            data-leaving={shown.leaving || undefined}
          >
            <HeraldMessageView message={shown.message} onOpenEntry={onOpenEntry} />
          </div>
        </div>
      </HeraldFrame>
    </div>
  );
});

/** The old message's exit (`.herald-message[data-leaving]`, herald.css). */
const LEAVE_MS = 250;

/**
 * The message on display, one rotation behind `message` for the length of an
 * exit.
 *
 * When `messageKey(message)` changes, the message still shown is marked
 * `leaving` (its CSS exit plays) and swapped for the current one `leaveMs`
 * later; the swapped-in element is keyed afresh, so it mounts with `entering`
 * and plays its entrance. The very first message has nothing to replace and
 * does not animate. A message with the *same* key — the same line re-read in
 * another language, or rebuilt as facts arrive — is followed in place, with no
 * transition, as a keyed element re-renders.
 */
function useMessageSwap(message: HeraldMessage, leaveMs: number) {
  const key = messageKey(message);
  const [shown, setShown] = useState({ message, key, entering: false });
  const leaving = key !== shown.key;

  // Adjusted during render: the frame that brings a fresher copy of the same
  // message must already draw it.
  if (!leaving && message !== shown.message) setShown({ ...shown, message });

  // Whatever is current when the exit ends is what comes in — a rotation that
  // moves on again mid-exit does not restart the wait.
  const latest = useRef(message);
  useEffect(() => {
    latest.current = message;
  });

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      const next = latest.current;
      setShown({ message: next, key: messageKey(next), entering: true });
    }, leaveMs);
    return () => window.clearTimeout(timer);
    // `shown.key` as well: if the message moved on again in the very commit
    // that swapped, `leaving` stays true and nothing else would re-arm the
    // timer — the plaque would sit on a message that has already left.
  }, [leaving, shown.key, leaveMs]);

  return { ...shown, leaving };
}
