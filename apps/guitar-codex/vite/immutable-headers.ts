import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * Ships the long-cache header rule with the files it is about.
 *
 * Everything under `assets/` has a content hash in its name and everything
 * under `pdfjs/` is pinned to the pdf.js version, so both may be cached for a
 * year and never revalidated — but the deployed host sent no `Cache-Control`
 * at all, so every visit re-asked for every chunk
 * (docs/performance-analysis.md §5.2, N-3). The rule is an `.htaccess` file,
 * and an `.htaccess` that lives *inside* the build's own directories is the one
 * piece of server configuration a deploy cannot forget: it is uploaded with
 * the chunks. It is guarded by `<IfModule>`, so a host without `mod_headers`
 * ignores it rather than answering 500.
 *
 * The site root's rules (compression, revalidation for JSON) are **not**
 * emitted: the root belongs to the legacy site and has an `.htaccess` of its
 * own. Those live in `server/htaccess/root.htaccess`, to be merged by hand.
 */

const SOURCE = fileURLToPath(new URL("../../../server/htaccess/immutable.htaccess", import.meta.url));

/** Directories of the build whose every file is safe to cache for ever. */
const IMMUTABLE_DIRS = ["assets", "pdfjs"] as const;

export function immutableHeaders(): Plugin {
  let outDir = "dist";

  return {
    name: "immutable-headers",
    apply: "build",

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },

    async writeBundle() {
      await Promise.all(
        IMMUTABLE_DIRS.map(async (dir) => {
          // `pdfjs/` is written by another plugin's writeBundle, and the hooks
          // run in parallel — make the directory rather than assume it.
          await mkdir(join(outDir, dir), { recursive: true });
          await copyFile(SOURCE, join(outDir, dir, ".htaccess"));
        }),
      );
    },
  };
}
