import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * The dev host's build — the stand-in for `apps/encyclopedia/vite.config.ts`.
 *
 * Deliberately close to the conservative starting point in
 * react-modular-architecture.md §11: the react plugin, `resolve.dedupe`, and
 * otherwise Vite's own defaults. No `optimizeDeps.exclude` for the linked
 * workspace package (§11: current Vite already treats linked ESM packages as
 * source), and no hand-tuned chunking (§11, §34.8) — the async boundary is
 * `import('@site/demoscene')` in `src/main.tsx`, not a chunk rule.
 *
 * `cssCodeSplit` stays at its default `true` (§21) so the demoscene's styles
 * ride along with its own async chunk. In this package they happen to live
 * inside the shadow root rather than in a stylesheet, so there is no
 * demoscene CSS chunk to split — but the host's config should not be the
 * reason for that.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  resolve: {
    /* §25: one React runtime. Linked workspace packages are the classic way
       to end up with two and an "Invalid hook call". */
    dedupe: ['react', 'react-dom'],
  },

  ...(mode === 'standalone'
    ? {
        /* Not part of the integration path. One self-contained IIFE for
           dropping the demoscene into a plain HTML page via <script>; React
           is not in this graph. See docs/demoscene-integration.md,
           "The non-React escape hatch". */
        build: {
          lib: {
            entry: resolve(__dirname, '../../packages/demoscene/src/createDemoscene.ts'),
            name: 'Demoscene',
            formats: ['iife'] as const,
            fileName: () => 'demoscene.global.js',
          },
          outDir: 'dist-standalone',
          sourcemap: false,
          target: 'es2020',
          emptyOutDir: true,
        },
      }
    : {
        build: { outDir: 'dist', sourcemap: true },
      }),

  server: { port: 8791, host: '127.0.0.1' },
}));
