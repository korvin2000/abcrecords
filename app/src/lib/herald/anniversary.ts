import type { EntryFacts } from "../dossier/facts";
import type { Dmy } from "../metadata";
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
 * deaths are not mentioned at all. Within one event the older anniversary
 * leads, since that is the more remarkable number.
 */
export function findAnniversaries(
  facts: Iterable<EntryFacts>,
  today: Dmy,
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
  return found.sort((a, b) => b.years - a.years || a.name.localeCompare(b.name));
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
