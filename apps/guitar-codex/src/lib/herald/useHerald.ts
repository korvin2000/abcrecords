import { useEffect, useMemo, useState } from "react";
import { HERALD } from "@/config";
import type { FactsBySlug } from "../dossier/facts";
import type { Lang } from "../languages";
import { findAnniversaries } from "./anniversary";
import { buildPlaylist } from "./playlist";
import { loadQuotes } from "./quotes";
import { todayDmy } from "./today";
import {
  DEFAULT_MESSAGE,
  type AnniversaryMessage,
  type HeraldMessage,
  type QuoteMessage,
} from "./types";

/**
 * What the herald block should be showing right now.
 *
 * The sequence the brief asks for, and how each part is honoured:
 *
 *   • the default line opens the block — `index === null`;
 *   • a few seconds later it gives way to whatever the playlist offers first,
 *     normally an anniversary (`HERALD.revealDelayMs`, picked once per visit
 *     as an absolute deadline so streaming dossiers cannot keep postponing it);
 *   • from then on messages take turns every `HERALD.rotateMs`;
 *   • with nothing to say the default line simply stays;
 *   • with exactly one thing to say it is shown once and **no timer runs** —
 *     an interval that always re-renders the same message is pure waste on a
 *     weak device.
 *
 * The hook owns scheduling only. What there is to say is decided by
 * `findAnniversaries` (pure) and `loadQuotes` (cached I/O), so both can be
 * reasoned about — and re-run as facts arrive — without touching timers.
 */
export function useHerald(facts: FactsBySlug, lang: Lang, enabled: boolean): HeraldMessage {
  const [quotes, setQuotes] = useState<readonly QuoteMessage[]>(EMPTY_QUOTES);
  const [index, setIndex] = useState<number | null>(null);

  // All four are fixed for the visit, and lazily initialized (a `useState`
  // initializer runs once; `useRef(expr)` would re-evaluate `expr` every
  // render and throw the result away). The day must not shift under a
  // long-open tab's memo, and the reveal deadline must not restart as facts
  // stream in — hence an absolute timestamp rather than a delay. The two
  // random draws are per visit for the same reason: they decide which saying
  // and which of today's anniversaries open the rotation, and re-drawing them
  // as dossiers arrive would reshuffle the block under the reader.
  const [today] = useState(todayDmy);
  const [revealAt] = useState(() => Date.now() + revealDelay());
  const [quoteOffset] = useState(() => Math.floor(Math.random() * 1000));
  const [anniversarySeed] = useState(() => (Math.random() * 0x100000000) >>> 0);

  useEffect(() => {
    if (!enabled || !HERALD.quotes) return;
    let alive = true;
    void loadQuotes(lang).then((loaded) => {
      if (alive) setQuotes(loaded);
    });
    return () => {
      alive = false;
    };
  }, [enabled, lang]);

  const anniversaries = useMemo(
    () =>
      enabled && HERALD.anniversaries
        ? findAnniversaries(facts.values(), today, anniversarySeed)
        : EMPTY_ANNIVERSARIES,
    [enabled, facts, today, anniversarySeed],
  );

  const playlist = useMemo(
    () => buildPlaylist(anniversaries, quotes, quoteOffset),
    [anniversaries, quotes, quoteOffset],
  );

  // Depends on the *length*, not the array: the playlist is rebuilt whenever
  // dossiers arrive or the language flips, and restarting the clock for an
  // equally long list would stall the rotation forever.
  const { length } = playlist;
  useEffect(() => {
    if (!enabled || length === 0) return;
    if (index !== null && length < 2) return;

    const delay = index === null ? Math.max(0, revealAt - Date.now()) : HERALD.rotateMs;
    const timer = setTimeout(() => {
      setIndex((current) => (current === null ? 0 : (current + 1) % length));
    }, delay);
    return () => clearTimeout(timer);
  }, [enabled, length, index, revealAt]);

  if (!enabled || index === null || length === 0) return DEFAULT_MESSAGE;
  return playlist[index % length];
}

const EMPTY_QUOTES: readonly QuoteMessage[] = [];
const EMPTY_ANNIVERSARIES: readonly AnniversaryMessage[] = [];

function revealDelay(): number {
  const [min, max] = HERALD.revealDelayMs;
  return min + Math.random() * (max - min);
}
