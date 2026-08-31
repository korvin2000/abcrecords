# Кодекс Гитаристов — the workspace

An antique-manuscript RPG-codex encyclopaedia of musicians, and the two
auxiliary React applications it composes at runtime.

Three projects, one product: **one `npm install`, one `npm run build`, one
`dist/`, one deployment.** The two auxiliary applications keep their own
source, dependencies, styles and ownership, and neither is downloaded until a
reader actually opens it.

The architecture is *a modular React monolith with lazy-loaded workspace
feature packages*, specified in
[`docs/react-modular-architecture.md`](docs/react-modular-architecture.md).

---

## Layout

```text
guitar-codex-workspace/
├─ package.json                 npm workspaces: "apps/*", "packages/*"
├─ pnpm-workspace.yaml          the same two globs, for a pnpm checkout
├─ tsconfig.base.json           shared compiler options
│
├─ apps/
│  ├─ guitar-codex/             ← THE HOST. The one deployable product.
│  └─ demoscene-dev-host/       ← a stand-in host; runs the demoscene alone
│
├─ packages/
│  ├─ guestbook/                ← @guitar-codex/guestbook
│  └─ demoscene/                ← @site/demoscene
│
├─ pages/                       catalogue content (Vite publicDir — data, never imported)
├─ server/                      counter.php — the one server-side script
├─ scripts/                     verify-lazy-boundary.mjs — the build-output guard
├─ docs/                        specifications, architecture, integration contracts
└─ .claude-memory/              condensed, indexed knowledge for fast recall
```

```text
apps/      = deployable products
packages/  = importable internal units
```

Everything under `packages/` is **private and source-exported**: no build step,
no `dist`, no registry. The host's Vite build compiles their source directly,
so cross-package edits hot-reload like any other file.

---

## The three projects

| | What it is | How it is reached | Weight |
|---|---|---|---|
| **`apps/guitar-codex`** | The catalogue: search, the grid, the four-tab codex modal, the PDF viewer, the herald, the visitor counter. Owns the shell, the router, the theme, i18n and audio. | the site | eager |
| **`packages/guestbook`** | The visitors' book: entries, pagination, comments, BBCode, captcha, image upload. Its own i18next instance, its own API layer, its own error boundary. Speaks to the legacy PHP REST API. | footer **VI · Guestbook** → `#/guestbook` | ~150 kB JS + 14 kB CSS, async |
| **`packages/demoscene`** | The About/credits production: an illuminated manuscript with a wireframe lute, a live stave, pencil studies and a baroque score synthesised in the browser. Renders into its own shadow root. Zero runtime dependencies, zero network requests. | top bar **`I`** | ~105 kB JS, async |

Both features ship the same eleven languages the codex speaks — `ru` `en` `es`
`ja` `de` `fr` `it` `pt` `uk` `zh` `ko` — and take the active one as a single
string prop, so the whole product is always in one language.

---

## Getting started

```bash
npm install
```

Once, at the root. Never inside a package: a second `node_modules` means a
second copy of React, and every hook in a linked package then throws
*"Invalid hook call"*.

| Command | What it does |
|---|---|
| `npm run dev` | the catalogue on **:5173** — the normal way to work |
| `npm run build` | the production build → `apps/guitar-codex/dist/` |
| `npm run build:fable` | the same, served from `/fable/` instead of the domain root |
| `npm run preview` | serve the built `dist/` on :4173 |
| `npm run typecheck` | every workspace, host included |
| `npm run verify` | typecheck → build → **verify the lazy boundary** (see below) |
| `npm run dev:guestbook` | the guestbook **alone**, standalone SPA on :5174 |
| `npm run dev:demoscene` | the demoscene alone, in its dev host on :8791 |
| `npm run plates` | the demoscene's pencil-study plate viewer |

`.claude/launch.json` carries the same four servers as named configurations.

### The guestbook's backend

The guestbook is the only part of the product that talks to a server it does
not ship: a PHP REST API under `/gbook/api`, with its emoticons, flags and
uploads under `/gbook/…`. In production those sit on the same origin as the
app, so the relative path is already right. In development
`apps/guitar-codex/vite.config.ts` proxies all four prefixes to
`https://www.abc-guitars.com` — override with the `GUESTBOOK_ORIGIN`
environment variable, or point the app at a different API entirely by editing
`GUESTBOOK.apiBaseUrl` in `apps/guitar-codex/src/config.ts`.

### Keeping the features lazy

The one mistake this architecture cannot survive is a **static** `import` of a
feature package from startup code. It folds the whole feature into the initial
bundle, and nothing breaks, nothing warns — the site just quietly gets 250 kB
heavier for every visitor.

```bash
npm run verify           # or: npm run verify:boundary, after a build
```

`scripts/verify-lazy-boundary.mjs` reads the built `dist/` and fails if either
feature has reached the entry chunk or is pulled forward by a `modulepreload`.
It also checks that the marker string it greps for is still inside the feature's
own chunk — a check that can go stale without saying so is worse than no check.

### Turning a feature off

`FEATURES.guestbook` and `FEATURES.demoscene` in
`apps/guitar-codex/src/config.ts`. Off removes the button (or reverts the
footer entry to an inert placeholder) *and* the chunk request — never just
hides it.

---

## How the host and the features meet

Two files, one per feature. That is the whole seam:

```text
apps/guitar-codex/src/components/about/          →  @site/demoscene
  LazyAboutDemoscene.ts    the async boundary — the only dynamic import
  AboutDemoscene.tsx       three props in, one callback out
  index.ts                 barrel; exports the lazy entry ONLY

apps/guitar-codex/src/components/guestbook/      →  @guitar-codex/guestbook
  LazyGuestbookOverlay.ts  the async boundary — the only dynamic import
  GuestbookOverlay.tsx     the codex frame; the package inside it
  route.ts                 the reserved slug "guestbook"
  index.ts                 barrel; exports the lazy entry ONLY
```

The rules that keep this from collapsing back into one tangled app are in
[`CLAUDE.md`](CLAUDE.md) → *Feature-package rules*, and the reasoning behind
each of them in `docs/`.

---

## Documentation

| Read | When |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | first — the project, its conventions, the workspace rules |
| [`docs/react-modular-architecture.md`](docs/react-modular-architecture.md) | the canonical architecture guide (upstream; treat as read-only) |
| [`docs/guestbook-integration.md`](docs/guestbook-integration.md) | the guestbook's contract: props, config, theming, routing, errors |
| [`docs/demoscene-integration.md`](docs/demoscene-integration.md) | the demoscene's contract: props, locales, teardown, anti-patterns |
| [`.claude-memory/INDEX.md`](.claude-memory/INDEX.md) | the indexed knowledge base — start here to navigate the code |
| [`apps/guitar-codex/README.md`](apps/guitar-codex/README.md) | the host app's own layer map |
| [`packages/guestbook/README.md`](packages/guestbook/README.md) · [`packages/demoscene/README.md`](packages/demoscene/README.md) | each package's internals and house rules |
