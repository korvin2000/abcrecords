# @guitar-codex/guestbook

Besucher-Oberfläche des ViPER Guestbook als **einbettbares React-Feature-Package**
— nachladbar, sprachgesteuert, ohne Seiteneffekte beim Import.

Dieses Verzeichnis (`frontend/`) **ist** das Package. Im Workspace der
Host-Anwendung erscheint es als `packages/guestbook`.

> **Einbinden?** → [docs/guestbook-integration.md](docs/guestbook-integration.md)
> **Warum so?** → [docs/react-modular-architecture.md](docs/react-modular-architecture.md)

---

## Auf einen Blick

```tsx
import { lazy, Suspense } from 'react';
const Guestbook = lazy(() => import('@guitar-codex/guestbook'));

<Suspense fallback={<Spinner />}>
  <Guestbook
    locale={i18n.language}          // 'de' | 'de-DE' | 'zh-Hans' | …
    theme="system"
    config={{ apiBaseUrl: '/gbook/api' }}
    onError={(error, ctx) => telemetry.capture(error, ctx)}
  />
</Suspense>
```

---

## Öffentlicher Export

Alles darunter ist private Implementierung; `package.json.exports` gibt nur `.`
frei.

```ts
import Guestbook, {                 // = GuestbookApp
  GuestbookApp,
  ApiError,
  createGuestbookApi,
  GUESTBOOK_LOCALES,
  DEFAULT_GUESTBOOK_LOCALE,
  isGuestbookLocale,
  resolveGuestbookLocale,
  GUESTBOOK_CONFIG_DEFAULTS,
} from '@guitar-codex/guestbook';

import type {
  GuestbookProps,
  GuestbookConfig,
  GuestbookLocale,
  GuestbookRouting,
  GuestbookThemeMode,
  GuestbookScrollBehavior,
  GuestbookApi,
  GuestbookEntrySubmittedEvent,
  GuestbookCommentPostedEvent,
  GuestbookErrorContext,
  GuestbookTranslations,
  GuestbookTranslationOverrides,
} from '@guitar-codex/guestbook';
```

Die vollständige Props- und Konfigurationsreferenz steht in
[docs/guestbook-integration.md](docs/guestbook-integration.md), §7–§8.

---

## Verzeichnisaufbau

```text
frontend/
├─ package.json              exports · peerDependencies · sideEffects
├─ vite.config.ts            NUR für den eigenständigen Betrieb
├─ index.html                NUR für den eigenständigen Betrieb
└─ src/
   ├─ index.ts               ◀ öffentlicher Einstieg, ohne Seiteneffekte
   ├─ types.ts               ◀ öffentlicher Vertrag (Props, Config, Events)
   ├─ GuestbookApp.tsx       Wurzelkomponente: Props → Laufzeit, i18n, Root, Fehlergrenze
   │
   ├─ api/
   │  ├─ client.ts           createHttpClient(config) · ApiError
   │  ├─ guestbookApi.ts     GuestbookApi — alle Endpunkte, injizierbar
   │  └─ types.ts            JSON-Vertrag mit der PHP-API
   │
   ├─ config/
   │  └─ defaults.ts         Standardwerte, env-Rückfall, storageKey()
   │
   ├─ i18n/
   │  ├─ locales.ts          Sprachliste + resolveGuestbookLocale() (ohne i18next)
   │  ├─ index.ts            createGuestbookI18n() · staticText()
   │  ├─ useGuestbookTranslation.ts
   │  └─ locales/*.json      11 Sprachen
   │
   ├─ runtime/
   │  ├─ context.tsx         GuestbookRuntime: config · api · idPrefix · routing · Callbacks
   │  └─ GuestbookErrorBoundary.tsx
   │
   ├─ hooks/
   │  ├─ useGuestbookLocale.ts   controlled / uncontrolled
   │  ├─ usePageState.ts         memory / url / controlled
   │  └─ useDraftStorage.ts      localStorage im Namensraum
   │
   ├─ components/            EntryList · EntryCard · EntryForm · CommentThread ·
   │                         CommentForm · BBCodeToolbar · Pagination ·
   │                         LanguageSwitcher · RichText
   ├─ styles/
   │  ├─ guestbook.module.css   CSS Module, alles an .root, Tokens --gb-*
   │  └─ index.ts               Default-Export + cx()
   ├─ utils/format.ts        Datum, Uhrzeit, Ländernamen über Intl
   │
   └─ standalone/            ◀ NICHT Teil des Packages
      ├─ main.tsx            createRoot · ?lang= · postMessage · window.ViperGuestbook
      └─ standalone.css      globale Seitenstyles (html, body, :root)
```

Die Trennlinie verläuft bei `standalone/`: alles, was ein Package nicht tun
darf — React-Root mounten, globale Listener setzen, `document` anfassen, globale
Styles laden — steht dort und nirgends sonst.

---

## Regeln für Änderungen an diesem Package

1. **Keine Seiteneffekte auf Modulebene.** Kein `init()`, kein
   `addEventListener`, kein Schreiben an `document` außerhalb einer Komponente.
2. **Keine globalen CSS-Selektoren.** `:root`, `body`, `*`, `a`, `button` sind
   im Modul-Stylesheet verboten; alles hängt an `.root`. Neue Farben werden
   `--gb-*`-Tokens.
3. **Klassennamen camelCase.** BEM-Namen überleben
   `localsConvention: 'camelCaseOnly'` in der Host-Anwendung nicht.
4. **Keine festen DOM-`id`s.** `useDomId(...)` benutzen. Ausnahme: die
   Eintragsanker, die über `config.anchorPrefix` gehen.
5. **Keine Modul-Konstanten aus `import.meta.env`.** Konfigurierbares gehört in
   `GuestbookConfig`.
6. **Kein direkter `fetch`.** Requests laufen über `useGuestbookApi()`.
7. **Texte über `useGuestbookTranslation()`**, nie über `useTranslation()` —
   sonst greift react-i18next auf die globale Instanz der Host-Anwendung zu.
8. **Jeder Effekt räumt auf.** `AbortController` für Requests, Cleanup für
   Listener.
9. **Neue öffentliche API** wird in `src/types.ts` beschrieben, in
   `src/index.ts` exportiert und in
   [docs/guestbook-integration.md](docs/guestbook-integration.md)
   dokumentiert.

---

## Eigenständig entwickeln

```bash
npm install
npm run dev         # http://localhost:5173, Proxy auf die echte API
npm run typecheck
npm run build       # dist/ — SPA für den Notbetrieb / iframe-Einbettung
```

`VITE_PROXY_TARGET` in `.env.local` stellt das Proxy-Ziel um (Standard:
`https://www.abc-guitars.com`). Siehe [.env.example](.env.example).

Der Standalone-Wirt in `src/standalone/main.tsx` ist zugleich das kleinste
vollständige Beispiel einer Host-Anwendung: er führt die Sprache selbst und
übergibt sie als `locale`-Prop.
