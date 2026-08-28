import { resolveContentPath } from "../paths";
import type { CatalogRecord } from "../catalog";
import { factsFrom, type EntryFacts } from "./facts";
import type { EntryData } from "../types";

/**
 * The precomputed dossier digest: every entry's searchable metadata in one
 * file instead of one request per entry.
 *
 * `facts-<lang>.json` is produced from `pages/<lang>/*.bio.json` by
 * `vite/facts-digest.ts` — served from memory in development, emitted as a
 * static asset on build. Its shape is deliberately positional, because at a
 * thousand entries the field *names* would outweigh the data:
 *
 *     { "v": 1, "lang": "ru",
 *       "entries": { "abiton": ["Жерар", "Абитон", "1954", ""] } }
 *
 * ~53 KB raw for 736 entries, against 736 requests and ~0.7 MB for the crawl
 * it replaces. It is a **cache, not a source**: `pages/` remains the only
 * place a fact is authored, the digest is never written into the repository,
 * and a language without one simply falls back to the crawl (see
 * `factsStore.ts`). Nothing downstream can tell which path produced a fact —
 * both end in `factsFrom`, so the projection cannot drift between them.
 */

/** [forename, surname, born, died] — absent fields are "". */
type Row = readonly [string, string, string, string];

export interface Digest {
  readonly entries: ReadonlyMap<string, Row>;
}

const digests = new Map<string, Promise<Digest | null>>();

/**
 * The digest for a language, fetched once per session. A missing file is a
 * normal answer (`null`), not a failure: it means "read the dossiers yourself".
 */
export function loadDigest(lang: string): Promise<Digest | null> {
  let request = digests.get(lang);
  if (!request) {
    request = fetch(resolveContentPath(`/facts-${lang}.json`))
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .then(parse)
      .catch(() => {
        // A network blip must not condemn the session to 736 requests; the
        // next reader retries, and until then the crawl covers it.
        digests.delete(lang);
        return null;
      });
    digests.set(lang, request);
  }
  return request;
}

/** One digest row → the same facts the crawl would have produced. */
export function factsFromRow(record: CatalogRecord, row: Row | undefined): EntryFacts {
  if (!row) return factsFrom(record, null);
  const data: EntryData = {
    metadata: {
      forename: row[0] || undefined,
      surname: row[1] || undefined,
      dates: { born: row[2] || undefined, died: row[3] || undefined },
    },
  };
  return factsFrom(record, data);
}

function parse(raw: unknown): Digest | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as { v?: unknown; entries?: unknown };
  // A digest written by a newer build may mean something else by the same
  // shape; reading it as v1 would be a guess. Fall back to the crawl instead.
  if (doc.v !== 1 || !doc.entries || typeof doc.entries !== "object") return null;

  const entries = new Map<string, Row>();
  for (const [slug, value] of Object.entries(doc.entries as Record<string, unknown>)) {
    if (!Array.isArray(value) || value.length < 4) continue;
    if (value.some((cell) => typeof cell !== "string")) continue;
    entries.set(slug, value.slice(0, 4) as unknown as Row);
  }
  return entries.size ? { entries } : null;
}
