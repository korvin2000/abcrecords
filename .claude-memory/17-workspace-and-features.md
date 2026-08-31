# 17 · The workspace & its two feature packages (2026-08-31)

> Read this **before touching the seam between the host and either feature**, or
> before moving anything in the directory tree.
>
> **Sources of truth:** [`docs/react-modular-architecture.md`](../docs/react-modular-architecture.md)
> (canonical, upstream — treat as read-only) ·
> [`docs/guestbook-integration.md`](../docs/guestbook-integration.md) ·
> [`docs/demoscene-integration.md`](../docs/demoscene-integration.md).
> If this note disagrees with those, they win and this gets fixed.

---

## 1. What changed, and why

The catalogue used to be one app in `app/`. It is now an **npm workspace** with
three React projects, so two large auxiliary applications could be added
without the catalogue absorbing them:

```text
guitar-codex-workspace/           npm workspaces: "apps/*", "packages/*"
├─ apps/guitar-codex/             the host — the ONE deployable product
├─ apps/demoscene-dev-host/       stand-in host; runs the demoscene alone
├─ packages/guestbook/            @guitar-codex/guestbook
├─ packages/demoscene/            @site/demoscene
└─ pages/ docs/ server/ .claude-memory/
```

`apps/` = deployable products · `packages/` = importable internal units.

The architecture is a **modular React monolith with lazy-loaded workspace
feature packages**: physically separate source, one React runtime, one build,
one deployment, and a dynamic `import()` between the host and each feature.
Not microfrontends — there is no independent deployment and no Module
Federation, and adding either would be a mistake until a feature genuinely has
to ship without rebuilding the host.

**The old path `app/` no longer exists.** Anything that still says `app/src/…`
is stale; it is `apps/guitar-codex/src/…`.

---

## 2. The two features at a glance

| | `@guitar-codex/guestbook` | `@site/demoscene` |
|---|---|---|
| Directory | `packages/guestbook/` | `packages/demoscene/` |
| Opened by | footer **VI · Guestbook** → `#/guestbook` | top bar **`I`** |
| Host seam | `src/components/guestbook/` | `src/components/about/` |
| Chunk | ~150 kB JS + ~14 kB CSS | ~105 kB JS, no CSS chunk |
| Style isolation | hashed CSS Modules, every rule on `.root`, no global selectors | **shadow root**, `:host{all:initial}` |
| Runtime deps | `i18next`, `react-i18next` | none |
| Talks to | the legacy PHP REST API at `/gbook/api` | nothing — everything drawn/synthesised at load |
| Renders | into the host's React tree | `null`; mounts its own element on `document.body` |
| Runs alone | `npm run dev:guestbook` (:5174) | `npm run dev:demoscene` (:8791) |

Both are `private: true`, **source-exported** (`exports` points at `src/`, no
build step, no `dist`), declare React as a *peer*, and ship the same eleven
languages the codex speaks.

---

## 3. The seam — six files, and nothing else

```text
src/components/about/                         src/components/guestbook/
  LazyAboutDemoscene.ts   ← the import()        LazyGuestbookOverlay.ts  ← the import()
  AboutDemoscene.tsx      ← the props           GuestbookOverlay.tsx     ← the codex frame
  index.ts                ← lazy entry ONLY     route.ts                 ← "guestbook"
                                                index.ts                 ← lazy entry ONLY
```

Plus four touch points in the host:

- `App.tsx` — `aboutOpen` state and the `I` button; `guestbookOpen` derived
  from the reserved hash; both overlays mounted; the body scroll lock.
- `SiteFooter.tsx` — item VI carries `slug: GUESTBOOK_SLUG` and a preload.
- `config.ts` — `FEATURES.guestbook`, `FEATURES.demoscene`, `GUESTBOOK.apiBaseUrl`.
- `styles/guestbook.css` — the `--gb-*` palette.

---

## 4. The rules (violating one of these is how this decays)

1. **Reach a feature only by package name.** `@site/demoscene`, not
   `../../packages/demoscene/src/…`. Neither `exports` map has a wildcard, so
   deep imports fail loudly — except from `apps/demoscene-dev-host`, the one
   sanctioned exception (its plate viewers).
2. **A feature never imports from the host**, and the two never import each
   other. Everything crosses as props: primitives, plain objects, stable
   callbacks. No store, no router instance, no host context.
3. **The `import()` lives in one file per feature, never in startup code.** A
   static `import` of either package from `App.tsx`, `main.tsx` or a barrel
   they read pulls the whole feature into the initial bundle **and nothing
   visibly breaks**. This is the single most damaging mistake available here,
   and it is why both barrels re-export only the lazy entry.
4. **Language is one string prop**, `locale={lang}`. The host keeps owning
   i18n. Neither feature reads `navigator.language`, the host dictionaries or
   the URL. Unknown tags fall back rather than render blank.
5. **Styles never cross.** Host CSS may set the guestbook's documented `--gb-*`
   tokens and nothing else; it cannot reach the demoscene at all, by design.
   Never write a rule against a hashed class inside a package.
6. **`#/guestbook` is reserved.** No `index.json` row may use `guestbook` as
   its slug. `App` resolves it *before* `catalog.bySlug`, so a stray row would
   sit in the grid with a route that opens the wrong thing.
7. **npm runs from the workspace root.** A second `node_modules` inside a
   package means a second React and "Invalid hook call" in every linked hook.
   `resolve.dedupe: ["react", "react-dom"]` in the host's Vite config is the
   other half of that guarantee.

---

## 5. Gotchas found while wiring this up

- **The guestbook's stylesheet loads after `index.css`, always** — it arrives
  in the feature's async chunk. So `.guestbook-skin` and the package's `.root`
  tie on specificity and *the package wins*; every host token was silently
  discarded. The fix is the selector written twice
  (`.guestbook-skin.guestbook-skin`, 0-2-0) — not `!important`, and not a
  guess about load order, because the two sheets load at different times by
  construction. See the header comment in `styles/guestbook.css`.
- **The host's `tsc -b` type-checks the feature sources.** A linked workspace
  package resolves to its real path, outside `node_modules`, so it lands in the
  host's program under the *host's* compiler options. That is why
  `resolveJsonModule` had to be added to `apps/guitar-codex/tsconfig.json` —
  the demoscene imports its eleven catalogues as `.json`. Each package still
  keeps its own `tsconfig.json`: Vite/esbuild picks the nearest one per file,
  which is what keeps e.g. `useDefineForClassFields` correct for the
  demoscene's classes.
- **`legacy-archive` cannot stand in for the guestbook's dev proxy.** It only
  answers GETs for URLs ending in a file extension; `/gbook/api/entries` is a
  POST target with no extension. Hence the explicit `server.proxy`.
- **Two soundtracks.** The demoscene brings its own `AudioContext` and score,
  so the host's ambience is muted while it is open —
  `audio.setAmbient(sound && ambient && !aboutOpen)`.
- **The body scroll lock stays single-owner in `App`.** The codex and the
  guestbook share it (`overlayOpen`). The demoscene is deliberately *not* in
  it: it locks and restores the body itself, recording whatever it finds —
  including the host's `hidden` — as the value to hand back, so the two nest
  correctly.
- **StrictMode makes the demoscene build twice in dev.** Two `AudioContext`s
  get created per open; both are `close()`d on unmount. That is expected, not
  a leak — verified below.

---

## 6. Verifying the boundary still holds

After any change to the seam, one command from the workspace root:

```bash
npm run verify        # typecheck → build → verify:boundary
```

`scripts/verify-lazy-boundary.mjs` reads `apps/guitar-codex/dist/` and asserts
four things per feature: it has an async chunk of its own; the marker string
this check greps for is actually in that chunk (otherwise the check proves
nothing — it says so and fails); the marker is **not** in anything `index.html`
loads at startup; and `index.html` does not `modulepreload` the feature chunk.
It caught its own stale marker the first time it ran, which is the point.

Measured after the integration landed: entry 221 kB (was 218 kB — the +3 kB is
host chrome, not feature code), `AboutDemoscene-*.js` 105 kB async,
`GuestbookOverlay-*.js` 150 kB + 14 kB CSS async.

The demoscene's teardown, instrumented in a live host over one open/close cycle
(the regression test its guide asks the host to keep):

```text
row-timer ticks   while open 72  ·  in the second after teardown 0
AudioContexts     2 created (StrictMode), both report state "closed"
body overflow     "" → "hidden" → ""
shadow host       absent after unmount
```

---

## 7. When to escalate (and when not to)

| Need | Step | Before that? |
|---|---|---|
| Another repo/product consumes a feature | give the package a library build, point `exports` at `./dist` | no |
| A feature must deploy without rebuilding the host | Module Federation | no |
| Non-React host, or hard isolation | the guestbook's standalone SPA in an `<iframe>` | no |

Do **not** add a `dist` build, a chunk rule, `optimizeDeps.exclude`, or a
`shared` package to make the separation "feel" more real. The separation is the
package boundary plus the `import()`; everything else is cost without benefit.
