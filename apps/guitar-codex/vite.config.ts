import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { legacyArchive } from "./vite/legacy-archive";
import { contentWatch, ignoreContent } from "./vite/content-watch";
import { pdfjsAssets } from "./vite/pdfjs-assets";
import { immutableHeaders } from "./vite/immutable-headers";

/**
 * The app is a pure renderer: all catalogue content (index.json, *.bio.json,
 * *.bio.md, photos/) lives in the repository's `pages/` directory, which is
 * mounted as Vite's publicDir and therefore served (and copied on build)
 * verbatim at the site root. Nothing from `pages/` is imported into the
 * bundle — data stays data.
 */
/**
 * Deployment path prefix (e.g. "/fable/" when the app is served from
 * abc-guitars.com/fable/ instead of the domain root). Overridable per build
 * via `--base=/some/path/` (Vite's own CLI flag) or the DEPLOY_BASE env var;
 * index.json and its json/md/img values resolve relative to BASE_URL.
 * Resources referenced inside biography files use the independent
 * VITE_RESOURCE_BASE_PATH setting (default: "/pages").
 */
const base = process.env.DEPLOY_BASE ?? "/";

/**
 * Where the guestbook's PHP API and its assets are served from in development.
 * In production the app and the API share an origin, so the guestbook's own
 * `apiBaseUrl` ("/gbook/api") is already correct and nothing is proxied.
 */
const GUESTBOOK_ORIGIN = process.env.GUESTBOOK_ORIGIN ?? "https://www.abc-guitars.com";

// `../../pages` — this config sits at apps/guitar-codex/, two levels below the
// workspace root that owns the content tree (see the repository README).
const contentDir = fileURLToPath(new URL("../../pages", import.meta.url));

/**
 * The per-language content directories (`pages/ru/`, `pages/en/`, …). Read
 * once at config time: they hold ~16 000 files between them and the dev server
 * neither bundles nor transforms a single one, so watching them buys nothing
 * and costs both memory and stability (see vite/content-watch.ts).
 */
const contentLangDirs = readdirSync(contentDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^[a-z]{2}$/.test(e.name))
  .map((e) => join(contentDir, e.name));

/**
 * Packages that make up the Markdown renderer (see `manualChunks` below):
 * react-markdown, the remark plugins, and the unified / mdast / hast /
 * micromark / unist families they are built from, plus their small helpers.
 * A helper missing from this list is not a bug — it simply rides in the codex
 * chunk instead of the vendor one.
 */
const MARKDOWN_PACKAGES =
  /^(react-markdown|remark-.+|unified|vfile(-message)?|bail|trough|devlop|is-plain-obj|extend|(mdast|hast|unist)-util-.+|micromark(-.+)?|decode-named-character-reference|character-(entities|reference-invalid).*|property-information|(space|comma)-separated-tokens|html-url-attributes|estree-util-is-identifier-name|style-to-(js|object)|inline-style-parser|ccount|escape-string-regexp|markdown-table|longest-streak|trim-lines|zwitch)$/;

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    contentWatch(),
    pdfjsAssets(),
    immutableHeaders(),
    legacyArchive("https://www.abc-guitars.com"),
  ],
  publicDir: contentDir,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    /**
     * One React runtime for the whole product
     * (docs/react-modular-architecture.md §25). The two feature packages
     * declare React as a *peer* and are linked into this build from
     * `packages/`; without this a second copy can resolve through the linked
     * package and every hook in it throws "Invalid hook call".
     *
     * Deliberately absent: `optimizeDeps.exclude` for the feature packages.
     * Vite already treats linked ESM workspace packages as source (§11).
     */
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    /**
     * The guestbook talks to the legacy PHP REST API, which returns absolute
     * paths for its emoticons, flags and uploads. In development those live on
     * the production host, so they are proxied from the dev origin — same
     * URLs as production, same origin, no CORS
     * (docs/guestbook-integration.md §9).
     *
     * `legacy-archive` cannot stand in for this: it only answers GETs for URLs
     * that end in a file extension, and `/gbook/api/entries` is a POST target
     * with no extension.
     */
    proxy: Object.fromEntries(
      ["/gbook/api", "/gbook/emoticons", "/gbook/flags", "/gbook/upload"].map((path) => [
        path,
        { target: GUESTBOOK_ORIGIN, changeOrigin: true, secure: true },
      ]),
    ),
    watch: {
      ignored: [ignoreContent(contentLangDirs)],
      // A content file written in pieces must not be read (or watched) while
      // the writing tool still holds it open.
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    },
  },
  build: {
    target: "baseline-widely-available",
    rollupOptions: {
      output: {
        /**
         * Stable framework chunks cache independently from application code.
         *
         * Decided **per module, by the package it comes from** — not by the
         * object form (`{ react: ["react", …] }`). That form also sweeps each
         * listed package's *dependencies* into its chunk, and a dependency
         * shared by two of them (React itself: the Markdown renderer depends
         * on it too) lands in whichever Rollup reaches first. With the
         * animation library gone that turned out to be the Markdown chunk —
         * 47 KB gzipped that only an open codex needs, statically imported by
         * the entry. `scripts/verify-pdf-build.mjs` holds the entry to a
         * budget so that cannot happen silently again.
         */
        manualChunks(id) {
          const at = id.lastIndexOf("node_modules/");
          if (at === -1) return undefined;
          const path = id.slice(at + "node_modules/".length);
          const name = path.startsWith("@") ? path.split("/", 2).join("/") : path.split("/", 1)[0];

          if (name === "react" || name === "react-dom" || name === "scheduler") return "react";

          // pdf.js is the largest dependency in the tree and the least often
          // needed. Its only importer is the lazily-loaded pdf.js reader, so
          // naming it here does not pull it forward — it gives the engine a
          // stable chunk of its own that survives every application deploy in
          // the reader's cache. (The ~1.3 MB worker is a separate emitted
          // asset; see src/lib/pdf/engine.ts, which imports the package's
          // `legacy/` build — the only one that may ever be in this chunk.)
          if (name === "pdfjs-dist") return "pdf";

          // The Markdown pipeline: react-markdown, remark and the unified
          // family beneath them. Reached only through the lazy codex chunk.
          if (MARKDOWN_PACKAGES.test(name)) return "markdown";

          return undefined;
        },
      },
    },
  },
});
