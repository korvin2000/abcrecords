# Modular React Architecture: Lazy-Loaded Workspace Feature Apps

> **Canonical architecture guide** for integrating auxiliary React applications into a large React SPA while keeping their source code, dependencies, styles, assets, and ownership boundaries separate — without independently deploying them and without loading them on initial startup.

**Status:** Recommended architecture  
**Verified:** 2026-08-31  
**Target:** Modern React SPA, Vite, React Router, pnpm/npm/Yarn/Bun workspaces  
**Concrete use case:** Encyclopedia host SPA + optional `guestbook` + visually independent `demoscene`/demo application

---

## 1. Executive Decision

Use a **modular React monolith with lazy-loaded private workspace feature packages**.

The main encyclopedia application, Guestbook, Demoscene, and future auxiliary applications remain physically separated as independent packages/directories, but they:

- use one compatible React/ReactDOM runtime;
- are composed into one React product;
- are built by one host Vite build;
- are released as one deployment;
- are loaded through route-level or component-level dynamic imports;
- keep feature-specific JavaScript, CSS, media, and heavy dependencies outside the initial loading path where possible;
- communicate through narrow public contracts instead of importing host internals.

The architecture is:

```text
physical separation       workspace packages
architectural separation  package public APIs + lint rules
loading separation        dynamic import / route lazy
bundle separation         Vite async chunks
style separation          CSS Modules + feature root scope
runtime integration       one React tree
deployment simplicity     one build / one dist
```

A concise description:

> **One product and one deployment, composed from multiple physically separated React feature packages that are loaded only when their routes/features are used.**

This borrows useful microfrontend principles — ownership, explicit boundaries, lazy composition — but is more accurately described as a **modular frontend monolith**, **workspace-based feature apps**, or **code-split feature packages** because independent runtime deployment is not required.

---

## 2. Why This Architecture Fits the Use Case

Assume the product contains:

- a large encyclopedia SPA;
- a Guestbook, also written in React;
- a Demoscene/Demo React feature with its own music, graphics, assets, effects, fonts, and visual language;
- potentially more optional feature applications later.

The actual requirements are:

| Requirement | Recommended mechanism |
|---|---|
| Keep auxiliary source physically separate | Workspace packages |
| Avoid mixing components with host source | Package boundaries |
| Avoid loading feature code at startup | Dynamic `import()` / route lazy loading |
| Keep generated code mostly separate | Vite async chunk boundaries |
| Lazy-load feature CSS | Vite CSS code splitting |
| Prevent CSS collisions | CSS Modules + root namespace / `@scope` |
| Keep feature dependencies local | Per-package `package.json` |
| Avoid deep coupling | `exports` + lint/import restrictions |
| Share auth/navigation/theme when needed | Small host→feature contract |
| Preserve ordinary React development | One React tree and dev server |
| Build everything together | One root/host Vite build |
| Avoid unnecessary infrastructure | No Federation/single-spa unless requirements change |

These requirements do **not** require distributed microfrontend infrastructure.

---

## 3. Terminology

| Term | Meaning here | Fit |
|---|---|---|
| **Modular frontend monolith / modulith** | Physically separate source packages, one integrated build/release | **Best description** |
| **Lazy-loaded feature package** | Workspace package loaded behind a dynamic import boundary | **Guestbook / Demoscene** |
| **Internal/source package** | Private package exporting source rather than published `dist` | **Recommended** |
| **Microfrontend** | Broad architectural family emphasizing independent frontend units; commonly associated with independent delivery/runtime composition | Related concept, but stronger than needed |
| **Module Federation** | Runtime composition of separately built remotes with shared dependency negotiation | Not needed now |
| **single-spa** | Runtime orchestration of independently mounted/unmounted applications | Not needed now |
| **Shadow DOM/Web Component** | DOM/CSS isolation boundary | Escalation option only |
| **iframe** | Independent document/runtime boundary | Too isolated for normal same-product integration |

Terminology is less important than the architectural invariant:

```text
separate source ownership
+ explicit public API
+ lazy load boundary
+ scoped styles
+ one product runtime/build
```

---

## 4. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Encyclopedia Product                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Host React SPA                                        │  │
│  │                                                       │  │
│  │ /                    encyclopedia                     │  │
│  │ /composers           encyclopedia                     │  │
│  │ /search              encyclopedia                     │  │
│  │                                                       │  │
│  │ /guestbook/* ───────────── dynamic import ─────────┐  │  │
│  │ /demo/*      ───────────── dynamic import ──────┐  │  │  │
│  └────────────────────────────────────────────────┼──┼──┘  │
│                                                   │  │     │
│                                          ┌────────▼┐ ┌▼──────────┐
│                                          │Demoscene│ │ Guestbook │
│                                          │ package │ │ package   │
│                                          └─────────┘ └───────────┘
│                                                             │
│                      shared React runtime                   │
│                  optional shared contracts/UI               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                         one Vite build
                              │
                              ▼
dist/
├─ index.html
├─ main-[hash].js
├─ shared-[hash].js                 # optional/common dependencies
├─ guestbook-[hash].js              # async
├─ guestbook-[hash].css             # async
├─ demoscene-[hash].js              # async
├─ demoscene-[hash].css             # async
└─ assets/...
```

Important nuance: a dynamic import creates an **asynchronous feature boundary**, but the bundler remains free to factor truly shared dependencies into common chunks. The architectural goal is not hermetically sealed output files; it is to keep **feature-specific implementation and heavy dependencies off the initial path**.

---

## 5. Recommended Repository Structure

```text
repo/
├─ package.json
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
├─ tsconfig.base.json
├─ eslint.config.js
│
├─ apps/
│  └─ encyclopedia/
│     ├─ package.json
│     ├─ vite.config.ts
│     ├─ tsconfig.json
│     ├─ index.html
│     └─ src/
│        ├─ main.tsx
│        ├─ app/
│        │  ├─ router.tsx
│        │  ├─ providers.tsx
│        │  └─ AppShell.tsx
│        ├─ pages/
│        ├─ features/                # encyclopedia-native features only
│        └─ lib/
│           └─ FeatureBoundary.tsx
│
├─ packages/
│  ├─ guestbook/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ README.md
│  │  └─ src/
│  │     ├─ index.tsx               # public entry only
│  │     ├─ types.ts
│  │     ├─ GuestbookApp.tsx
│  │     ├─ components/
│  │     ├─ api/
│  │     ├─ hooks/
│  │     ├─ state/
│  │     ├─ styles/
│  │     └─ tests/
│  │
│  ├─ demoscene/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ README.md
│  │  └─ src/
│  │     ├─ index.tsx
│  │     ├─ DemosceneApp.tsx
│  │     ├─ components/
│  │     ├─ audio/
│  │     ├─ effects/
│  │     ├─ assets/
│  │     ├─ styles/
│  │     │  ├─ DemosceneApp.module.css
│  │     │  └─ scoped.css
│  │     └─ tests/
│  │
│  ├─ shared-ui/                    # optional; create only after real reuse appears
│  ├─ app-contracts/                # optional stable public cross-boundary types
│  └─ shared-utils/                 # optional stable framework-agnostic utilities
│
└─ docs/
   └─ architecture.md
```

Rule of thumb:

```text
apps/      = deployable products
packages/  = importable internal units
```

For the present scenario there is exactly one deployable application: `apps/encyclopedia`.

Do not create large generic `shared` packages on day one. Shared packages should appear only when duplication is real and the abstraction is stable.

---

## 6. Package Boundary = Architectural Boundary

A folder is mostly a convention. A package gives you:

- its own dependency declaration;
- a public API;
- controlled exports;
- clear ownership;
- independent tests;
- lintable dependency direction;
- easier removal/extraction later.

The host should consume:

```text
@site/guestbook
@site/demoscene
```

not arbitrary paths such as:

```text
../../packages/guestbook/src/components/forms/CommentForm
```

The intended model:

```text
                    public API
                        │
                        ▼
Host ─────────────► @site/guestbook
                        │
            ┌───────────┴───────────┐
            │ private implementation │
            │ components             │
            │ state                  │
            │ API                    │
            │ styles                 │
            │ tests                  │
            └────────────────────────┘
```

---

## 7. Workspace Setup

### 7.1 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 7.2 Root `package.json`

```jsonc
{
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @site/encyclopedia dev",
    "build": "pnpm --filter @site/encyclopedia build",
    "test": "pnpm -r test",
    "lint": "eslint ."
  }
}
```

### Why `pnpm`

pnpm is not required. npm, Yarn, Bun, or another workspace-capable package manager can implement the same architecture.

pnpm is a particularly strong fit because:

- `workspace:*` explicitly requires a local workspace package;
- undeclared dependency mistakes are easier to expose than in heavily hoisted layouts;
- one lockfile covers the whole product;
- packages remain visually and dependency-wise distinct.

---

## 8. Feature Package Manifest

Example:

```jsonc
{
  "name": "@site/guestbook",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.tsx"
  },
  "peerDependencies": {
    "react": "<match-host-range>",
    "react-dom": "<match-host-range>"
  },
  "dependencies": {
    // guestbook-only runtime dependencies
  }
}
```

For package-local tests/tooling, React can also be available through root tooling or an appropriate development dependency setup. The key runtime rule is: **do not intentionally bundle a second independent React runtime into a feature**.

Important properties:

- `"private": true` — package is not meant for registry publication.
- `exports["."]` — exposes one deliberate entry point.
- React/ReactDOM compatibility is explicit.
- Feature-only dependencies remain owned by that feature.
- No separate package build is required.

---

## 9. Host Package Dependencies

```jsonc
{
  "dependencies": {
    "@site/guestbook": "workspace:*",
    "@site/demoscene": "workspace:*",
    "react": "<product-version>",
    "react-dom": "<product-version>"
  }
}
```

`workspace:*` is preferable to an ordinary semver reference when the package must resolve locally: pnpm will refuse to silently substitute a registry package.

---

## 10. Source-Exported Packages vs Prebuilt Packages

### Recommended now: source-exported packages

```json
{
  "exports": {
    ".": "./src/index.tsx"
  }
}
```

The host Vite build compiles the feature source directly.

Advantages:

- no feature build step;
- normal cross-package HMR;
- one source map/debugging pipeline;
- host bundler can optimize the complete module graph;
- simple TypeScript navigation/refactoring;
- no generated `dist` synchronization during development.

Trade-off:

- these packages are internal implementation units, not ready-to-publish npm libraries.

### When to use prebuilt packages

Move a feature to a `dist`-exporting library build only when one of these becomes true:

- another repository/product must consume it;
- it must be independently versioned;
- it must have an independent build artifact;
- independent deployment is becoming necessary.

Do not add a library build merely to make an internal workspace package feel "more separate".

---

## 11. Vite Configuration

A conservative starting point:

```ts
// apps/encyclopedia/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  resolve: {
    // Defensive when linked/hoisted packages could otherwise resolve
    // multiple copies of runtime-singleton dependencies.
    dedupe: ["react", "react-dom"],
  },

  build: {
    sourcemap: true,
    // Keep Vite's normal code-splitting behavior initially.
    // Do not hand-tune chunking before measuring the production output.
  },
});
```

### Important current Vite note

Do **not** add this by default:

```ts
optimizeDeps: {
  exclude: ["@site/guestbook", "@site/demoscene"]
}
```

Current Vite automatically detects linked monorepo dependencies that resolve outside `node_modules` and treats ESM-compatible linked packages as source code. `optimizeDeps.include/exclude` should be used only when Vite's default dependency discovery produces a concrete problem.

Likewise, avoid premature low-level chunk configuration. Current Vite exposes Rolldown-based build customization through `build.rolldownOptions`; older `build.rollupOptions` terminology is deprecated/aliased in current documentation.

Architecture should depend on **dynamic import boundaries**, not hand-authored output filenames or custom chunk rules.

---

## 12. Public Feature Contract

A feature should expose a small, stable integration surface.

Example:

```ts
// packages/guestbook/src/types.ts
export interface GuestbookProps {
  basePath: string;
  user?: {
    id: string;
    name: string;
  } | null;

  locale?: string;
  theme?: "light" | "dark";
  onNavigate?: (path: string) => void;
}
```

```tsx
// packages/guestbook/src/index.tsx
export type { GuestbookProps } from "./types";
export { default } from "./GuestbookApp";
```

```tsx
// packages/guestbook/src/GuestbookApp.tsx
import type { GuestbookProps } from "./types";
import styles from "./styles/GuestbookApp.module.css";

export default function GuestbookApp({
  basePath,
  user,
  locale,
  theme = "light",
  onNavigate,
}: GuestbookProps) {
  return (
    <section className={styles.root} data-theme={theme}>
      {/* Guestbook implementation */}
    </section>
  );
}
```

### Contract rules

Prefer:

- primitives;
- plain serializable objects;
- stable callbacks;
- small capability interfaces;
- explicit types.

Avoid passing:

- host Redux/Zustand/Pinia-like stores directly;
- router instances;
- random host contexts;
- internal service containers;
- private components;
- mutable host implementation objects.

The host may provide capabilities. The feature should not know where they come from.

---

## 13. Dependency Direction

Recommended:

```text
host ─────────► guestbook
  │
  ├───────────► demoscene
  │
  └───────────► shared packages (optional)

guestbook ────► shared packages (optional)
demoscene ────► shared packages (optional)
```

Forbidden:

```text
guestbook ────► host internals
demoscene ────► host internals

guestbook ◄──► demoscene
```

The central rule is:

> **Features may depend on stable shared abstractions, but they must not reach back into private host implementation.**

This prevents the modular architecture from slowly collapsing back into an entangled monolith.

---

## 14. Enforce the Boundary

Example with `eslint-plugin-import`:

```js
// eslint.config.js
export default [
  {
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./packages",
              from: "./apps",
              message: "Feature packages must not import application internals.",
            },
            {
              target: "./packages/guestbook",
              from: "./packages/demoscene",
              message: "Feature packages must not depend on each other.",
            },
            {
              target: "./packages/demoscene",
              from: "./packages/guestbook",
              message: "Feature packages must not depend on each other.",
            },
          ],
        },
      ],
    },
  },
];
```

Exact rule syntax depends on the ESLint/plugin version and repository paths; the policy matters more than this literal example.

Also enforce package exports so deep imports fail naturally.

---

## 15. Lazy Loading: Preferred Strategy

### 15.1 Whole feature application → route-level lazy loading

If Guestbook and Demoscene correspond to URL areas, the routing boundary is usually the cleanest loading boundary.

With React Router data/router APIs:

```tsx
import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "guestbook/*",
        lazy: async () => {
          const mod = await import("@site/guestbook");
          return { Component: mod.default };
        },
      },
      {
        path: "demo/*",
        lazy: async () => {
          const mod = await import("@site/demoscene");
          return { Component: mod.default };
        },
      },
    ],
  },
]);
```

Benefits:

- the route itself expresses the ownership/load boundary;
- code is fetched only when navigation needs it;
- route-level error/data APIs remain available;
- fewer scattered `React.lazy()` declarations.

Modern React Router also supports automatic route code splitting in Framework Mode. If the project already uses that mode, prefer its native route-module conventions rather than duplicating code-splitting logic manually.

### 15.2 Generic component-level lazy loading

For a feature opened as a modal, tab, drawer, or other non-route surface:

```tsx
import { lazy, Suspense } from "react";

const Guestbook = lazy(() => import("@site/guestbook"));

export function GuestbookPanel() {
  return (
    <Suspense fallback={<FeatureLoading />}>
      <Guestbook basePath="/guestbook" />
    </Suspense>
  );
}
```

React calls the `lazy()` loader when the component is first rendered and caches the promise/result.

Declare lazy components at module scope, not inside component functions.

### Practical rule

```text
whole sub-application / page  → route lazy
modal / tab / optional panel  → React.lazy()
```

---

## 16. Static Import vs Dynamic Import

Static import:

```ts
import Guestbook from "@site/guestbook";
```

Conceptually:

```text
main
└─ guestbook
   └─ guestbook dependencies
```

The feature participates in the eager module graph.

Dynamic import:

```ts
const mod = await import("@site/guestbook");
```

Conceptually:

```text
main
└─ dynamic import
   └─ async feature boundary
      └─ guestbook
```

This is the mechanism that satisfies the key requirement:

> **Guestbook and Demoscene must not be downloaded/executed as part of normal encyclopedia startup merely because they exist in the repository.**

Caveat: shared dependencies can still be factored into shared/eager chunks if they are also needed elsewhere. That is usually desirable.

---

## 17. Routing Ownership

The host owns the top-level URL namespace:

```text
/                         encyclopedia
/composer/:id             encyclopedia
/search                   encyclopedia

/guestbook/*              guestbook
/demo/*                   demoscene
```

Two reasonable models exist.

### Model A — host owns every feature route

Good for very small features:

```text
/guestbook
/guestbook/new
/guestbook/entry/:id
```

All route definitions remain in the host.

### Model B — host owns only the prefix

Good for a meaningful sub-application:

```text
Host:
  /guestbook/*

Guestbook:
  index
  new
  entry/:id
```

The Guestbook can render relative nested `<Routes>` beneath the host router.

### Do not mount another BrowserRouter

Do not do:

```tsx
<BrowserRouter>
  <Guestbook />
</BrowserRouter>
```

inside a host that already owns browser history.

Use the existing router/history and relative routes. Multiple independent browser routers inside one integrated React product introduce duplicated history ownership and confusing navigation behavior.

Demoscene probably does not need an internal router if it is one experience with a few panels; local state is simpler.

---

## 18. Loading and Error Boundaries

A lazy feature is also a network/code-loading failure boundary.

Provide:

- loading UI;
- feature-local error handling;
- graceful recovery;
- host protection against a feature crash.

Generic component example:

```tsx
<FeatureErrorBoundary name="guestbook">
  <Suspense fallback={<FeatureLoading />}>
    <Guestbook />
  </Suspense>
</FeatureErrorBoundary>
```

React `lazy()` propagates a rejected load promise to the nearest Error Boundary.

For React Router data/framework modes, route-level `ErrorBoundary`/`errorElement` is often cleaner.

The Demoscene should never be able to white-screen the encyclopedia because one optional chunk, WebGL effect, audio initialization, or third-party dependency failed.

---

## 19. Optional Preloading / Prefetching

Lazy loading minimizes initial cost but moves download latency to first navigation.

Use **intent-based preload** only if useful:

```tsx
const preloadDemoscene = () => {
  void import("@site/demoscene");
};

<Link
  to="/demo"
  onPointerEnter={preloadDemoscene}
  onFocus={preloadDemoscene}
>
  Demoscene
</Link>
```

Possible triggers:

- pointer hover/focus;
- when a likely next destination becomes visible;
- after the main application becomes idle;
- explicit user intent.

Policy:

> **Lazy by default; preload only when measured navigation latency justifies it.**

Do not automatically prefetch a large Demoscene with music, textures, WebGL libraries, and fonts if most users never open it.

React Router Framework Mode already includes route discovery/code-splitting optimizations; manual preloading should complement rather than fight framework behavior.

---

## 20. CSS Isolation Strategy

Code splitting and CSS isolation solve different problems.

Recommended escalation:

```text
Tier 1  CSS Modules
Tier 2  feature root namespace + local CSS variables
Tier 3  @scope for element/global-ish rules
Tier 4  Shadow DOM only if hard isolation is really needed
Tier 5  iframe only for document-level isolation
```

### 20.1 Tier 1 — CSS Modules

Default for ordinary feature/component styles.

```tsx
import styles from "./Guestbook.module.css";

export function Guestbook() {
  return <section className={styles.root}>...</section>;
}
```

```css
/* Guestbook.module.css */
.root {}
.title {}
.button {}
```

This prevents the most common class-name collisions.

### 20.2 Tier 2 — dedicated feature root

Give every feature an explicit root boundary:

```tsx
<section className={styles.root} data-feature="demoscene">
  <DemoExperience />
</section>
```

Keep theme variables local:

```css
.root {
  --demo-background: #050508;
  --demo-foreground: #ededf8;
  --demo-accent: #cf38ff;
  --demo-font-ui: "Demo UI", sans-serif;

  color: var(--demo-foreground);
  background: var(--demo-background);
}
```

### 20.3 CSS Modules are not a sandbox

They scope class identifiers, but this remains global CSS:

```css
html {}
body {}
:root {}
* {}
button {}
a {}
```

Avoid those selectors inside feature packages unless deliberately scoped.

Prefer:

```css
.root button {}
.root a {}
```

or local component classes.

### 20.4 Tier 3 — CSS `@scope`

Useful for Demoscene-style rules that naturally target elements:

```css
@scope (.demoscene-root) {
  :scope {
    background: #000;
    color: #0f0;
    font-family: "Topaz", monospace;
  }

  h1,
  h2 {
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }

  a {
    color: #ff0;
  }
}
```

As of 2026, `@scope` is Baseline 2026 across current browser versions, but older browsers may not support it. Verify the project's actual browser matrix.

### 20.5 Do not import feature resets globally

Avoid inside Guestbook/Demoscene:

- global reset styles;
- `normalize.css` applied globally;
- Tailwind preflight imported only for a feature unless correctly scoped;
- global `body`/`html` theme changes.

Global document baseline styles belong to the host.

### 20.6 Do not assume feature CSS unloads on unmount

Vite can lazy-fetch CSS with an async chunk, but once a stylesheet has been loaded into the page, ordinary component unmounting should **not** be treated as a CSS cleanup mechanism.

Therefore feature CSS must remain harmless even after the user leaves the feature. Scoping is architectural protection, not optional decoration.

---

## 21. Lazy CSS with Vite

Vite's CSS code splitting is enabled by default.

CSS imported from an asynchronous JavaScript chunk can be preserved as a separate CSS chunk and fetched when that async chunk is fetched.

Conceptually:

```ts
await import("@site/demoscene");
```

can produce:

```text
demoscene-[hash].js
demoscene-[hash].css
```

Do not disable `build.cssCodeSplit` without a concrete reason.

```ts
build: {
  cssCodeSplit: true // default
}
```

This is exactly the desired behavior for Guestbook/Demoscene: their substantial feature-specific styles do not need to be part of the initial stylesheet path.

---

## 22. Assets, Fonts, Audio, Images, and WebGL

Feature-specific assets should live with the feature:

```text
packages/demoscene/src/
├─ assets/
│  ├─ logo.svg
│  ├─ images/
│  └─ textures/
├─ audio/
│  ├─ intro.ogg
│  └─ theme.ogg
└─ effects/
```

Import assets from feature code:

```ts
import themeUrl from "./audio/theme.ogg";
```

This allows Vite to discover, hash, and emit the production asset correctly.

### Audio

Do not start large audio downloads during encyclopedia startup.

Instantiate/load music:

- after Demoscene is loaded;
- preferably after user interaction when browser autoplay policy requires it;
- only for the active experience.

### Fonts

Keep Demoscene-only fonts inside the Demoscene dependency graph where practical.

Avoid importing feature fonts from host global CSS, because that can cause them to be fetched earlier than intended.

### Images/textures

Large textures or visual assets should remain reachable only from Demoscene code unless shared by the encyclopedia.

### WebGL/canvas

Treat GPU resources as owned resources requiring explicit teardown when the feature leaves the DOM.

---

## 23. Feature Teardown and Side-Effect Ownership

This is particularly important for Demoscene.

Anything a feature changes outside its own React subtree must be restored:

- `window` listeners;
- `document` listeners;
- timers;
- animation frames;
- `AudioContext`;
- media playback;
- WebGL resources;
- fullscreen state;
- pointer lock;
- `document.title`;
- `body` classes/styles;
- overflow changes;
- global keyboard handlers;
- observers/subscriptions.

Example:

```tsx
useEffect(() => {
  const ctx = new AudioContext();
  const raf = requestAnimationFrame(loop);

  const onResize = () => {
    // ...
  };

  window.addEventListener("resize", onResize);

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  return () => {
    void ctx.close();
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    document.body.style.overflow = previousOverflow;

    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  };
}, []);
```

Principle:

> **A feature owns cleanup for every side effect it creates.**

"Music continues playing after returning to the encyclopedia" is exactly the kind of failure this rule prevents.

---

## 24. Shared React Runtime

Preferred runtime model:

```text
                   React / ReactDOM
                         │
              ┌──────────┼───────────┐
              │          │           │
           Host      Guestbook    Demoscene
```

All features are ordinary subtrees of one root:

```text
createRoot(...)
└─ App
   ├─ encyclopedia
   ├─ guestbook subtree
   └─ demoscene subtree
```

Avoid:

```text
host createRoot()
guestbook createRoot()
demoscene createRoot()
```

unless independent runtime roots are a deliberate requirement.

One tree gives:

- predictable hooks;
- React context compatibility;
- easier devtools;
- simpler routing;
- shared error/loading infrastructure;
- less runtime duplication.

---

## 25. Prevent Duplicate React

A classic failure is:

```text
Invalid hook call
```

caused by multiple React copies.

Defenses:

1. feature packages declare compatible React/ReactDOM peer expectations;
2. host owns the actual runtime dependency;
3. inspect with:

```bash
pnpm why react
pnpm why react-dom
```

4. use Vite `resolve.dedupe` when linked/hoisted resolution can produce duplicates:

```ts
resolve: {
  dedupe: ["react", "react-dom"],
}
```

Vite documents `resolve.dedupe` specifically for duplicated dependencies often caused by hoisting or linked monorepo packages.

---

## 26. Ownership Boundaries

### Host owns

- top-level router/history;
- application shell;
- global navigation;
- authentication/session;
- authorization/permissions;
- global telemetry;
- global layout;
- global document theme;
- product-wide localization infrastructure;
- stable cross-feature API abstractions;
- top-level error handling.

### Guestbook owns

- Guestbook pages/components;
- forms;
- feature validation;
- Guestbook API calls;
- Guestbook state;
- local styles;
- local tests;
- feature-specific dependencies.

### Demoscene owns

- demo presentation;
- music/audio;
- animation/effects;
- WebGL/canvas;
- demo assets/textures;
- demo theme/fonts;
- local state;
- local styles;
- local tests;
- teardown of demo side effects.

Ownership should be visible from the directory structure.

---

## 27. Sharing State and Services

Default communication direction:

```text
host → props / stable contract → feature
feature → callbacks/events      → host
```

Example:

```tsx
<Demoscene
  locale={locale}
  theme={theme}
  onNavigate={navigate}
/>
```

For a larger stable contract:

```ts
export interface FeatureContext {
  locale: string;
  navigate(path: string): void;
  api: PublicFeatureApi;
}
```

Then:

```tsx
<Guestbook context={featureContext} />
```

Do not let a feature do:

```ts
import { authStore } from "../../../apps/encyclopedia/src/state/auth";
import { api } from "../../../apps/encyclopedia/src/internal/api";
```

That reverses dependency direction and re-couples the feature to host implementation.

### Can a feature have its own state library?

Yes, if it is feature-local.

A Guestbook can internally use its own state layer if:

- it does not leak that store into the host;
- it does not create unnecessary heavy duplication;
- cross-boundary communication remains explicit.

---

## 28. Optional Shared Packages

Introduce shared packages conservatively.

### `@site/shared-ui`

Good candidates:

- stable design-system primitives;
- dialog primitives;
- typography;
- genuinely reusable layout elements.

### `@site/app-contracts`

Good candidates:

- stable cross-feature types;
- navigation contract;
- locale contract;
- public API capability types.

### `@site/shared-utils`

Only for stable, framework-agnostic utilities genuinely used by multiple packages.

Avoid:

```text
shared/
├─ everything.ts
├─ randomHelpers.ts
├─ hostInternals.ts
└─ misc.ts
```

A generic shared package easily becomes a dependency magnet and recreates the monolith in another folder.

Practical heuristic:

> Duplicate a small helper/component twice before extracting an abstraction. Extract when reuse and stability are demonstrated, not predicted.

---

## 29. Build and Deployment

There is one release artifact:

```text
workspace source
      │
      ▼
   pnpm build
      │
      ▼
     Vite
      │
      ├─ analyzes host + workspace packages
      ├─ preserves async import boundaries
      ├─ factors common dependencies when useful
      ├─ emits JS/CSS chunks
      └─ emits hashed assets
      │
      ▼
     dist/
      │
      ▼
 one deployment
```

No requirement for:

- Guestbook deployment;
- Demoscene deployment;
- remote manifests;
- `remoteEntry.js`;
- runtime remote registration;
- remote availability handling;
- separate version rollout coordination.

That operational simplicity is a major reason **not** to use Module Federation now.

---

## 30. Production Dynamic-Import Failure Handling

Lazy chunks add one production failure mode that an all-eager single bundle hides: a long-lived browser tab can reference an old hashed chunk after a new deployment removes it.

Current Vite documentation describes this as dynamic-import/preload version skew.

Recommended deployment defenses:

1. serve HTML with revalidation (`Cache-Control: no-cache` or equivalent strategy);
2. keep previous hashed assets temporarily when practical;
3. provide a graceful reload path for missing dynamic chunks;
4. log load failures separately from feature runtime crashes.

Vite exposes `vite:preloadError`:

```ts
window.addEventListener("vite:preloadError", (event) => {
  // Optional: telemetry / guard against reload loops.
  window.location.reload();
});
```

For production code, add loop protection and only reload when appropriate.

This is especially relevant for optional routes that a user may open hours after the initial page load.

---

## 31. Verify That Lazy Loading Actually Works

Do not trust architecture diagrams; verify the production graph.

Build:

```bash
pnpm build
```

Inspect `dist/assets` and, if useful, generate a Vite manifest:

```ts
build: {
  manifest: true
}
```

Use a bundle visualizer compatible with the current Vite/Rolldown toolchain.

### Network test

1. Open `/` in a clean browser session.
2. Verify Guestbook-only code/assets are not requested.
3. Verify Demoscene-only code/assets are not requested.
4. Navigate to `/guestbook`.
5. Confirm Guestbook JS/CSS arrives.
6. Return to host.
7. Navigate to `/demo`.
8. Confirm Demoscene JS/CSS/media arrives only when required.

### CI regression guard

Useful invariants:

- no static import from host startup graph to feature implementation;
- initial JS budget does not unexpectedly jump;
- feature chunks remain reachable asynchronously;
- no duplicate React runtime;
- no forbidden cross-package imports.

Bundle filenames are implementation details. Test dependency/load behavior, not exact hashes.

---

## 32. Testing Strategy

### 32.1 Unit/component tests

Each package tests its own implementation:

```text
packages/guestbook/tests/
packages/demoscene/tests/
```

### 32.2 Feature integration tests

Mount the feature with a mocked public host contract.

Test:

- local routing;
- feature state;
- API interaction;
- failure states;
- teardown.

### 32.3 Host integration tests

Test that:

```text
/guestbook
/demo
```

activate the correct feature.

### 32.4 Lazy-loading regression tests

Production/network test that feature resources are absent from initial load.

### 32.5 Demoscene teardown tests

Specifically verify:

- music stops;
- RAF loop stops;
- global listeners are removed;
- body styles/classes restore;
- fullscreen/pointer lock exits if needed;
- WebGL resources release when feasible.

---

## 33. Development Workflow

The developer experience should remain ordinary:

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
```

A developer can work almost entirely inside:

```text
packages/guestbook/
```

or:

```text
packages/demoscene/
```

while the single host Vite dev server provides the integrated runtime.

This is a key advantage over runtime-distributed microfrontends: source ownership is separate without multiplying local servers, remote manifests, compatibility layers, or deployment environments.

---

## 34. Common Anti-Patterns

### 34.1 Static-importing a lazy feature from startup code

Bad:

```ts
import Guestbook from "@site/guestbook";
```

Good:

```ts
const mod = await import("@site/guestbook");
```

at the lazy boundary.

### 34.2 Eager mega-barrel

Bad:

```ts
export * from "@site/guestbook";
export * from "@site/demoscene";
```

if that barrel is statically imported by startup code.

Keep lazy imports explicit.

### 34.3 Deep feature imports

Bad:

```ts
import CommentForm from "@site/guestbook/src/components/CommentForm";
```

Good:

```ts
import("@site/guestbook");
```

through the package public API.

### 34.4 Feature imports host internals

Bad:

```ts
import { something } from "../../apps/encyclopedia/src/internal/...";
```

Move stable shared capability/types into an explicit shared package or pass them from the host.

### 34.5 Feature global CSS

Bad:

```css
body {
  background: black;
}
```

Good:

```css
.demosceneRoot {
  background: black;
}
```

or scoped rules.

### 34.6 Separate `createRoot()` for every feature

Do not create multiple React applications when ordinary composition solves the problem.

### 34.7 Premature `shared` package

Do not centralize every utility early.

### 34.8 Premature bundler chunk tuning

Do not start with custom code-splitting rules merely to produce aesthetically named chunks.

Measure first.

### 34.9 Loading Demoscene media from host CSS/entry code

This silently defeats the lazy boundary even if the component itself is dynamically imported.

### 34.10 Forgetting teardown

A physically separate package is not isolated if it leaves timers, body styles, audio, or window listeners behind.

---

## 35. Alternatives and Decision Matrix

| Approach | Source isolation | Lazy loading | CSS isolation | Independent deploy | Runtime complexity | Fit |
|---|---:|---:|---:|---:|---:|---|
| Plain folders + `React.lazy` | Medium | Yes | Convention | No | Very low | Good for small codebase |
| **Workspace source packages + lazy routes** | **High** | **Yes** | **CSS Modules/root/`@scope`** | No | **Low** | **Best** |
| Prebuilt internal packages | High | Yes | Same | Not necessarily | Low-medium | Only when artifact boundary is needed |
| Nx/Turborepo on top | High | Yes | Same | No | Medium tooling | Useful as repository grows |
| Module Federation | High | Yes | Convention | **Yes** | Medium-high | Unnecessary now |
| Import maps/native remote ESM | High | Yes | Convention | Yes | Medium/manual | Usually more plumbing than needed |
| single-spa | High | Yes | Convention | Usually yes | High | Overengineered here |
| Web Components/Shadow DOM | High | Yes | Strong | Optional | Medium | Hard isolation only |
| iframe | Very high | Browser-level | Very strong | Optional/yes | Medium integration cost | Too isolated |
| Separate hard navigation | Absolute | Full page | Absolute | Yes | Operationally simple | Loses integrated SPA UX |

---

## 36. Why Not Module Federation Now?

Module Federation solves this kind of topology:

```text
Host build/deploy
      │
      ├── runtime ──► Guestbook remote build/deploy
      └── runtime ──► Demoscene remote build/deploy
```

It provides runtime concepts such as:

- remotes;
- remote manifests / remote entries;
- runtime remote registration/loading;
- shared dependency configuration;
- singleton/version negotiation;
- remote failure handling;
- cross-build compatibility concerns.

The current requirement is:

```text
one build
├─ host
├─ guestbook async chunk
└─ demoscene async chunk
```

If Guestbook and Demoscene are always released with the encyclopedia, Federation adds mechanism without solving an additional problem.

### Reconsider Federation when

A requirement becomes:

> "Guestbook must be built, versioned, hosted, or deployed independently, and the encyclopedia must consume the deployed artifact at runtime without rebuilding itself."

At that point the package/public API boundary already created here makes migration much easier.

---

## 37. Why Not single-spa?

single-spa is designed around independently registered applications with explicit application lifecycles such as:

- load;
- bootstrap;
- mount;
- unmount;
- optionally unload.

That is valuable when multiple separately bootstrapped frontend applications/frameworks must coexist and be activated independently.

For this use case:

- all features are React;
- one React runtime is desired;
- one host router is sufficient;
- one build/deploy is desired.

Adding an application orchestrator would duplicate responsibilities already handled naturally by React composition and the router.

---

## 38. Why Not Shadow DOM by Default?

Shadow DOM provides stronger style/DOM isolation than CSS Modules.

But it complicates:

- inherited styles;
- host design tokens;
- portals;
- modals/overlays;
- focus behavior;
- accessibility coordination;
- DOM queries;
- third-party React UI libraries.

If all code is controlled by the same project, CSS Modules + root scoping + `@scope` usually provides enough isolation at much lower cost.

Use Shadow DOM only after observing actual unresolved style/DOM leakage.

---

## 39. Why Not iframe?

An iframe is appropriate when the desired boundary is truly document-level:

- untrusted content;
- legacy application;
- incompatible global runtime assumptions;
- intentional sandbox;
- feature that must own its entire document environment.

Costs for a first-class feature:

- split React context;
- separate history concerns;
- harder responsive integration;
- harder accessibility coordination;
- explicit cross-frame messaging;
- duplicated runtime/assets;
- more difficult shared auth/theme/state.

Demoscene is visually different, but that alone does not justify an iframe.

---

## 40. Why Not Plain Feature Folders?

A structure such as:

```text
src/
├─ encyclopedia/
├─ guestbook/
└─ demoscene/
```

with `React.lazy()` can technically provide code splitting.

Its weakness is architectural rather than runtime:

- dependencies remain mixed in the host package;
- deep imports are easy;
- ownership is convention-only;
- feature deletion/extraction is harder;
- boundaries tend to erode over time.

Workspace packages cost little and provide a much stronger boundary.

---

## 41. Nx / Turborepo: When to Add Tooling

Do not introduce repository orchestration merely because there are three packages.

Add Nx, Turborepo, or similar tooling when measurable repository-scale problems appear:

- many packages;
- slow repeated CI tasks;
- complex dependency-aware task execution;
- need for remote caching;
- generators/templates become valuable;
- ownership/tag rules need stronger enforcement.

This tooling can be layered on later without changing the fundamental architecture.

---

## 42. Migration Paths

### 42.1 Current state

```text
workspace source package
+ dynamic import
+ one build
```

### 42.2 Need precompiled artifact

```text
workspace package
+ Vite library build
+ dist export
+ still one product deployment
```

### 42.3 Need independent deployment

```text
prebuilt feature
+ Module Federation / another runtime composition mechanism
+ independent remote deployment
```

If the initial public contract is narrow, the React feature component itself may need very little change.

### 42.4 Repository becomes large

Add:

- task caching;
- dependency graph tooling;
- generators;
- stronger project tags/boundary checks.

Architecture remains package-based.

---

## 43. Pros

### Architectural

- Strong physical code ownership.
- Main encyclopedia remains focused.
- Feature dependencies become explicit.
- Features can be removed/replaced more easily.
- Public APIs reduce accidental coupling.
- Easy future extraction to true runtime microfrontends if required.

### Performance

- Guestbook code need not be downloaded on initial load.
- Demoscene code/media can remain off the startup path.
- Feature CSS can load with async feature code.
- Heavy feature-only libraries stay behind the lazy boundary.

### Development

- Standard React.
- Standard React Router.
- Standard ESM dynamic imports.
- Standard Vite.
- Standard workspaces.
- One dev server.
- One lockfile.
- Normal IDE refactoring.
- No remote frontend development environment.

### Operations

- One build.
- One deployment.
- No remote availability/version skew.
- No federation manifests.
- No runtime remote dependency negotiation.
- No distributed frontend release coordination.

---

## 44. Cons and Trade-offs

### One release unit

Changing Guestbook usually means rebuilding/redeploying the whole product.

That is intentional.

### Shared dependency graph

The bundler may create common chunks. Source package separation does not imply every dependency becomes a unique physical output file.

### CSS is scoped, not sandboxed

CSS Modules do not create a separate document. Global selectors remain global.

### Architectural discipline is still required

A workspace alone cannot prevent every bad dependency; enforce boundaries through exports, linting, and review.

### Shared React/runtime compatibility

Feature packages must remain compatible with the host's frontend runtime.

### First-navigation latency

Lazy loading moves some cost from startup to feature activation. Use measured intent-preloading if necessary.

### Dynamic import deployment skew

Long-lived clients can reference old chunk hashes after deployment. Handle this deliberately.

### Host build grows with repository size

Because the host owns the final build, very large workspaces can eventually increase build time. Add caching/build orchestration only when this becomes real.

---

## 45. Recommended Implementation Plan

### Phase 1 — establish workspace

Create:

```text
apps/encyclopedia/
packages/guestbook/
packages/demoscene/
```

Configure workspace and root TypeScript/ESLint.

### Phase 2 — migrate Guestbook

1. Move Guestbook source to its package.
2. Add a single public entry.
3. Declare local dependencies.
4. Remove imports from host internals.
5. Pass required host capabilities as props/contracts.
6. Lazy-load `/guestbook/*`.

### Phase 3 — verify Guestbook

Production build + Network tab:

- no Guestbook-only resources on `/`;
- Guestbook resources appear on navigation;
- browser back/forward works;
- no duplicate React;
- styles do not leak.

### Phase 4 — migrate Demoscene

Repeat the package conversion, then additionally isolate:

- audio;
- fonts;
- WebGL/canvas;
- textures/images;
- animations;
- global-looking CSS;
- document/body side effects.

### Phase 5 — enforce boundaries

Add lint/import rules and CI.

### Phase 6 — add teardown tests

Especially for Demoscene.

### Phase 7 — optimize only after measurement

Measure:

- initial bundle;
- first navigation latency;
- chunk graph;
- duplicate dependencies;
- media loading.

Only then consider:

- intent preload;
- chunk customization;
- repository caching tooling.

---

## 46. Architectural Rules — Short Form

Use this as project policy:

```text
1. Auxiliary applications are private workspace packages.
2. Each feature package exposes a minimal public API.
3. The host owns the application shell and top-level browser history.
4. Whole feature applications are loaded through route-level dynamic imports.
5. Non-route optional features may use React.lazy().
6. No startup code may statically import lazy feature implementations.
7. Feature packages must not import private host implementation.
8. Feature packages must not directly depend on each other.
9. Shared code lives only in small, explicit, stable shared packages.
10. One compatible React/ReactDOM runtime is used.
11. Feature CSS uses CSS Modules and a feature root boundary.
12. Global-ish Demoscene rules use explicit scoping (`@scope` where supported).
13. Feature packages must not ship uncontrolled global resets.
14. Feature-only assets/fonts/audio remain inside the lazy feature graph.
15. Every global side effect is undone on feature unmount.
16. Vite default code splitting is preferred before custom chunk tuning.
17. Linked ESM workspace packages are treated as source; optimizeDeps tuning is exception-only.
18. Production bundles/network behavior are verified in CI or release testing.
19. Dynamic-import deployment skew has a recovery strategy.
20. Module Federation is introduced only when independent deployment becomes a real requirement.
```

---

## 47. FAQ

### Is this a microfrontend?

It uses microfrontend ideas, but **modular frontend monolith with lazy-loaded workspace feature apps** is the more precise description because all features are built and deployed as one product.

### Does Guestbook participate in the build?

Yes.

It participates in the same Vite build, but its implementation is behind a dynamic import boundary.

### Is Guestbook downloaded on first load?

Not if its feature-specific code is only reachable through the dynamic import and nothing else eagerly imports it.

Always verify with a production build and Network panel.

### Will Guestbook CSS load immediately?

Feature CSS imported only through the async feature graph can be emitted/fetched with the async chunk because Vite CSS code splitting is enabled by default.

### Does physical package separation guarantee separate generated files?

No.

The bundler can factor shared dependencies into common chunks. The important invariant is that unnecessary feature-specific code is not part of the initial loading path.

### Should every feature have its own `package.json`?

Yes, if a meaningful architectural boundary is desired.

### Must the packages be published to npm?

No. Keep them private and use workspace linking.

### Must every package have its own build?

No. For this architecture the host can compile ESM-compatible workspace source directly.

### Should Guestbook have its own React?

No independent runtime is desirable here.

### Should Guestbook have its own router?

Only for nested route ownership. The host should still own `/guestbook/*` and browser history.

### Can Demoscene use a completely different styling system?

Yes, provided its output is properly scoped and it does not pollute global styles.

### Can a feature use a heavy dependency the host does not use?

Yes. That is one of the advantages of the lazy boundary. Keep the dependency only in that feature graph.

### Can a feature have its own state management?

Yes, when local to the feature.

### How should features communicate with the host?

Props, callbacks, and small stable capability contracts.

### Can they share components?

Yes, but extract a shared package only after genuine reuse exists.

### Should I use `manualChunks`/custom chunk configuration?

Not initially. Current Vite uses Rolldown-based build customization. Start with natural dynamic imports and measure the output before changing the chunking strategy.

### Why is `resolve.dedupe` present?

It is a defensive tool when linked/hoisted packages can resolve duplicate singleton dependencies such as React. It is not a substitute for correct package dependencies.

### Do I need `optimizeDeps.exclude` for workspace features?

Normally no. Current Vite detects linked ESM monorepo packages as source automatically. Configure dependency optimization only for demonstrated exceptions.

### What if CSS Modules are insufficient?

Escalate:

1. remove accidental global selectors;
2. add a root namespace;
3. use `@scope` for element/global-ish styles;
4. isolate problematic third-party CSS;
5. use Shadow DOM only for real hard-isolation needs;
6. use iframe only for document-level isolation.

### What about SEO?

Lazy client rendering and SEO are separate concerns. If Guestbook content must be indexed reliably, consider SSR/prerendering based on product requirements; the workspace-package architecture does not prevent that.

### Can I lazy-load a modal instead of a route?

Yes. Use `React.lazy()` or an explicit dynamic import at the appropriate UI boundary.

### What is the most important architectural rule?

**One-way dependency direction, enforced by tooling.**

Without it, separate directories gradually become one coupled application again.

### When should I switch to Module Federation?

When a feature must be built/deployed/versioned independently and consumed by the host at runtime without rebuilding the host.

---

## 48. Final Checklist

### Repository

- [ ] `apps/encyclopedia`
- [ ] `packages/guestbook`
- [ ] `packages/demoscene`
- [ ] workspace configured
- [ ] one lockfile
- [ ] TypeScript base config
- [ ] ESLint boundary rules

### Package boundaries

- [ ] each feature has its own `package.json`
- [ ] feature `exports` exposes only public entry points
- [ ] no deep imports
- [ ] no feature→host-internal imports
- [ ] no feature→feature imports
- [ ] shared packages remain small/stable

### Runtime

- [ ] one React/ReactDOM runtime
- [ ] no extra `createRoot()` per feature
- [ ] React compatibility declared
- [ ] duplicate runtime checked with package-manager tools
- [ ] `resolve.dedupe` used defensively if needed

### Lazy loading

- [ ] route-level lazy loading for whole feature apps
- [ ] `React.lazy()` only where component-level loading fits better
- [ ] no eager mega-barrel
- [ ] no static startup imports of feature implementations
- [ ] optional preloading based on intent/measurement

### Routing

- [ ] host owns top-level history/router
- [ ] `/guestbook/*` reserved for Guestbook
- [ ] `/demo/*` reserved for Demoscene
- [ ] no nested `BrowserRouter`
- [ ] nested feature routes are relative

### CSS

- [ ] CSS Modules by default
- [ ] feature root namespace
- [ ] feature-local CSS variables
- [ ] no uncontrolled global reset
- [ ] Demoscene global-ish styles scoped
- [ ] browser support checked for `@scope`
- [ ] do not depend on CSS unloading on unmount

### Assets

- [ ] feature-only media imported from feature graph
- [ ] Demoscene audio is not loaded at encyclopedia startup
- [ ] feature-only fonts are not imported globally
- [ ] large images/textures remain lazy where possible

### Teardown

- [ ] timers cancelled
- [ ] RAF cancelled
- [ ] listeners removed
- [ ] audio stopped/closed
- [ ] body/document changes restored
- [ ] fullscreen/pointer lock cleaned up
- [ ] WebGL resources released where appropriate

### Build/production

- [ ] Vite defaults used before custom chunk tuning
- [ ] linked packages work as ESM source
- [ ] `optimizeDeps` customized only if necessary
- [ ] production bundle inspected
- [ ] initial Network load contains no feature-only resources
- [ ] feature JS/CSS loads on navigation
- [ ] dynamic-import version-skew recovery exists
- [ ] HTML cache strategy supports deployments

### Testing

- [ ] feature unit tests
- [ ] feature contract integration tests
- [ ] host route integration tests
- [ ] lazy-loading regression test
- [ ] Demoscene teardown regression tests
- [ ] optional initial bundle budget

---

## 49. Final Recommended Shape

```text
                         ONE PRODUCT
                              │
                    one install / one build
                              │
                              ▼
                    ┌────────────────────┐
                    │ Encyclopedia Host  │
                    │ React + Router     │
                    └─────────┬──────────┘
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
         Main routes      /guestbook        /demo
                              │                │
                       dynamic import     dynamic import
                              │                │
                              ▼                ▼
                   ┌─────────────────┐ ┌─────────────────┐
                   │ Guestbook       │ │ Demoscene       │
                   │ workspace pkg   │ │ workspace pkg   │
                   │ local state/API │ │ audio/effects   │
                   │ CSS Modules     │ │ scoped theme    │
                   └─────────────────┘ └─────────────────┘
                              │                │
                              └───────┬────────┘
                                      │
                         optional stable shared
                          contracts / UI / utils
```

For this scenario, this architecture gives the strongest useful separation without turning frontend composition into a distributed-system problem.

---

## 50. Current Official References

The architecture above combines the two supplied design documents and was rechecked against current primary documentation on 2026-08-31.

### React

- React `lazy`: https://react.dev/reference/react/lazy
- React `Suspense`: https://react.dev/reference/react/Suspense

Key current behavior: `lazy(load)` defers loading until first render, caches the promise/result, and integrates with Suspense/Error Boundaries.

### React Router

- Route Object / `lazy`: https://reactrouter.com/start/data/route-object
- Automatic code splitting: https://reactrouter.com/explanation/code-splitting
- Route modules: https://reactrouter.com/start/framework/route-module
- Lazy route discovery: https://reactrouter.com/explanation/lazy-route-discovery

Key current behavior: route-object `lazy` supports code splitting, while Framework Mode can automatically code-split route modules.

### Vite

- Dependency pre-bundling / monorepos: https://vite.dev/guide/dep-pre-bundling.html
- Build options: https://vite.dev/config/build-options
- Shared options / `resolve.dedupe`: https://vite.dev/config/shared-options
- Production build and load-error handling: https://vite.dev/guide/build
- Troubleshooting dynamic imports: https://vite.dev/guide/troubleshooting

Key current behavior:

- linked ESM monorepo packages are normally treated as source automatically;
- CSS imported from async JS chunks is code-split/fetched with those chunks when CSS code splitting is enabled;
- current Vite build customization is Rolldown-based (`build.rolldownOptions`);
- `resolve.dedupe` exists for duplicate dependencies caused by hoisting/linked packages;
- `vite:preloadError` can be used to recover from deployment-time missing dynamic chunks.

### pnpm

- Workspaces / `workspace:` protocol: https://pnpm.io/workspaces
- Workspace settings: https://pnpm.io/settings

Key current behavior: `workspace:` forces a dependency to resolve to a local workspace package rather than silently falling back to a registry package.

### CSS `@scope`

- MDN `@scope`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40scope

As of 2026, MDN marks `@scope` as Baseline 2026 across current browser versions; older-browser support must still be checked against the product's support matrix.

### Module Federation

- Runtime overview: https://module-federation.io/guide/runtime/
- Runtime API: https://module-federation.io/guide/runtime/runtime-api
- Shared dependencies: https://module-federation.io/configure/shared
- Remotes: https://module-federation.io/configure/remotes

These documents illustrate the runtime remote/shared-dependency machinery intentionally avoided by the recommended single-build architecture.

### single-spa

- Applications API: https://single-spa.js.org/docs/api/
- Building applications/lifecycles: https://single-spa.js.org/docs/building-applications/
- Microfrontend types: https://single-spa.js.org/docs/module-types/

single-spa's explicit application registration and bootstrap/mount/unmount lifecycle model is useful for independently orchestrated applications, but unnecessary for the present one-React-tree use case.

---

## 51. Decision Record

**Decision:** Adopt **private source-exported workspace feature packages + route-level dynamic imports**, with one React runtime and one Vite build.

**Guestbook:** `packages/guestbook`  
**Demoscene:** `packages/demoscene`  
**Host:** `apps/encyclopedia`

**Default styling:** CSS Modules + feature root.  
**Demoscene styling:** add scoped element rules / `@scope` where necessary.  
**Routing:** host owns top-level history and feature prefixes.  
**State/integration:** explicit props/callbacks/contracts.  
**Boundary enforcement:** package exports + lint/CI.  
**Optimization:** measure first; avoid premature Vite chunk tuning.  
**Escalation:** prebuilt package → Module Federation only if independent release/deployment becomes a real requirement.

This is the recommended canonical architecture for the stated use case.
