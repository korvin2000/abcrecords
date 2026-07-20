import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  publicDir: fileURLToPath(new URL("../pages", import.meta.url)),
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    target: "baseline-widely-available",
    rollupOptions: {
      output: {
        // Stable framework chunks cache independently from application code.
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["framer-motion"],
          markdown: ["react-markdown", "remark-gfm", "unist-util-visit"],
        },
      },
    },
  },
});
