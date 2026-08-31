import type { EntryFacts } from "../dossier/facts";
import { fnv1a, type Dmy } from "../metadata";
import type { AnniversaryMessage } from "./types";

/**
 * "On this day" — whose birth or death this exact day and month recalls.
 *
 * Pure and synchronous: it is handed whatever the dossier index has read so
 * far and answers from that, so it can be re-run for free as facts stream in
 * (and tested by passing a date rather than by waiting for one).
 *
 * Births take precedence over deaths, per the brief: if anyone in the
 * catalogue was born today, the block celebrates rather than mourns, and the
 * deaths are not mentioned at all.
 *
 * **Order is shuffled, not ranked.** Every match is found — the whole index is
 * read, nothing is cut off — but the herald names them one at a time, one every
 * `HERALD.rotateMs`. Under a fixed order (it used to be "oldest anniversary
 * first") the same one or two people are the only ones a visitor ever reads
 * when five share the day; the rest are technically in the rotation and
 * practically invisible. So the pool is shuffled per visit and everyone gets
 * the opening slot equally often.
 *
 * The shuffle is a sort on `fnv1a(seed + slug)` rather than an RNG draw,
 * because this function is re-run on every batch of streamed dossiers: a
 * seeded hash keeps the order it already produced (the message on screen does
 * not jump under the reader), while a fresh `Math.random()` per call would
 * reshuffle the list several times a second. The caller picks `seed` once per
 * visit.
 */
export function findAnniversaries(
  facts: Iterable<EntryFacts>,
  today: Dmy,
  seed = 0,
): AnniversaryMessage[] {
  const births: AnniversaryMessage[] = [];
  const deaths: AnniversaryMessage[] = [];

  for (const entry of facts) {
    const born = anniversaryOf(entry, entry.born, "born", today);
    if (born) births.push(born);
    const died = anniversaryOf(entry, entry.died, "died", today);
    if (died) deaths.push(died);
  }

  const found = births.length ? births : deaths;
  const order = new Map(found.map((m) => [m.slug, shuffleKey(m.slug, seed)]));
  // The slug tiebreak keeps two colliding hashes in a defined order, so the
  // result is a function of (facts, seed) alone.
  return found.sort((a, b) => order.get(a.slug)! - order.get(b.slug)! || a.slug.localeCompare(b.slug));
}

/**
 * Where one entry falls in this visit's shuffle.
 *
 * The seed is not simply concatenated onto the slug: FNV mixes forward, so
 * whichever end goes last barely moves the result, and a handful of similar
 * slugs then keep almost the same relative order whatever the seed is — a
 * shuffle only in name (measured: one of five entries led 26% of visits and
 * took second place in 0.3% of them). Hashing the slug and avalanching it
 * against the seed spreads them evenly instead.
 */
function shuffleKey(slug: string, seed: number): number {
  let h = fnv1a(slug) ^ seed;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

function anniversaryOf(
  entry: EntryFacts,
  date: Dmy | null,
  event: "born" | "died",
  today: Dmy,
): AnniversaryMessage | null {
  if (!date || date.d !== today.d || date.m !== today.m) return null;

  // "Exactly N years ago" — so the year itself is not its own anniversary,
  // and a dossier dated in the future is ignored rather than shown negative.
  const years = today.y - date.y;
  if (years < 1) return null;

  return {
    kind: "anniversary",
    tone: event === "born" ? "birth" : "mourning",
    event,
    years,
    slug: entry.slug,
    name: entry.display,
    gender: entry.gender,
  };
}
