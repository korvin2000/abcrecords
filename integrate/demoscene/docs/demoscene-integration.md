# Integrating `@site/demoscene` into the encyclopedia host

> **How to plug the About/credits demoscene into the main React SPA**, following
> [`react-modular-architecture.md`](../react-modular-architecture.md) — the
> canonical architecture guide. Section references below (§n) point at it.

**Status:** ready to integrate
**Package:** `@site/demoscene` — `packages/demoscene/`
**Host:** `apps/encyclopedia` (in this repo, the stand-in is `apps/dev-host`)
**Integration surface:** one lazy-loaded React component and one string prop.

---

## 1. What actually gets integrated

Only `packages/demoscene/` moves into the host repository. Everything else here
is scaffolding for developing it:

| Path | Integrated? | What it is |
|---|---|---|
| `packages/demoscene/` | **yes — this is the deliverable** | The feature package. Source-exported (§10), private, one public entry. |
| `apps/dev-host/` | no | A throwaway React app standing in for `apps/encyclopedia`. Exists so the demoscene can be run and reviewed without the encyclopedia. Its copy, its language picker and its error boundary are *host* concerns and are examples, not shipped code. |
| `apps/dev-host/src/{sketches,portraits}.ts` | no | Local plate viewers for tuning the pencil studies. They deep-import demoscene internals; see §34.3 — do not copy that. |
| `apps/dev-host` standalone build | no | A single-file IIFE for dropping the demoscene into a plain HTML page. Kept as an escape hatch (§9 below), not part of the React path. |
| `react-modular-architecture.md` | n/a | The architecture guide this document implements. |

There is no `artifact.html` and no start page in the integration. The
encyclopedia *is* the start page.

---

## 2. Install — four steps

### 2.1 Copy the package in

```text
<encyclopedia-repo>/packages/demoscene/     ← copy packages/demoscene/ here
```

Nothing inside needs editing. It carries its own `package.json`, its own
`tsconfig.json`, its own copy, and no build step (§10 — source-exported
packages; the host's Vite build compiles the source directly).

### 2.2 Make sure the workspace picks it up

`pnpm-workspace.yaml` (§7.1) — already correct if the host uses `packages/*`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

<sub>npm/Yarn/Bun hosts: the equivalent `"workspaces": ["apps/*", "packages/*"]`
in the root `package.json`. §7 is explicit that pnpm is not required.</sub>

### 2.3 Declare the dependency in the host (§9)

```jsonc
// apps/encyclopedia/package.json
{
  "dependencies": {
    "@site/demoscene": "workspace:*",
    "react": "<product-version>",
    "react-dom": "<product-version>"
  }
}
```

`workspace:*` so the package manager refuses to substitute a registry package.
On npm/Yarn/Bun use `"*"`.

The package declares React as a **peer** (`^18.3.1 || ^19.0.0`) and never
depends on it directly — §24, §25: one React runtime for the whole product.

### 2.4 Host Vite config (§11, §25)

Nothing demoscene-specific is required. Confirm only that the host has:

```ts
// apps/encyclopedia/vite.config.ts
resolve: {
  dedupe: ['react', 'react-dom'],   // §25 — linked packages are how you get two Reacts
},
```

Do **not** add `optimizeDeps.exclude: ['@site/demoscene']` (§11: current Vite
already treats linked ESM workspace packages as source), and do not hand-tune
chunking (§11, §34.8). The async boundary is the `import()`, not a chunk rule.

`build.cssCodeSplit` stays at its default `true` (§21).

---

## 3. Mount it

### 3.1 As a modal — the recommended shape

This is how the demoscene is meant to be opened: from an "About" item in the
encyclopedia's chrome, exactly as the old `artifact.html` opened it from a
button. Because it is a non-route surface, use `React.lazy()` (§15.2).

```tsx
// apps/encyclopedia/src/features/about/AboutDemoscene.tsx
import { Suspense, lazy, useCallback, useState } from 'react';
import { FeatureBoundary } from '@/lib/FeatureBoundary';
import { useLocale } from '@/app/i18n';

/* Declared at module scope, never inside the component (§15.2). */
const Demoscene = lazy(() => import('@site/demoscene'));

export function AboutDemoscene() {
  const [open, setOpen] = useState(false);
  const locale = useLocale();                    // the host's own i18n
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button onClick={() => setOpen(true)}>About this work</button>

      {open && (
        <FeatureBoundary name="demoscene" onDismiss={close}>
          <Suspense fallback={null}>
            <Demoscene open locale={locale} onClose={close} />
          </Suspense>
        </FeatureBoundary>
      )}
    </>
  );
}
```

Three details that matter:

- **`{open && …}`** — mount conditionally. The chunk is then fetched on the
  first click, and unmounting on close is what runs teardown (§7 below).
- **`fallback={null}`** — the demoscene is a full-screen overlay; a spinner
  behind nothing is worse than a beat of silence. Use a real fallback if your
  measured chunk latency warrants it.
- **`close` is `useCallback`'d** — `DemosceneApp` rebuilds when its options
  change, and a fresh inline arrow every render would rebuild it every render.

### 3.2 As a route

If the demoscene gets its own URL area (`/demo`), the routing boundary is the
cleaner loading boundary (§15.1). It has no internal router and needs none
(§17) — it is one experience, not a sub-application.

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
        path: 'demo',
        lazy: async () => {
          const { DemosceneApp } = await import('@site/demoscene');
          return { Component: DemosceneRoute };

          function DemosceneRoute() {
            const navigate = useNavigate();
            const locale = useLocale();
            return (
              <DemosceneApp
                open
                locale={locale}
                onClose={() => navigate('/')}
              />
            );
          }
        },
      },
    ],
  },
]);
```

Do **not** mount a second `<BrowserRouter>` around it (§17).

---

## 4. Passing the language

This is the one thing the host almost always needs to do, and it is one prop:

```tsx
<Demoscene open locale={locale} onClose={close} />
```

```ts
// or, without React:
createDemoscene({ locale: 'ja' });
```

Rules:

- **Any BCP-47-ish tag is safe.** `ru-RU` resolves to `ru`; `en-GB` to `en`;
  anything unmatched falls through to `fallbackLocale` (default `'en'`) and
  then to the first shipped catalogue. The demoscene never renders blank
  because of a locale it does not know.
- **Shipped languages:** `ru` (the baseline every other file translates),
  `en`, `es`, `ja`, `de`, `fr`, `it`, `pt`, `uk`, `zh`, `ko`.
- **Changing `locale` re-bakes the production.** Every piece of display type is
  a rasterised bitmap, so a language change tears the canvas assets down and
  builds them again. That is a visible reset, not a crossfade — change the
  language while the demoscene is closed where you can.
- **The host keeps owning i18n** (§26). The demoscene does not read the host's
  i18next/FormatJS instance, a context, or a store. It takes a string (§27).

### Checking support before you offer the link

Startup code must never `import '@site/demoscene'` just to ask which languages
exist — that pulls the whole feature into the initial bundle (§16, §34.1).
There is a few-byte subpath export for exactly this:

```ts
import { SUPPORTED_LOCALES, isSupportedLocale } from '@site/demoscene/locales';
```

It is a hand-maintained list, deliberately not derived from the catalogues, so
importing it costs nothing. The full entry re-exports `SUPPORTED_LOCALES` too,
for code already inside the lazy chunk.

---

## 5. The contract

Everything below is public and stable. Everything else under
`packages/demoscene/src/` is private implementation (§6) and is unreachable
anyway — the `exports` map has no wildcard.

### `default` / `DemosceneApp` — the React component

```tsx
import Demoscene from '@site/demoscene';              // default export
import { DemosceneApp } from '@site/demoscene';       // same component, named
```

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `open` | `boolean` | — | **Required.** Controlled visibility. |
| `locale` | `string` | `navigator.language` | The language to render in. |
| `fallbackLocale` | `string` | `'en'` | Used when `locale` matches nothing. |
| `content` | `Partial<DemosceneContent>` | shipped copy | Override any subset of the copy. |
| `messages` | `Record<string, Partial<DemosceneMessages>>` | `{}` | Override chrome labels per locale. |
| `autoMusic` | `boolean` | `true` | Start the score on open. Forced off under reduced motion. |
| `volume` | `number` | `0.62` | 0…1. |
| `maxDpr` | `number` | `1.6` | Device-pixel-ratio ceiling. |
| `onClose` | `() => void` | — | **User-initiated** close only. Set `open` to `false` here. |
| `onOpen` | `() => void` | — | Finished opening. Telemetry hook. |

`onClose` never fires on unmount and never fires because the host set `open`
itself, so a controlled parent cannot feed itself back a change — this is what
makes the component safe under `StrictMode`, which mounts, unmounts and
remounts every effect in development.

The component **renders `null`**. It costs nothing in the host's tree.

### Other exports

```ts
import {
  createDemoscene,      // (opts) => DemosceneHandle — the non-React mount
  autoWire,             // wire every [data-demoscene] element; standalone builds
  DEFAULT_CONTENT,      // the shipped copy, for partial overrides
  BUILTIN_MESSAGES,     // the shipped chrome labels
  matchLocale, pick, resolveContent, detectLocale,   // the tiny i18n resolver
  SUPPORTED_LOCALES,
} from '@site/demoscene';

import type {
  DemosceneProps, DemosceneOptions, DemosceneContent, DemosceneMessages,
  DemosceneHandle, CreditGroup, LocalizedText, ResolvedContent,
} from '@site/demoscene';
```

### Overriding the copy

Every field is `string | Record<locale, string>`, and `content` is merged over
the defaults, so you can replace one field and keep the rest:

```tsx
<Demoscene
  open
  locale={locale}
  content={{
    edition: { en: 'Second edition · MMXXVII', ru: 'Издание второе · MMXXVII' },
  }}
  onClose={close}
/>
```

Memoise `content` and `messages` (`useMemo`) or accept that the demoscene
rebuilds whenever the object identity changes.

### Adding a language

Drop one `<tag>.json` into `packages/demoscene/src/locales/` in the same shape
as `ru.json` (the baseline), list it in `locales/index.ts`, and add the tag to
`locales/tags.ts`. Nothing else changes. A dev-mode assertion warns if
`tags.ts` and the shipped catalogues drift apart.

The catalogues contain **only strings the demoscene itself renders**. Copy that
belongs to whatever page launches it — headings, button labels, the option
labels in a language picker — is the host's, and must not be added there: the
host would be paying for its own copy inside the lazy feature chunk, in a place
its translators never look.

---

## 6. Ownership (§26)

| The host owns | The demoscene owns |
|---|---|
| Router, history, the URL for `/demo` | The production: canvas, scenes, score |
| The application shell and global nav | Its own overlay, focus trap and Esc handling while open |
| Auth, session, permissions | The `AudioContext` and everything scheduled on it |
| Global theme and document baseline CSS | Its own styles, entirely inside its shadow root |
| The product's i18n; deciding the active `locale` | Its eleven catalogues and the resolver over them |
| Telemetry, the error boundary around the feature | Teardown of every side effect it created |
| Whether the demoscene is offered at all | Nothing about when it is offered |

---

## 7. Teardown — what you get for free (§23)

Unmounting the component (or calling `handle.destroy()`) releases **everything**:

- the `requestAnimationFrame` loop — cancelled;
- the 32 ms row timer — `clearInterval`;
- the `AudioContext` — `close()`d, not merely suspended;
- the `visibilitychange` listener on `document` — removed;
- the `resize` listener on `window` (the `ResizeObserver` fallback) — removed;
- the `ResizeObserver` — disconnected;
- the 400 ms close-transition `setTimeout` — cleared;
- `document.body.style.overflow` — restored to its previous value;
- focus — returned to the element that opened it;
- the shadow host — removed from `document.body`.

There is nothing for the host to clean up, and *"the music kept playing after I
went back to the encyclopedia"* cannot happen.

The same holds across a **locale swap while open**: `update({ locale })` closes
and rebuilds rather than rebuilding underneath itself, so the body scroll lock
is handed back and re-taken rather than being recorded as the host's own value
and stranded.

Verified in this repo against a live host, by instrumenting `setInterval` and
`AudioContext` around an open/close cycle:

```text
row-timer ticks   idle 0  ·  while open 16  ·  after teardown 0
AudioContexts     every context ever created reports state "closed"
body overflow     "" → "hidden" → (de → uk → ko swaps, still "hidden") → ""
mount node        absent after unmount
```

Keep that as a regression test in the host (§32.5).

---

## 8. Verifying the lazy boundary (§31)

The point of all of this is that the encyclopedia does not pay for the
demoscene at startup. Check it, and keep checking it:

**By hand.** Open the Network panel, load the host, and confirm nothing of the
demoscene is on the wire. Then click About and watch the chunk arrive.

**In the production build.** From this repo's dev host, `npm run build` gives:

```text
assets/index-<hash>.js   147 kB │ gzip 48.3 kB   eager: React + host
assets/index-<hash>.js   106 kB │ gzip 47.5 kB   async: the whole demoscene
```

and the entry HTML references the async chunk only from an `import()` — there
is no `<link rel="modulepreload">` pulling it forward.

**As a CI guard (§31).** Assert that the host's entry chunk contains no
demoscene marker (a distinctive private symbol works), or that the entry HTML
does not preload the demoscene chunk. This catches the single most damaging
mistake anyone can make here — §34.1, a static `import` of the feature from
startup code, which silently un-does the architecture with no visible symptom.

---

## 9. The non-React escape hatch

For a page that is not a React tree at all, the same production is available
imperatively — this is the shape the old `artifact.html` used:

```ts
import { createDemoscene } from '@site/demoscene';

const demo = createDemoscene({ locale: 'en' });
button.addEventListener('click', () => demo.open());
demo.update({ locale: 'ru' });     // the host's language changed
demo.destroy();                    // nothing else releases the AudioContext
```

Or, from the standalone IIFE build (`npm run build:standalone` in the dev host):

```html
<script src="demoscene.global.js"></script>
<button data-demoscene>About</button>
<script>Demoscene.autoWire({ locale: 'en' });</script>
```

**A React host should not use either.** With `DemosceneApp`, React owns the
lifetime and teardown is automatic; with `createDemoscene`, `destroy()` is
yours to remember, and forgetting it leaks an `AudioContext`.

---

## 10. Two documented deviations from the guide

Both are deliberate. Read them before "fixing" them.

### 10.1 Shadow DOM instead of CSS Modules (§20 Tier 4, §38)

§38 says not to reach for Shadow DOM by default, and it is right: it
complicates inherited styles, host design tokens, portals and third-party UI
libraries. This package uses it anyway, and the escalation is justified:

- it is a **full-screen overlay with a completely foreign visual language** —
  parchment, gilding, a serif stack — that must not inherit the encyclopedia's
  tokens, and whose own `:host{all:initial}` reset must not escape;
- it renders **no host components** and mounts **no third-party UI**, so the
  costs §38 lists do not apply to it;
- the accessibility surface it needs — `role="dialog"`, `aria-modal`, a focus
  trap, focus restoration — it implements itself, inside the root.

Consequences for the host worth knowing: host CSS cannot restyle the
demoscene (by design), and `document.querySelector` will not find its
internals. The shadow host is tagged `[data-feature="demoscene"]` if you need
to find the root itself.

### 10.2 It renders outside the host's React subtree

The component returns `null` and mounts its own element on `document.body` —
the standard modal/portal arrangement. This is **not** the §24 violation: there
is no second `createRoot`, no second React runtime, and no second render tree.
React still owns when the feature exists; it just does not own its DOM.
Everything crossing the boundary is props and callbacks (§27).

---

## 11. Anti-patterns, specific to this package

| Don't | Why |
|---|---|
| `import Demoscene from '@site/demoscene'` in startup code | §34.1 — the single most damaging mistake here. It puts the renderer, the score and eleven catalogues in the initial bundle, and nothing visibly breaks. |
| `import … from '@site/demoscene/src/render/Stage'` | §34.3 — private implementation; the `exports` map blocks it. The dev-host plate viewers do it and are the one sanctioned exception. |
| Import `SUPPORTED_LOCALES` from the main entry in eager code | Use `@site/demoscene/locales` (§4 above). Same value, a few bytes. |
| Render `<Demoscene open={false} />` permanently mounted | The chunk loads at first render, not at first open. Gate on `{open && …}`. |
| Pass the host's i18n instance, store or router | §12, §27 — pass the resolved tag as a string. |
| Add host page copy to `src/locales/*.json` | Host chrome belongs to the host; see §5 above. |
| Add a `dist` build to the package to make it feel "more separate" | §10 — explicitly warned against. Escalate only for the reasons in §42.2. |
| Wrap it in a second `<BrowserRouter>` | §17. |
| Autoplay the score without a user gesture | §22 — and browsers will refuse anyway. `autoMusic` only takes effect on an open the user initiated. |

---

## 12. If requirements change later (§42)

- **Another repo or product needs it** → give the package a library build and
  switch `exports` to `./dist` (§42.2). Not before.
- **It must deploy independently** → that, and only that, is when Module
  Federation becomes the right answer (§36, §42.3). Today it is one product,
  one build, one deployment.

---

## 13. Checklist

Against §46, for this integration specifically:

- [x] The demoscene is a private workspace package (`private: true`, no registry publish).
- [x] It exposes one minimal public API; no wildcard in `exports`.
- [x] The host owns the shell and top-level history; the demoscene has no router.
- [x] It is loaded through a dynamic import — `React.lazy()` for the modal shape, route `lazy` for the route shape.
- [ ] **Host to confirm:** no startup code statically imports it (add the §31 CI guard).
- [x] It imports nothing from the host.
- [x] It depends on no other feature package.
- [x] React/ReactDOM are peer dependencies; `resolve.dedupe` is set host-side.
- [x] Styles are fully contained; no global resets escape (documented deviation, §10.1).
- [x] Assets, fonts and audio are inside the lazy graph — in fact there are none: every bitmap is drawn and every sound synthesised at load, so there is not one network request after the chunk.
- [x] Every global side effect is undone on unmount, with evidence (§7).
- [x] Vite's default code splitting; no custom chunk rules.
- [ ] **Host to confirm:** production bundle behaviour verified in CI (§31), and a dynamic-import failure path exists (§30 — the error boundary in §3.1 is the recovery point).
