/**
 * What `server/counter.php` answers with. Two documents, one shape nested in
 * the other: every page view reads the small one, and only a reader who opens
 * the panel pays for the large one.
 *
 * Dates here are **ISO `YYYY-MM-DD`** — the server's format, not the
 * catalogue's `DD.MM.YYYY`. They are still not fed to `new Date()`; see
 * `parseIsoDay` in `format.ts` for why.
 */

/** The three lifetime figures, and the same three for one day. */
export interface Tally {
  readonly views: number;
  readonly visits: number;
  readonly uniques: number;
}

/** The compact document: what the odometer needs and nothing else. */
export interface Pulse extends Tally {
  /** Today, in the server's timezone. */
  readonly today: Tally;
  /** Visitors seen in the last few minutes. */
  readonly online: number;
  /** The day counting began (`YYYY-MM-DD`). */
  readonly since: string;
}

/** One row of a tally map: a page, a tongue, a browser, a referrer. */
export interface Slice {
  readonly key: string;
  readonly count: number;
}

/** One day of history. */
export interface DayPoint {
  readonly date: string;
  readonly views: number;
  readonly visits: number;
  readonly uniques: number;
}

/**
 * The full document. Everything in it is a direct read or a sum over at most
 * ninety rows on the server — there is no figure here that costs more to
 * produce the longer the counter runs.
 */
export interface Stats extends Pulse {
  /** Calendar days since `since`, today included. */
  readonly daysRunning: number;
  readonly yesterday: DayPoint;
  readonly windows: { readonly d7: Tally; readonly d30: Tally };
  readonly avg: { readonly viewsPerDay: number; readonly viewsPerVisit: number };
  readonly peak: {
    readonly day: { readonly date: string; readonly views: number };
    readonly hour: { readonly hour: number; readonly views: number; readonly date: string };
  };
  /** Consecutive days with at least one view, counting back from today. */
  readonly streak: number;
  /** Today, hour by hour: 24 numbers, index 0 = midnight. */
  readonly hours: readonly number[];
  /** Up to thirty days, oldest first. */
  readonly series: readonly DayPoint[];
  /** All-time views per weekday: 7 numbers, **index 0 = Monday**. */
  readonly weekdays: readonly number[];
  /** Views per entry — the slug is a catalogue route, resolvable to a name. */
  readonly pages: readonly Slice[];
  /** Visits per UI language the reader had chosen. */
  readonly langs: readonly Slice[];
  /** Visits per referring host; `""` never appears (direct visits are absent). */
  readonly referrers: readonly Slice[];
  readonly tech: {
    readonly device: readonly Slice[];
    readonly browser: readonly Slice[];
    readonly os: readonly Slice[];
  };
  /** Crawler requests, kept out of every figure above. */
  readonly bots: number;
}

/** The key the server uses for "everything that did not fit in the top N". */
export const OTHER_KEY = "*";
