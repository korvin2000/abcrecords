import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { legacyArchive } from "./vite/legacy-archive";
import { contentWatch, ignoreContent } from "./vite/content-watch";
import { pdfjsAssets } from "./vite/pdfjs-assets";

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

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    contentWatch(),
    pdfjsAssets(),
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
        // Stable framework chunks cache independently from application code.
        manualChunks: {
          react: ["react", "react-dom", "react-dom/client"],
          motion: ["framer-motion"],
          markdown: ["react-markdown", "remark-gfm", "unist-util-visit"],
          // pdf.js is the largest dependency in the tree and the least often
          // needed. Its only importer is the lazily-loaded document viewer, so
          // naming it here does not pull it forward — it gives the engine a
          // stable chunk of its own that survives every application deploy in
          // the reader's cache. (The ~1 MB worker is a separate emitted asset;
          // see src/lib/pdf/engine.ts.)
          pdf: ["pdfjs-dist"],
        },
      },
    },
  },
});
