# Guestbook in eine Host-Anwendung einbinden

> Anleitung für Entwickler der Host-Anwendung (`guitar-codex` / `encyclopedia`),
> die das Gästebuch als optionales, nachladbares Feature einbinden wollen.
>
> **Architekturgrundlage:** [react-modular-architecture.md](react-modular-architecture.md) —
> *modularer React-Monolith mit lazy geladenen Workspace-Feature-Packages*.
> Dieses Dokument setzt die dortigen Regeln für das Guestbook konkret um; die
> Abschnittsnummern in Klammern verweisen dorthin.
>
> **Stand:** 2026-08-31 · **Package-Version:** 0.2.0

---

## 1. Was hier eingebunden wird

```text
┌──────────────────────────────────────────────────────────────┐
│ Host-Anwendung  (apps/encyclopedia, „guitar-codex")          │
│                                                              │
│   /                    Enzyklopädie                          │
│   /composer/:id        Enzyklopädie                          │
│   /guestbook/*  ─────── dynamic import ──────────────┐       │
│                                                      │       │
│   React-Runtime · Router · Shell · Theme · i18n      │       │
└──────────────────────────────────────────────────────┼───────┘
                                                       ▼
                              ┌────────────────────────────────┐
                              │ @guitar-codex/guestbook        │
                              │ packages/guestbook             │
                              │                                │
                              │  GuestbookApp                  │
                              │  eigene i18next-Instanz        │
                              │  eigene API-Schicht (PDO/REST) │
                              │  CSS Modules + Feature-Root    │
                              │  eigene Fehlergrenze           │
                              └────────────────┬───────────────┘
                                               │ fetch/JSON
                                               ▼
                                   PHP-REST-API  →  MySQL
```

Ein Build, ein Deployment, ein React-Baum. Das Guestbook liegt hinter einer
`import()`-Grenze und wird erst geladen, wenn jemand es öffnet (Abschnitte 15,
16).

**Was das Package mitbringt**

| | |
|---|---|
| Oberfläche | Eintragsliste, Paginierung, Eintragsformular, Kommentare, BBCode-Vorschau, Captcha, Bild-Upload |
| Sprachen | 11: `ru` (Baseline), `en`, `es`, `ja`, `de`, `fr`, `it`, `pt`, `uk`, `zh`, `ko` |
| Abhängigkeiten | `i18next`, `react-i18next` — sonst nichts. React/ReactDOM sind `peerDependencies` |
| Größe | ~14 kB CSS + JS-Chunk, beides erst beim ersten Öffnen |

**Was das Package bewusst nicht tut** (Abschnitte 23, 24, 34)

- kein eigenes `createRoot()`
- kein eigener `BrowserRouter`
- kein globales `i18next.init()`
- kein Zugriff auf `document.documentElement`, `document.title`, `body`
- keine globalen CSS-Selektoren (`:root`, `body`, `*`, `a`, `button`)
- keine `window`-Listener außerhalb des eigenen Lebenszyklus
- keine Auswertung von `navigator.language` oder der Host-URL
- kein Import aus der Host-Anwendung

Der Import des Packages hat **keine Seiteneffekte**. Alles, was ein Package
nicht tun darf, steht in `src/standalone/` und gehört nicht zum Export.

---

## 2. Voraussetzungen an die Host-Anwendung

| | |
|---|---|
| React | `^18.3` oder `^19` — genau **eine** Kopie im Bündel (Abschnitt 25) |
| Bundler | Vite (das Package wird als Quelltext mitkompiliert) |
| TypeScript | ≥ 5.4, `moduleResolution: "bundler"` |
| Typen | `vite/client` muss auflösbar sein — das Package referenziert es für die CSS-Module-Typen |
| Paketmanager | pnpm (empfohlen), npm, Yarn oder Bun mit Workspaces |

Kein Build-Schritt im Package nötig: es exportiert Quelltext, die
Host-Anwendung kompiliert mit (Abschnitt 10).

---

## 3. Package in das Host-Repository bringen

Das Guestbook lebt in einem eigenen Repository (`gbook`) zusammen mit der
PHP-API und der Alt-Anwendung. Im Host-Workspace soll es als
`packages/guestbook` erscheinen. Drei Wege, in der Reihenfolge der Empfehlung:

### 3a. Git-Subtree (empfohlen)

Behält die Historie, braucht kein zusätzliches Werkzeug beim Auschecken, und
das Ergebnis ist ein ganz normales Verzeichnis im Host-Repository.

```bash
git remote add guestbook https://<host>/gbook.git
git subtree add --prefix packages/guestbook guestbook main --squash
```

Aktualisieren, wenn im Guestbook-Repository etwas passiert ist:

```bash
git subtree pull --prefix packages/guestbook guestbook main --squash
```

> Der Subtree zieht das **ganze** Guestbook-Repository (auch `backend/` und die
> Alt-PHP-Dateien). Soll nur `frontend/` ankommen, im Guestbook-Repository
> vorher einen Branch mit `git subtree split --prefix frontend -b package-only`
> erzeugen und diesen Branch ziehen.

### 3b. Git-Submodule

```bash
git submodule add https://<host>/gbook.git vendor/gbook
```

und im Workspace auf `vendor/gbook/frontend` zeigen. Weniger Aufwand beim
Aktualisieren, aber jeder Klon braucht `git submodule update --init`, und CI
muss daran denken.

### 3c. Verzeichnis kopieren

Für einen ersten Versuch legitim: `frontend/` nach `packages/guestbook`
kopieren. Die Rückrichtung geht dann allerdings verloren — nur wählen, wenn das
Guestbook-Repository danach eingestellt wird.

---

## 4. Workspace verdrahten

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `apps/encyclopedia/package.json`

```jsonc
{
  "dependencies": {
    "@guitar-codex/guestbook": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

`workspace:*` statt einer Semver-Angabe: pnpm weigert sich dann, still ein
gleichnamiges Paket aus der Registry zu ziehen (Abschnitt 9).

Mit npm-Workspaces stattdessen `"@guitar-codex/guestbook": "*"` und im Root
`"workspaces": ["apps/*", "packages/*"]`.

### `apps/encyclopedia/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  resolve: {
    // Schutz gegen zwei React-Kopien durch verlinkte Workspace-Packages
    // (Abschnitt 25). Ohne das: "Invalid hook call".
    dedupe: ['react', 'react-dom'],
  },

  build: {
    sourcemap: true,
    // cssCodeSplit ist Standard und muss anbleiben: sonst landet das CSS des
    // Guestbooks im Start-Stylesheet (Abschnitt 21).
  },
});
```

**Nicht** hinzufügen: `optimizeDeps.exclude: ['@guitar-codex/guestbook']`.
Aktuelles Vite erkennt verlinkte ESM-Workspace-Packages von selbst als
Quelltext (Abschnitt 11).

### Prüfen, dass React nur einmal vorkommt

```bash
pnpm why react
```

---

## 5. Nachladen einbauen

### 5a. Route (der Normalfall)

React Router, Data-Router-API. Das Guestbook braucht Props (mindestens
`locale`), deshalb wird es nicht direkt als `Component` gesetzt, sondern von
einem eigenen Routenmodul umschlossen:

```tsx
// apps/encyclopedia/src/routes/guestbook.tsx  — eigenes Chunk
import { useTranslation } from 'react-i18next';
import Guestbook from '@guitar-codex/guestbook';

export default function GuestbookRoute() {
  const { i18n } = useTranslation();

  return (
    <Guestbook
      locale={i18n.language}
      theme="system"
      config={{ apiBaseUrl: '/gbook/api' }}
    />
  );
}
```

```tsx
// apps/encyclopedia/src/app/router.tsx
import { createBrowserRouter } from 'react-router';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,
    children: [
      { index: true, Component: HomePage },
      {
        path: 'guestbook',
        lazy: async () => ({ Component: (await import('../routes/guestbook')).default }),
      },
    ],
  },
]);
```

> Der statische `import Guestbook from '@guitar-codex/guestbook'` **innerhalb**
> des Routenmoduls ist richtig: das Modul selbst wird ja dynamisch geladen. Ein
> solcher Import im Startpfad (`App.tsx`, `router.tsx`) wäre der klassische
> Fehler und würde die Lazy-Grenze aushebeln (Abschnitt 34.1).

### 5b. Panel, Tab, Dialog

```tsx
import { lazy, Suspense } from 'react';

// Auf Modulebene deklarieren, nicht in der Komponente.
const Guestbook = lazy(() => import('@guitar-codex/guestbook'));

export function GuestbookPanel({ locale }: { locale: string }) {
  return (
    <Suspense fallback={<FeatureLoading />}>
      <Guestbook locale={locale} />
    </Suspense>
  );
}
```

### 5c. Optionales Vorladen bei Absicht

```tsx
const preloadGuestbook = () => void import('@guitar-codex/guestbook');

<Link to="/guestbook" onPointerEnter={preloadGuestbook} onFocus={preloadGuestbook}>
  Gästebuch
</Link>
```

Erst einbauen, wenn die gemessene Wartezeit es rechtfertigt (Abschnitt 19).

---

## 6. Sprache übergeben

Das ist die Schnittstelle, um die es beim Einbetten am häufigsten geht.

### Gesteuert — der Normalfall

Sobald `locale` gesetzt ist, ist die Host-Anwendung die einzige Quelle der
Wahrheit. Das Guestbook folgt jeder Änderung, speichert **keine** eigene Wahl
und blendet seinen eigenen Sprachumschalter aus.

```tsx
const { i18n } = useTranslation();

<Guestbook locale={i18n.language} />
```

`locale` nimmt jeden BCP-47-Bezeichner entgegen, den die Host-Anwendung ohnehin
führt — die Umrechnung passiert im Package:

| Übergeben | Wird zu | Warum |
|---|---|---|
| `"de"` | `de` | direkt unterstützt |
| `"de-DE"`, `"de_AT"`, `"DE"` | `de` | primäres Subtag, Groß-/Kleinschreibung egal |
| `"zh-Hans-CN"` | `zh` | primäres Subtag |
| `"pt-BR"` | `pt` | primäres Subtag |
| `"sv"`, `""`, `undefined` | `fallbackLocale` (Standard `ru`) | nicht unterstützt → kein Fehler, kein leerer Text |

Nicht unterstützte Sprachen werfen bewusst nicht: ein unbekanntes Sprachkürzel
ist ein Anzeigedetail und darf die Seite der Host-Anwendung nicht zerlegen.

Vorher prüfen geht auch:

```ts
import { resolveGuestbookLocale, GUESTBOOK_LOCALES } from '@guitar-codex/guestbook';

resolveGuestbookLocale('de-DE');        // 'de'
resolveGuestbookLocale('sv', 'en');     // 'en'
GUESTBOOK_LOCALES;                      // ['ru','en','es','ja','de','fr','it','pt','uk','zh','ko']
```

> Diese Helfer liegen in einem Modul ohne Laufzeitabhängigkeiten. Sie aus dem
> Startpfad zu importieren zieht trotzdem das Package-Barrel und damit das
> Guestbook-Chunk in den Startgraphen — für eine reine Vorabprüfung besser
> `await import(...)` benutzen oder die elf Kürzel in der Host-Anwendung
> hinterlegen.

### Eigener Fallback

```tsx
<Guestbook locale={i18n.language} fallbackLocale="en" />
```

Ohne Angabe ist der Rückfall `ru` — die Baseline-Sprache der Alt-Datenbank
(`SETTINGS.DEFAULTNAME`), alle anderen Sprachdateien sind Übersetzungen davon.

### Umschalter des Guestbooks weiter anzeigen

Soll der Besucher die Sprache im Gästebuch wechseln können und die
Host-Anwendung dabei mitlaufen:

```tsx
<Guestbook
  locale={i18n.language}
  onLocaleChange={(next) => void i18n.changeLanguage(next)}
/>
```

Mit `onLocaleChange` bleibt der Umschalter sichtbar; die Wahl geht an die
Host-Anwendung, die sie über `locale` zurückspielt. Erzwingen lässt sich das
über `languageSwitcher`:

| Wert | Verhalten |
|---|---|
| `"auto"` (Standard) | sichtbar, solange `locale` fehlt **oder** `onLocaleChange` gesetzt ist |
| `"always"` | immer sichtbar |
| `"never"` | nie — die Host-Anwendung hat ihren eigenen |

### Ungesteuert

Ohne `locale` verwaltet das Guestbook die Sprache selbst und merkt sie sich in
`localStorage` (`viper-guestbook.locale`). Über `config.persistLocale: false`
lässt sich das Merken abschalten.

### Einzelne Texte überschreiben

```tsx
<Guestbook
  locale={i18n.language}
  translations={{
    de: { app: { title: 'Fanpost', subtitle: 'Was Besucher uns schreiben' } },
    en: { app: { title: 'Fan mail' } },
  }}
/>
```

Wird tief über die mitgelieferten Texte gelegt; nicht genannte Schlüssel
bleiben. Die Übersetzungen werden **einmal beim Mounten** eingelesen — ein
Objektliteral, das sich bei jedem Render ändert, hätte sonst eine
Endlosschleife zur Folge. Sollen sie sich zur Laufzeit ändern, dem Guestbook
einen `key` geben.

### Wie die Sprachisolierung funktioniert

Jede Guestbook-Instanz erzeugt eine **eigene** i18next-Instanz
(`i18next.createInstance()`) im Namensraum `guestbook` und stellt sie über
`<I18nextProvider>` nur ihrem Teilbaum zur Verfügung. Daraus folgt:

- benutzt die Host-Anwendung ebenfalls i18next, bleiben beide unberührt —
  Sprache, Fallback und Namensräume kollidieren nicht;
- zwei Guestbooks auf einer Seite dürfen unterschiedliche Sprachen zeigen;
- ein Import des Packages startet **kein** i18next.

---

## 7. Props-Referenz

```ts
import type { GuestbookProps } from '@guitar-codex/guestbook';
```

| Prop | Typ | Standard | Zweck |
|---|---|---|---|
| `locale` | `string` | — | Sprache der Host-Anwendung; gesetzt = gesteuert |
| `fallbackLocale` | `GuestbookLocale` | `'ru'` | wenn `locale` fehlt/unbekannt |
| `onLocaleChange` | `(l: GuestbookLocale) => void` | — | Meldung der Sprachwahl |
| `languageSwitcher` | `'auto' \| 'always' \| 'never'` | `'auto'` | eigener Umschalter |
| `translations` | `Partial<Record<GuestbookLocale, object>>` | — | Textüberschreibungen |
| `config` | `Partial<GuestbookConfig>` | s. §8 | Laufzeitkonfiguration |
| `api` | `GuestbookApi` | — | API-Schicht komplett ersetzen (Tests, Proxy) |
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | Farbschema |
| `className` | `string` | — | zusätzliche Klasse am Wurzelelement |
| `style` | `CSSProperties` | — | u. a. um `--gb-*`-Tokens zu setzen |
| `routing` | `GuestbookRouting` | `{ mode: 'memory' }` | Seitenzahl-Verwaltung, s. §11 |
| `header` | `ReactNode \| false` | Standardkopf | eigener Kopfbereich / ausblenden ¹ |
| `headingLevel` | `1 \| 2 \| 3 \| 4` | `2` | Ebene der Überschrift im Standardkopf |
| `showEntryForm` | `boolean` | `true` | Eintragsformular anzeigen |
| `onError` | `(error, ctx) => void` | — | jeder gefangene Render-/API-Fehler |
| `onEntrySubmitted` | `({ id, moderated }) => void` | — | nach erfolgreichem Eintrag |
| `onCommentPosted` | `({ entryId, moderated }) => void` | — | nach erfolgreichem Kommentar |

¹ Ein eigener `header` **ersetzt auch den Sprachumschalter** — der gehört zum
Standardkopf. Die Host-Anwendung sollte dann `locale` steuern und, falls
gewünscht, einen eigenen Umschalter anbieten.

Der Vertrag besteht ausschließlich aus Primitiven, einfachen Objekten und
Callbacks. Store-, Router- oder Kontextobjekte der Host-Anwendung werden
absichtlich **nicht** entgegengenommen (Abschnitt 12).

### Callbacks müssen nicht memoisiert werden

Das Package legt alle Callbacks intern in eine Ref und benutzt stabile Wrapper.
Inline-Arrow-Funktionen (`onError={(e) => log(e)}`) sind unproblematisch und
lösen keine Neuladeschleife aus. Dasselbe gilt für `config` und `routing`: sie
werden feldweise verglichen, Objektliterale sind also in Ordnung.

Einzige Ausnahme: `api` und `config.fetch` werden nach Identität verglichen —
diese beiden außerhalb des Renders erzeugen oder mit `useMemo`/`useCallback`
festhalten.

---

## 8. Konfigurationsreferenz

```ts
import { GUESTBOOK_CONFIG_DEFAULTS, type GuestbookConfig } from '@guitar-codex/guestbook';
```

| Feld | Typ | Standard | Zweck |
|---|---|---|---|
| `apiBaseUrl` | `string` | `'/gbook/api'` ¹ | Basis-URL der REST-API, ohne `/` am Ende |
| `credentials` | `RequestCredentials` | `'same-origin'` | `'include'`, wenn die API auf anderer Origin läuft |
| `headers` | `Record<string,string> \| (() => …)` | — | Zusatzheader (Tracing, Mandant); als Funktion pro Request ausgewertet |
| `fetch` | `typeof fetch` | `globalThis.fetch` | eigener HTTP-Stack der Host-Anwendung |
| `pageSize` | `number` | Backend entscheidet | Einträge pro Seite |
| `storageNamespace` | `string` | `'viper-guestbook'` | Präfix aller `localStorage`-Schlüssel |
| `persistDraft` | `boolean` | `true` | Stammdaten des Besuchers 30 Tage merken |
| `persistLocale` | `boolean` | `true` | Sprachwahl merken (nur ungesteuert) |
| `scrollBehavior` | `'container' \| 'window' \| 'none'` | `'container'` | Scrollen beim Seitenwechsel |
| `anchorPrefix` | `string` | `'entry-'` | Präfix der Direktlink-Anker (`#entry-176`) |

¹ Ohne Angabe zieht das Package `VITE_GUESTBOOK_API_BASE_URL`, dann
`VITE_API_BASE_URL`, dann `/gbook/api`. In einer Host-Anwendung ist der
**explizite** Weg über `config.apiBaseUrl` vorzuziehen: die Umgebungsvariablen
gehören dann der Host-Anwendung und sind zur Bauzeit des Packages nicht bekannt.

### Beispiel: API auf anderer Origin

```tsx
<Guestbook
  locale={i18n.language}
  config={{
    apiBaseUrl: 'https://www.abc-guitars.com/gbook/api',
    // Nötig, damit das CSRF-Cookie mitgeht. Die API muss dafür CORS mit
    // Access-Control-Allow-Credentials und einer konkreten Origin liefern —
    // "*" reicht bei credentials nicht.
    credentials: 'include',
  }}
/>
```

### Beispiel: eigener HTTP-Stack

```tsx
const guestbookFetch = useMemo<typeof fetch>(
  () => (input, init) => tracedFetch(input, { ...init, headers: withTraceId(init?.headers) }),
  [],
);

<Guestbook config={{ fetch: guestbookFetch }} />
```

### Beispiel: API vollständig ersetzen (Test/Storybook)

```tsx
import type { GuestbookApi } from '@guitar-codex/guestbook';

const fakeApi: GuestbookApi = { /* … */ };

<Guestbook api={fakeApi} />
```

---

## 9. Backend, Assets und Dev-Proxy

Das Guestbook spricht ausschließlich die PHP-REST-API unter `apiBaseUrl` an
(siehe [migration-plan.md](migration-plan.md), [deployment.md](deployment.md)).
Bilder, Emoticons und Flaggen kommen als absolute Pfade **aus der API** —
typischerweise `/gbook/emoticons/…`, `/gbook/flags/…`, `/gbook/upload/…`.

Damit sie im Dev-Server der Host-Anwendung nicht ins Leere zeigen:

```ts
// apps/encyclopedia/vite.config.ts
const GUESTBOOK_PATHS = ['/gbook/api', '/gbook/emoticons', '/gbook/flags', '/gbook/upload'];

export default defineConfig({
  server: {
    proxy: Object.fromEntries(
      GUESTBOOK_PATHS.map((path) => [
        path,
        { target: 'https://www.abc-guitars.com', changeOrigin: true, secure: true },
      ]),
    ),
  },
});
```

In Produktion übernimmt das der Webserver: entweder liegt die API unter
derselben Origin (dann reicht der relative Pfad), oder es braucht CORS und
`credentials: 'include'`.

**Content-Security-Policy:** stehen API und Assets auf einer anderen Origin,
müssen `connect-src` und `img-src` diese Origin einschließen.

---

## 10. Styling und Theming

### Wie isoliert wird (Abschnitt 20)

- **CSS Modules** — alle Klassennamen werden beim Build gehasht (Tier 1).
- **Feature-Root** — jede Regel hängt an `.root`; das Wurzelelement trägt
  zusätzlich `data-guestbook="root"` als Selektor für die Host-Anwendung
  (Tier 2).
- **Keine globalen Selektoren** — `:root`, `body`, `*`, `a`, `button` kommen im
  Package nicht vor. Die frühere `body`-Regel liegt jetzt auf `.root`; der
  `box-sizing`-Reset auf `.root, .root *`.
- **Vom Server geliefertes HTML** (`gb-emoticon`, `gb-quote`, `gb-code`,
  `gb-list`, `gb-inline-image`) steht in `:global()` und wird nicht gehasht —
  diese Klassen erzeugt `backend/src/Service/BBCodeParser.php`.

Die Klassennamen sind camelCase (`entryTitle`, nicht `entry__title`). Grund:
unter `css.modules.localsConvention: 'camelCaseOnly'` — eine Einstellung, die
die Host-Anwendung treffen darf — wären BEM-Namen im JS-Export nicht mehr
auffindbar.

### Design-Tokens

Das Wurzelelement definiert diese Custom Properties. Die Host-Anwendung
überschreibt sie auf einem beliebigen Vorfahren oder per `style`:

| Token | Hell | Zweck |
|---|---|---|
| `--gb-bg` | `#f6f6f4` | Hintergrund des Guestbooks |
| `--gb-surface` | `#ffffff` | Karten, Formular |
| `--gb-surface-alt` | `#f0efec` | Zitate, Code, Eingabefelder |
| `--gb-border` | `#dcd9d2` | Rahmen und Trennlinien |
| `--gb-text` | `#1e1c1a` | Fließtext |
| `--gb-text-muted` | `#6b6660` | Metadaten, Hinweise |
| `--gb-accent` | `#8a5a2b` | Schaltflächen, Links |
| `--gb-accent-contrast` | `#ffffff` | Text auf Akzentflächen |
| `--gb-sticky` | `#b8860b` | Markierung angehefteter Einträge |
| `--gb-radius` | `10px` | Eckenradius |
| `--gb-shadow` | … | Schatten der Karten |
| `--gb-max-width` | `52rem` | Breite des Wurzelelements |
| `--gb-font-size` | `16px` | Grundschriftgröße |

```tsx
<Guestbook
  style={{
    // In das Layout der Host-Anwendung einpassen
    ['--gb-max-width' as string]: 'none',
    ['--gb-bg' as string]: 'transparent',
    ['--gb-accent' as string]: 'var(--brand-primary)',
    ['--gb-radius' as string]: 'var(--brand-radius)',
  }}
/>
```

### Farbschema

`theme` setzt `data-theme` am Wurzelelement:

| Wert | Verhalten |
|---|---|
| `'system'` (Standard) | folgt `prefers-color-scheme` |
| `'light'` / `'dark'` | erzwungen — nötig, wenn die Host-Anwendung einen eigenen Umschalter hat, von dem `prefers-color-scheme` nichts weiß |

```tsx
<Guestbook theme={hostTheme === 'dark' ? 'dark' : 'light'} />
```

### Lazy geladenes CSS

Vites CSS-Code-Splitting ist standardmäßig aktiv; das Stylesheet des Guestbooks
wird zusammen mit seinem JS-Chunk geholt (Abschnitt 21). Wichtig zu wissen:
**einmal geladenes CSS wird beim Verlassen der Route nicht wieder entfernt**
(Abschnitt 20.6). Genau deshalb ist die Scoping-Disziplin oben keine Kür.

---

## 11. Routing und History-Eigentum

Die Browser-History gehört der Host-Anwendung (Abschnitt 17). Das Guestbook
fasst sie standardmäßig nicht an.

| `routing` | Verhalten | Wann |
|---|---|---|
| `{ mode: 'memory' }` **Standard** | Seitenzahl nur im Komponentenzustand, URL bleibt unberührt | Normalfall beim Einbetten |
| `{ mode: 'memory', initialPage: 3 }` | wie oben, aber mit Startseite | Deep-Link, den die Host-Anwendung selbst aufgelöst hat |
| `{ mode: 'url', paramPrefix: 'gb' }` | `?gbPage=3` per `history.pushState` | teilbare Links, wenn der Host-Router mit fremden Query-Parametern umgehen kann |
| `{ mode: 'controlled', page, onPageChange }` | Host-Anwendung führt die Seitenzahl | volle Kontrolle, z. B. in der Route der Host-Anwendung |

Beispiel für den gesteuerten Betrieb mit React Router:

```tsx
export default function GuestbookRoute() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? '1');

  return (
    <Guestbook
      locale={i18n.language}
      routing={{
        mode: 'controlled',
        page,
        onPageChange: (next) =>
          setParams((current) => {
            const copy = new URLSearchParams(current);
            next <= 1 ? copy.delete('page') : copy.set('page', String(next));

            return copy;
          }),
      }}
    />
  );
}
```

**Kein verschachtelter `BrowserRouter`.** Das Guestbook bringt keinen Router
mit und braucht keinen.

### Direktlinks auf einzelne Einträge

Einträge tragen `id="entry-<id>"` und einen Permalink `#entry-<id>`. Kollidiert
das mit `id`s der Host-Anwendung, hilft `config.anchorPrefix: 'gb-entry-'`.
Alle übrigen DOM-`id`s des Packages stammen aus React `useId()` und sind pro
Instanz eindeutig.

---

## 12. Fehler, Telemetrie und Chunk-Skew

### Fehlergrenze

Das Package legt eine eigene Fehlergrenze um seinen Teilbaum: ein Fehler im
Guestbook zeigt dort eine übersetzte Meldung mit „Neu laden"-Schaltfläche und
reißt die Host-Anwendung **nicht** mit (Abschnitt 18). Eine zusätzliche Grenze
der Host-Anwendung ist trotzdem sinnvoll — sie fängt auch Ladefehler des
Chunks:

```tsx
<FeatureErrorBoundary name="guestbook">
  <Suspense fallback={<FeatureLoading />}>
    <Guestbook locale={locale} />
  </Suspense>
</FeatureErrorBoundary>
```

### `onError`

```tsx
<Guestbook
  locale={locale}
  onError={(error, ctx) => {
    // ctx.source: 'render' (Fehlergrenze) | 'api' (fehlgeschlagener Request)
    telemetry.captureException(error, { feature: 'guestbook', ...ctx });
  }}
/>
```

API-Fehler kommen als `ApiError` mit stabilem `code`:

```ts
import { ApiError } from '@guitar-codex/guestbook';

if (error instanceof ApiError && error.code === 'banned') { /* … */ }
```

Codes u. a.: `network_error`, `invalid_response`, `banned`, `validation_failed`,
`csrf_invalid`, `captcha_wrong`, `rate_limited`, `spam_detected`.

### Version-Skew nach einem Deployment

Ein lange offener Tab kann nach einem Deployment auf einen Chunk-Hash zeigen,
den es nicht mehr gibt (Abschnitt 30). Das trifft optionale Routen wie das
Gästebuch besonders. In der Host-Anwendung:

```ts
let reloaded = false;
window.addEventListener('vite:preloadError', (event) => {
  if (reloaded) return;            // Schleifenschutz
  reloaded = true;
  event.preventDefault();
  window.location.reload();
});
```

Dazu: HTML mit `Cache-Control: no-cache` ausliefern und alte gehashte Assets
eine Weile stehen lassen.

---

## 13. Aufräumen beim Verlassen

Das Guestbook hinterlässt beim Unmount nichts:

| | |
|---|---|
| `fetch` | jeder Request hängt an einem `AbortController` und wird im Cleanup abgebrochen |
| Listener | nur `popstate`, nur im `routing.mode: 'url'`, mit Cleanup |
| Timer/RAF | keine Dauerläufer; `requestAnimationFrame` nur einmalig zum Cursor-Setzen im BBCode-Editor |
| `document`/`body` | wird nicht angefasst |
| `localStorage` | nur unter `config.storageNamespace`, abschaltbar |
| Audio/WebGL/Fullscreen | nicht vorhanden |

Was **nicht** verschwindet, ist das geladene CSS-Chunk — das ist eine
Bundler-Eigenschaft, keine Nachlässigkeit (Abschnitt 20.6), und der Grund für
die Scoping-Regeln in §10.

---

## 14. Grenzen erzwingen

### Über `exports`

`package.json` gibt nur `.` frei. Tiefe Importe schlagen schon bei der
Auflösung fehl:

```ts
import CommentForm from '@guitar-codex/guestbook/src/components/CommentForm'; // ✗
```

### Über ESLint (Abschnitt 14)

```js
// eslint.config.js im Host-Repository
export default [
  {
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './packages',
              from: './apps',
              message: 'Feature-Packages dürfen nicht auf die Host-Anwendung zugreifen.',
            },
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@guitar-codex/guestbook/*'],
              message: 'Nur der Package-Einstieg ist öffentlich.',
            },
          ],
        },
      ],
    },
  },
];
```

### In CI

- kein statischer Import von `@guitar-codex/guestbook` im Startgraphen;
- Budget für das initiale JS;
- `pnpm why react` liefert genau eine Version.

---

## 15. Verifizieren, dass es wirklich lazy ist

```bash
pnpm --filter @guitar-codex/encyclopedia build
```

Dann im Browser (Abschnitt 31):

1. `/` in einer frischen Sitzung öffnen, Netzwerk-Tab leeren.
2. Prüfen: **kein** Guestbook-JS, **kein** Guestbook-CSS, **kein** Request an
   `/gbook/api`.
3. Nach `/guestbook` navigieren.
4. Jetzt kommen Guestbook-JS + -CSS + der erste `/gbook/api/entries`-Request.
5. Zurück und wieder hin — kein zweiter Download.
6. React-DevTools: nur ein React, keine `Invalid hook call`.
7. Host-Styles unverändert (Schriftgröße, Farben, Abstände außerhalb des
   Guestbooks).

Checkliste zum Abhaken:

- [ ] `pnpm why react` → eine Version
- [ ] `resolve.dedupe` gesetzt
- [ ] kein statischer Import im Startpfad
- [ ] Guestbook-Chunk erst bei Navigation
- [ ] Sprachwechsel der Host-Anwendung schlägt im Guestbook durch
- [ ] Sprachwechsel löst **kein** Neuladen der Eintragsliste aus
- [ ] Formular absendbar (CSRF-Cookie kommt an)
- [ ] Bilder/Emoticons/Flaggen laden
- [ ] Dunkelmodus folgt dem Umschalter der Host-Anwendung
- [ ] `label`/`htmlFor` zeigen auf Felder des Guestbooks, nicht der Host-Anwendung
- [ ] Fehlergrenze greift (testweise Fehler werfen)
- [ ] `vite:preloadError`-Behandlung vorhanden

---

## 16. Häufige Fehler

| Symptom | Ursache | Lösung |
|---|---|---|
| `Invalid hook call` | zwei React-Kopien | `resolve.dedupe: ['react','react-dom']`, `pnpm why react` |
| `Cannot find module './guestbook.module.css'` | `vite/client`-Typen fehlen | Vite-Projekt sicherstellen, `types: ["vite/client"]` in der `tsconfig` der Host-Anwendung |
| Guestbook-Chunk lädt beim Start | statischer Import im Startpfad | Import in ein lazy geladenes Routenmodul verschieben (§5a) |
| Eintragsliste lädt endlos neu | `api` oder `config.fetch` bei jedem Render neu erzeugt | außerhalb des Renders erzeugen oder `useMemo` |
| Guestbook zeigt Russisch | `locale` nicht übergeben oder Sprache nicht unterstützt | `locale` setzen, `fallbackLocale` prüfen (§6) |
| Zwei Sprachumschalter | Host-Anwendung hat einen eigenen | `languageSwitcher="never"` |
| Host-Seite ändert Schrift/Farbe | fremde globale Styles | nicht vom Guestbook: es hat keine globalen Selektoren; `data-guestbook="root"` im Inspektor prüfen |
| Formular meldet `csrf_invalid` | Cookie geht nicht mit | `credentials: 'include'` + CORS mit konkreter Origin |
| Bilder 404 im Dev-Server | Proxy fehlt | Proxy-Pfade aus §9 ergänzen |
| Zurück-Taste springt in der Host-Anwendung falsch | `routing.mode: 'url'` gegen den Host-Router | auf `'memory'` oder `'controlled'` wechseln |
| Sprachwahl im Guestbook wird nicht übernommen | `locale` gesetzt, aber `onLocaleChange` fehlt | `onLocaleChange` ergänzen (§6) |

---

## 17. Package umbenennen

Der Name `@guitar-codex/guestbook` steht an genau einer Stelle:
`packages/guestbook/package.json` → `"name"`. Nach dem Ändern:

1. Referenz in `apps/encyclopedia/package.json` anpassen,
2. Importe in der Host-Anwendung anpassen,
3. `pnpm install`.

Innerhalb des Packages gibt es keinen einzigen Selbstverweis auf den Namen.

---

## 18. Wenn später mehr Trennung nötig wird

Die Grenze ist so gebaut, dass die nächste Stufe wenig kostet (Abschnitt 42):

| Bedarf | Schritt |
|---|---|
| gebautes Artefakt statt Quelltext | Vite-Library-Build im Package, `exports` auf `./dist/index.js` zeigen; React extern halten. Die Komponente selbst ändert sich nicht. |
| eigenständiges Deployment | Module Federation. Erst dann sinnvoll, wenn das Guestbook wirklich ohne Neubau der Host-Anwendung ausgerollt werden muss (Abschnitt 36). |
| Nicht-React-Host / harte Isolation | Der eigenständige Betrieb bleibt erhalten: `frontend/` als SPA bauen und per `<iframe>` einbetten, Sprache über `?lang=` oder `postMessage` (§19). |

---

## 19. Eigenständiger Betrieb (unverändert möglich)

Das Package bleibt als eigenständige SPA lauffähig — das ist zugleich die
Entwicklungsumgebung und die Notfalllösung für Nicht-React-Hosts.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

Der Wirt dafür liegt in `src/standalone/main.tsx` und ist **nicht** Teil des
Exports. Er ist zugleich das kleinste vollständige Beispiel einer
Host-Anwendung: er führt die Sprache selbst und übergibt sie als `locale`.

Für die Einbettung per `<iframe>` bietet er zwei Wege:

```js
// 1. beim Laden
iframe.src = 'https://…/gbook/app/?lang=en';

// 2. zur Laufzeit, ohne Neuladen
iframe.contentWindow.postMessage(
  { type: 'viper-guestbook:set-language', language: 'en' },
  'https://…',
);
```

Für eine React-Host-Anwendung ist dieser Weg **nicht** gedacht — dort wird das
Package importiert und `locale` als Prop übergeben.

---

## 20. Was sich gegenüber der eigenständigen SPA geändert hat

Für alle, die den Stand davor kennen:

| Vorher | Jetzt | Grund |
|---|---|---|
| `src/main.tsx` mit `createRoot` | `src/index.ts` exportiert nur `GuestbookApp`; `createRoot` nur noch in `src/standalone/` | ein Package darf keinen React-Root mounten (Abschnitt 24) |
| globales `i18next.init()` beim Import | `createGuestbookI18n()` pro Instanz, Namensraum `guestbook`, via `<I18nextProvider>` | Import ohne Seiteneffekt; keine Kollision mit der i18n der Host-Anwendung |
| `window.addEventListener('message')` + `window.ViperGuestbook` im Modul | nur noch im Standalone-Wirt | keine globalen Listener aus einem Package |
| `import.meta.env.VITE_API_BASE_URL` als Modul-Konstante | `config.apiBaseUrl` zur Laufzeit, env nur als Rückfall | Umgebungsvariablen gehören der Host-Anwendung |
| lose API-Funktionen | `GuestbookApi`-Objekt, injizierbar | Tests, Proxy, mehrere Instanzen |
| `styles.css` mit `:root`, `body`, `*` | `styles/guestbook.module.css`, alles an `.root`, Tokens `--gb-*` | keine globalen Styles aus einem Package (Abschnitt 20) |
| BEM-Klassennamen | camelCase | robust unter jeder `localsConvention` der Host-Anwendung |
| `useQueryState` schreibt immer `history.pushState` | `routing`: `memory` (Standard) / `url` / `controlled` | die History gehört der Host-Anwendung (Abschnitt 17) |
| `window.scrollTo(0)` beim Seitenwechsel | `scrollBehavior`, Standard „Guestbook ins Bild holen" | in einer Host-Seite ist der Seitenanfang ein Ortswechsel |
| feste DOM-`id`s (`gb-name`, `gb-text`) | `useId()`-Präfix pro Instanz | Kollisionen mit der Host-Anwendung, mehrere Instanzen |
| `localStorage`-Schlüssel `gbook.*` | `config.storageNamespace` (Standard `viper-guestbook.*`) | geteilter Speicher mit der Host-Anwendung |
| `<h1>` als Titel | `headingLevel`, Standard `2` | die einzige `<h1>` gehört der Host-Anwendung |
| keine Fehlergrenze | `GuestbookErrorBoundary` + `onError` | ein Feature darf die Host-Anwendung nicht weiß werden lassen |

---

## 21. Verwandte Dokumente

- [react-modular-architecture.md](react-modular-architecture.md) — die Architektur, auf der das hier aufsetzt
- [../frontend/README.md](../frontend/README.md) — Package-Innenleben und Verzeichnisaufbau
- [visitor-features.md](visitor-features.md) — was das Gästebuch fachlich kann
- [migration-plan.md](migration-plan.md) — Zielarchitektur und REST-Endpunkte
- [deployment.md](deployment.md) — Ausrollen von API und SPA
- [database-schema.md](database-schema.md) — Tabellen der Alt-Datenbank
