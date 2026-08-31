import { createReadStream } from "node:fs";
import { cp, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * pdf.js's runtime data files, served beside the app at `<base>pdfjs/`.
 *
 * The engine is code and gets bundled; these are *data* and must not be.
 * pdf.js fetches them lazily, per document, and only when a document actually
 * needs one:
 *
 *   cmaps/           character maps for CJK and other multi-byte encodings
 *   standard_fonts/  the fourteen PostScript fonts a PDF may reference
 *                    without embedding (Helvetica, Times, Courier, Symbol…)
 *   iccs/            colour profiles
 *   wasm/            the image decoders — JPEG 2000, JBIG2 — that scanned
 *                    material is full of, plus qcms
 *
 * Together ~3.8 MB on disk and, for a typical document, zero to two files over
 * the wire. Without them a scan opens with blank pages where its JPEG 2000
 * images were, or with substituted glyphs, and pdf.js says so only in the
 * console.
 *
 * Why a plugin rather than `public/`: Vite's `publicDir` here is the
 * repository's `pages/` content tree (see vite.config.ts), which is content,
 * not build machinery — these files have no business being committed into it.
 * So they are copied out of `node_modules` at build time and streamed straight
 * from `node_modules` in development, which also means upgrading pdfjs-dist
 * can never leave a stale copy behind.
 *
 * The URLs resolve against the **application** base, so the app carries its
 * own decoders to `/fable/` or wherever else it is deployed; the matching
 * reader is `ASSET_BASE` in src/lib/pdf/engine.ts.
 */

/** Directory names under pdfjs-dist, served verbatim under the prefix below. */
const ASSET_DIRS = ["cmaps", "standard_fonts", "iccs", "wasm"] as const;

const URL_PREFIX = "pdfjs";

/**
 * Content types pdf.js's loaders actually care about. `.wasm` is the one that
 * must be right: the decoders are started with `instantiateStreaming`, which
 * rejects anything not served as `application/wasm`.
 */
const CONTENT_TYPES: Record<string, string> = {
  ".wasm": "application/wasm",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".icc": "application/vnd.iccprofile",
  ".bcmap": "application/octet-stream",
  ".pfb": "application/octet-stream",
};

export function pdfjsAssets(): Plugin {
  const require = createRequire(import.meta.url);
  // Resolved through Node rather than assumed to sit at ../node_modules: this
  // has to keep working under pnpm, Yarn PnP and a hoisted monorepo alike.
  const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));

  let base = "/";
  let outDir = "dist";

  return {
    name: "pdfjs-assets",

    configResolved(config) {
      base = config.base;
      outDir = resolve(config.root, config.build.outDir);
    },

    /** Development: serve the files from where production will have them. */
    configureServer(server) {
      const prefix = `${base}${URL_PREFIX}/`;
      server.middlewares.use((req, res, next) => {
        const { pathname } = new URL(req.url ?? "/", "http://localhost");
        if (req.method !== "GET" || !pathname.startsWith(prefix)) return next();

        const rest = decodeURIComponent(pathname.slice(prefix.length));
        const [dir] = rest.split("/");
        // Only the four known directories, and no climbing out of them: this
        // middleware reads from node_modules, so the path must never be able
        // to address anything else in there.
        if (!isAssetDir(dir) || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(rest)) return next();

        const file = join(pdfjsRoot, rest);
        stat(file)
          .then((info) => {
            if (!info.isFile()) return next();
            res.setHeader("content-type", CONTENT_TYPES[extname(file)] ?? "application/octet-stream");
            res.setHeader("content-length", info.size);
            createReadStream(file).pipe(res);
          })
          .catch(next);
      });
    },

    /** Build: copy them next to the bundle, once Vite has written it. */
    async writeBundle() {
      await Promise.all(
        ASSET_DIRS.map((dir) =>
          cp(join(pdfjsRoot, dir), join(outDir, URL_PREFIX, dir), { recursive: true, force: true }),
        ),
      );
    },
  };
}

function isAssetDir(name: string): name is (typeof ASSET_DIRS)[number] {
  return (ASSET_DIRS as readonly string[]).includes(name);
}
