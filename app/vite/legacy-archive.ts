import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * Dev-only mirror of the production host.
 *
 * The repository carries the catalogue data but not the whole media archive:
 * most photographs, scans and recordings exist only on the live site, and some
 * sit outside the resource base entirely (`^/main/…`, `/../main/…`). Proxying
 * one prefix at a time cannot cover that — a target that climbs out of
 * `/pages` no longer starts with `/pages` by the time it is requested.
 *
 * So instead: anything publicDir cannot serve is fetched from `target` and
 * streamed back from the dev origin. Dev URLs are then byte-for-byte the
 * production ones, and stay same-origin, so fetch/XHR work without CORS.
 *
 * Local files always win — the archive is only consulted on a miss.
 */
export function legacyArchive(target: string): Plugin {
  return {
    name: "legacy-archive",
    apply: "serve",
    configureServer(server) {
      const publicDir = server.config.publicDir;

      server.middlewares.use((req, res, next) => {
        const { pathname, search } = new URL(req.url ?? "/", "http://localhost");
        const local = decodeURIComponent(pathname);

        if (
          req.method !== "GET" ||
          !/\.\w+$/.test(local) || // module graph and SPA routes have no extension
          APP_OWNED.test(local) ||
          existsSync(join(publicDir, local))
        ) {
          return next();
        }

        fetch(target + pathname + search)
          .then(async (upstream) => {
            if (!upstream.ok) return next();
            res.setHeader(
              "content-type",
              upstream.headers.get("content-type") ?? "application/octet-stream",
            );
            res.end(Buffer.from(await upstream.arrayBuffer()));
          })
          .catch(next);
      });
    },
  };
}

/** Vite's own URL space, plus the dev shell. Legacy `.htm` pages are archive
 *  content and deliberately not excluded here; `.html` is the shell. */
const APP_OWNED = /^\/(?:@|src\/|node_modules\/)|\.html$/i;
