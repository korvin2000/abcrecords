import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * Precomputed dossier digests — one small file per language, in place of one
 * request per entry.
 *
 * The advanced search (given name, family name, year ranges) and the herald's
 * "on this day" lookup both need a *cross-entry* view of metadata that lives
 * one `*.bio.json` at a time. `lib/dossier/factsStore.ts` used to obtain that
 * by reading every dossier in the catalogue: 736 requests and ~0.7 MB of JSON
 * per visit, of which the readers keep four fields.
 *
 * This plugin projects those four fields ahead of time:
 *
 *     /facts-<lang>.json   { "v": 1, "lang": "ru",
 *                            "entries": { "<slug>": [forename, surname, born, died] } }
 *
 * ~50 KB raw, ~15 KB over the wire, one request. Positional tuples rather than
 * objects because the key names would otherwise outweigh the data; absent
 * fields are `""`, so a row is always four strings and the reader needs no
 * presence checks.
 *
 * The digest is a **cache, not a source**: it is derived from `pages/`, it is
 * never written into the repository, and `factsStore` still falls back to
 * reading dossiers one by one when a language has no digest. That is what
 * keeps `pages/` the single source of truth and keeps the app a pure renderer.
 *
 * In dev it is built on first request and held in memory; a rebuild is one
 * reload away because nothing caches it across server restarts. At build time
 * every language is emitted as a static asset beside the rest of `pages/`.
 */
export function factsDigest(contentDir: string): Plugin {
  const digests = new Map<string, Promise<string | null>>();
  let building = false;

  const digest = (lang: string): Promise<string | null> => {
    let built = digests.get(lang);
    if (!built) {
      built = buildDigest(contentDir, lang).catch(() => null);
      digests.set(lang, built);
    }
    return built;
  };

  return {
    name: "facts-digest",

    configResolved(config) {
      // `buildStart` runs for the dev server too; only a real build should
      // walk all eleven language directories up front.
      building = config.command === "build";
    },

    /**
     * In development the digest is rebuilt for **every** request rather than
     * memoized, and that is deliberate.
     *
     * The obvious design is to cache it and drop the cache when a dossier
     * changes — but `vite/content-watch.ts` deliberately keeps the per-language
     * content directories out of the watch (16 000 files, and a transient one
     * among them used to kill the dev server), so no `change` event for a
     * `*.bio.json` will ever arrive. A cache invalidated by an event that
     * cannot fire is a cache that never invalidates: an author would edit a
     * dossier, reload, and see yesterday's facts until they restarted Vite.
     *
     * Rebuilding costs one `readdir` and ~740 small reads — measured at
     * ~170 ms cold and less once the OS cache is warm, against one request per
     * page load. That is far below the noise floor of a dev reload, and it is
     * always right. The build path still memoizes, because there the content
     * cannot change underneath it.
     */
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const lang = DIGEST_URL.exec(new URL(req.url ?? "/", "http://localhost").pathname)?.[1];
        if (!lang) return next();

        void buildDigest(contentDir, lang)
          .catch(() => null)
          .then((body) => {
            if (body === null) return next();
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            res.end(body);
          });
      });
    },

    async buildStart() {
      if (!building) return;
      for (const lang of await languageDirs(contentDir)) {
        const body = await digest(lang);
        if (body !== null) {
          this.emitFile({ type: "asset", fileName: `facts-${lang}.json`, source: body });
        }
      }
    },
  };
}

/** `/facts-ru.json`, with or without a deployment base in front of it. */
const DIGEST_URL = /(?:^|\/)facts-([a-z]{2})\.json$/;

/** Every `pages/<xx>/` that holds dossiers. */
async function languageDirs(contentDir: string): Promise<string[]> {
  const entries = await readdir(contentDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && /^[a-z]{2}$/.test(e.name)).map((e) => e.name);
}

interface DossierShape {
  metadata?: {
    forename?: unknown;
    surname?: unknown;
    dates?: { born?: unknown; died?: unknown };
  };
}

async function buildDigest(contentDir: string, lang: string): Promise<string | null> {
  const dir = join(contentDir, lang);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".bio.json"));
  if (files.length === 0) return null;

  const entries: Record<string, [string, string, string, string]> = {};

  // Bounded parallelism: the whole point is to be quick, but a thousand open
  // file handles is how a build starts failing on EMFILE.
  const cursor = { next: 0 };
  await Promise.all(
    Array.from({ length: Math.min(16, files.length) }, async () => {
      for (let i = cursor.next++; i < files.length; i = cursor.next++) {
        const file = files[i];
        const row = await project(join(dir, file));
        if (row) entries[file.replace(/\.bio\.json$/i, "")] = row;
      }
    }),
  );

  return JSON.stringify({ v: 1, lang, entries });
}

/** One dossier → the four searchable fields, or null when it has none. */
async function project(path: string): Promise<[string, string, string, string] | null> {
  let data: DossierShape;
  try {
    data = JSON.parse(await readFile(path, "utf8")) as DossierShape;
  } catch {
    return null; // an unreadable dossier simply contributes no facts
  }

  const meta = data?.metadata;
  if (!meta) return null;

  const row: [string, string, string, string] = [
    str(meta.forename),
    str(meta.surname),
    str(meta.dates?.born),
    str(meta.dates?.died),
  ];
  return row.some(Boolean) ? row : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
