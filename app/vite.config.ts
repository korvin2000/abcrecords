import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { legacyArchive } from "./vite/legacy-archive";
import { contentWatch, ignoreContent } from "./vite/content-watch";
import { factsDigest } from "./vite/facts-digest";

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

const contentDir = fileURLToPath(new URL("../pages", import.meta.url));

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
    factsDigest(contentDir),
    legacyArchive("https://www.abc-guitars.com"),
  ],
  publicDir: contentDir,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
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
        },
      },
    },
  },
});
