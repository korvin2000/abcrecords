import { parseDmy, type Dmy } from "../metadata";

/**
 * Today, as the reader's calendar sees it.
 *
 * A `Dmy` rather than a `Date`, because everything it is compared against is a
 * `DD.MM.YYYY` string from a dossier — mixing the two is how "born on the 1st"
 * turns into a timezone bug.
 *
 * In development a `?herald-date=DD.MM.YYYY` query parameter pins the day, so
 * an anniversary can be looked at without waiting for the calendar. The
 * override is compiled out of production builds.
 */
export function todayDmy(): Dmy {
  if (import.meta.env.DEV) {
    const pinned = pinnedDate();
    if (pinned) return pinned;
  }
  const now = new Date();
  return { d: now.getDate(), m: now.getMonth() + 1, y: now.getFullYear() };
}

function pinnedDate(): Dmy | null {
  try {
    return parseDmy(new URLSearchParams(window.location.search).get("herald-date"));
  } catch {
    return null;
  }
}
