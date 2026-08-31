# `@site/demoscene`

The encyclopedia's About/credits screen, rendered as a demoscene production
dressed in an illuminated manuscript: parchment and gilding, a rotating
wireframe lute, the melody written onto a stave as it is played, Renaissance
pencil studies drifting behind the credits, and an original baroque score
synthesised in the browser.

A **private, lazy-loaded workspace feature package** — see
[`docs/demoscene-integration.md`](../../docs/demoscene-integration.md) for how
the host mounts it, and
[`react-modular-architecture.md`](../../react-modular-architecture.md) (§n
below) for why it is shaped this way.

---

## The whole public API

```tsx
import { lazy, Suspense, useState, useCallback } from 'react';

const Demoscene = lazy(() => import('@site/demoscene'));

function About({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button onClick={() => setOpen(true)}>About</button>
      {open && (
        <Suspense fallback={null}>
          <Demoscene open locale={locale} onClose={close} />
        </Suspense>
      )}
    </>
  );
}
```

That is the intended integration in full. `open` and `locale` in, `onClose`
out. The component renders `null` — the production lives in its own shadow
root on `document.body`.

The rest of the surface (`createDemoscene` for non-React hosts, content
overrides, the i18n resolver) is in the integration guide.

**Eager-safe subpath**, for host startup code that must not pull the feature in:

```ts
import { SUPPORTED_LOCALES, isSupportedLocale } from '@site/demoscene/locales';
```

---

## What is public, and what is not

Public is exactly what `package.json#exports` names — the entry (`src/index.tsx`)
and `./locales`. There is no wildcard, so `@site/demoscene/src/render/Stage` is
not reachable and is not supported (§34.3). Everything below is free to change:

```
src/
  index.tsx                 ← public entry
  DemosceneApp.tsx          ← public: the React component
  createDemoscene.ts        ← public: the imperative mount
  types.ts                  ← public: the contract
  locales/tags.ts           ← public: the eager-safe subpath
  ─────────────────────────── everything below is private ──────────────
  i18n/index.ts             locale matching, message-pack resolution
  locales/                  one JSON message catalogue per language + the
                             transpose into DEFAULT_CONTENT
  content/defaultContent.ts re-exports DEFAULT_CONTENT from locales/
  core/
    util.ts                 canvas helpers, splines, seeded RNG
    palette.ts              colours, sine tables, plasma ramp
  audio/
    score.ts                the 40-bar score
    Chiptune.ts             five-channel tracker over Web Audio
  render/
    Stage.ts                the loop, the scenes, the governor
    assets.ts               baked bitmaps (parchment, rosette, roll, …)
    notation.ts             stave, G-clef, noteheads
    sketches.ts             the five pencil studies
    portraitData.ts         the portrait's tone map and line work, inline
    blocks.ts               the mist-condensing block text
    lute.ts                 the wireframe model
  ui/
    Dialog.ts               shadow root, controls, focus trap, teardown
    styles.ts               CSS + the corner ornament
```

---

## House rules for this package

1. **No dependency on the host.** Not its stores, not its router, not its
   contexts, not its components (§13, §27). Everything arrives as props.
2. **No runtime dependencies at all.** Zero. React is a *peer* (§8), and
   nothing else is imported. That is why the whole feature is one ~48 kB
   gzipped async chunk with no follow-up requests.
3. **No network requests, ever.** No fonts, no images, no audio files.
   Every bitmap is drawn and every sound synthesised at load — including the
   one portrait, which ships as a ~19 kB tone map and is re-drawn as pen
   hatching at bake time (§22 solved by not having assets).
4. **Every side effect is undone on unmount** (§23). The rAF loop, the 32 ms
   row timer, the `AudioContext`, the `visibilitychange` and `resize`
   listeners, the `ResizeObserver`, the close-transition timeout,
   `document.body.style.overflow` and the mount node. `Dialog.destroy()` is the
   single place this is enforced; add nothing global without adding its
   teardown there in the same commit.
5. **The catalogues hold only strings this package renders.** Host chrome —
   including the labels in a language picker — belongs to the host. There is
   deliberately no `label` field in the locale files.
6. **Shadow DOM is a documented deviation** from the §20/§38 default. See
   §10.1 of the integration guide before changing it.

---

## Adding a language

1. Copy `src/locales/ru.json` (the baseline) to `src/locales/<tag>.json` and
   translate. Keep the credit groups, names and blocks in the same order and
   the same count — translations line up by index.
2. Import and list it in `src/locales/index.ts`.
3. Add the tag to `src/locales/tags.ts`.

A dev-mode assertion warns if 2 and 3 drift apart. Nothing else in the package
needs to change.

Catalogue shape (`{ tag, ui, content }`) is the ordinary react-i18next /
FormatJS resource shape, so it reads and edits the way translators expect —
but it is plain data, not wired to i18next. A host running i18next keeps doing
so for its own copy and passes the active tag down as `locale`.

---

## Working on it

There is **no build step** — the package is source-exported (§10) and the
host's Vite build compiles it directly. From the repository root:

```bash
npm install
npm run dev          # the dev host on :8791 — a stand-in encyclopedia
npm run typecheck
npm run plates       # the pencil-study plate viewer
```

`apps/dev-host` is not part of the integration; it exists so this package can
be run and reviewed without the encyclopedia. Its language picker, its copy and
its error boundary are examples of *host* code.

---

## Controls

`Musica` / **M** music · `Textus` / **T** plain dossier · `Ab initio` / **R**
restart · `Close` / **Esc** · click the scrim.

## Accessibility

- The credits exist as real, selectable DOM (`<dl>`/`<dt>`/`<dd>`) behind the
  `Textus` toggle — that is what a screen reader gets, not the canvas.
- `role="dialog"`, `aria-modal`, `aria-label`, focus trap on Tab, focus restored
  to the invoking element on close, body scroll locked while open.
- `prefers-reduced-motion: reduce` opens straight into the plain dossier with
  the loop stopped and the music silent; both stay one click away.
- Audio never starts without a user gesture.

## Browser support

Anything with `PeriodicWave`, `Path2D`, `ellipse()` and `attachShadow` —
Chrome/Edge 63+, Firefox 63+, Safari 12+. Without `AudioContext` the visuals
run silently; without `ResizeObserver` it falls back to a `window` resize
listener.
