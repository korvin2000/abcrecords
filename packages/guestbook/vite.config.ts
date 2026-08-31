import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * Diese Konfiguration gilt AUSSCHLIESSLICH fuer den eigenstaendigen Betrieb
 * dieses Packages (`npm run dev`, `npm run build`).
 *
 * Wird das Guestbook in die Host-Anwendung eingebunden, baut deren Vite-Build
 * den Quelltext direkt mit (source-exported workspace package,
 * docs/react-modular-architecture.md, Abschnitt 10) — diese Datei wird dann
 * nicht gelesen. Was die Host-Anwendung ihrerseits konfigurieren muss (Proxy,
 * `resolve.dedupe`), steht in docs/guestbook-integration.md.
 */

const proxyPaths = [
  '/gbook/api',
  // Die API liefert absolute Asset-Pfade (Emoticons, Flaggen, Bilder), die auf
  // dem Hosting neben der Alt-Anwendung liegen. Ohne diese Eintraege wuerden sie
  // im Dev-Server auf localhost:5173 zeigen und 404 liefern.
  '/gbook/emoticons',
  '/gbook/flags',
  '/gbook/upload',
];

export default defineConfig(({ mode }) => {
  /**
   * Ziel des Entwicklungs-Proxys. Standard ist das echte Hosting, weil dort API
   * und Datenbank liegen (lokal ist kein PHP installiert) — die React-App laeuft
   * damit von Anfang an gegen echte Daten.
   *
   * Umstellbar ueber VITE_PROXY_TARGET in frontend/.env.local, z. B. auf eine
   * lokale PHP-Instanz. Gelesen wird per loadEnv statt process.env, damit die
   * Konfiguration ohne @types/node typsicher bleibt.
   */
  const env = loadEnv(mode, '.', 'VITE_');
  const proxyTarget = env.VITE_PROXY_TARGET ?? 'https://www.abc-guitars.com';

  return {
    // Relative Asset-Pfade: dadurch laeuft der Build in jedem Unterverzeichnis
    // (/gbook/app/, /gbook/, ...) ohne Neu-Build.
    base: './',

    plugins: [react()],

    resolve: {
      /*
       * Schutz gegen zwei React-Kopien, wenn dieses Package spaeter per
       * `npm link`/`file:` in eine Host-Anwendung gezogen wird. Fuer den
       * eigenstaendigen Betrieb ist es wirkungslos und kostet nichts
       * (docs/react-modular-architecture.md, Abschnitt 25).
       */
      dedupe: ['react', 'react-dom'],
    },

    server: {
      // 5173 belongs to the host app (apps/guitar-codex); the guestbook's
      // standalone mode runs beside it, not instead of it.
      port: 5174,
      proxy: Object.fromEntries(
        proxyPaths.map((path) => [
          path,
          {
            target: proxyTarget,
            changeOrigin: true,
            secure: true,
          },
        ]),
      ),
    },

    build: {
      outDir: 'dist',
      sourcemap: true,
      // Standard, aber hier ausdruecklich: das CSS des Guestbooks soll als
      // eigenes Chunk neben dem JS liegen und nicht in einem globalen
      // Stylesheet landen.
      cssCodeSplit: true,
    },
  };
});
