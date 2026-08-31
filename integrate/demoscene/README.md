# Codex Harmoniae — demoscene workspace

The encyclopedia's **About / credits demoscene**, and a small host application
to develop it against.

The production is a demoscene piece dressed as an illuminated manuscript:
parchment and gilding, a rotating wireframe lute, the melody written onto a
stave as it is played, Renaissance pencil studies drifting behind the credits,
and an original baroque score synthesised in the browser.

- **TypeScript**, strict, ~20 modules.
- **One React component** is the entire integration surface: `open` and
  `locale` in, `onClose` out.
- **Localised** — eleven languages ship built in (`ru` the baseline, translated
  into `en`, `es`, `ja`, `de`, `fr`, `it`, `pt`, `uk`, `zh`, `ko`), each as its
  own JSON message catalogue.
- **Zero runtime dependencies, zero network requests.** No fonts, no image
  files, no audio files: everything is drawn or synthesised at load. The one
  portrait among the studies ships as a tone map and a set of traced creases —
  ~19 kB inline — and is re-drawn as pen hatching at bake time, not pasted.
- **Shadow-DOM encapsulated.** Host CSS cannot reach in; its CSS cannot leak out.
- **60 fps at ~0.4 ms of JavaScript per frame**, with a governor that sheds
  detail before it drops a frame.
- **Releases everything on unmount** — the rAF loop, the row timer, the
  `AudioContext`, every listener, the body scroll lock.

---

## Layout

```text
packages/
  demoscene/        @site/demoscene — the feature package. THIS is what gets
                    integrated into the encyclopedia. Source-exported, private,
                    no build step, one public entry.
apps/
  dev-host/         @site/dev-host — a stand-in for apps/encyclopedia. Exists
                    only so the demoscene can be run and reviewed without the
                    encyclopedia. Integrated nowhere.
docs/
  demoscene-integration.md    ← how the host mounts it. Start here.
react-modular-architecture.md  the canonical architecture guide this follows
```

```text
apps/      = deployable products
packages/  = importable internal units
```

---

## Getting started

```bash
npm install
npm run dev          # the dev host on :8791
npm run typecheck    # both packages
npm run build        # the dev host's production build
npm run plates       # the pencil-study plate viewer
```

The dev host reads `?locale=xx` off its own URL, so
`http://localhost:8791/?locale=ja` opens it in Japanese — the same handoff a
launching application would make with a prop.

---

## Integrating it

Read **[`docs/demoscene-integration.md`](docs/demoscene-integration.md)**. The
short version:

```tsx
const Demoscene = lazy(() => import('@site/demoscene'));

{open && (
  <Suspense fallback={null}>
    <Demoscene open locale={locale} onClose={() => setOpen(false)} />
  </Suspense>
)}
```

Copy `packages/demoscene/` into the host repository's `packages/`, add
`"@site/demoscene": "workspace:*"` to the host's dependencies, and mount it
behind a dynamic import. There is no build step and nothing to configure.

The one thing a host normally passes is the language, as a plain string prop.
Any BCP-47 tag is safe: unmatched locales fall through to `fallbackLocale`
(default `en`), so the demoscene never renders blank.

To ask which languages exist *without* pulling in the feature, there is a
few-byte subpath export:

```ts
import { SUPPORTED_LOCALES } from '@site/demoscene/locales';
```

The package's own contract, house rules and internal layout are documented in
[`packages/demoscene/README.md`](packages/demoscene/README.md).

---

## What you are looking at

The score runs 40 bars (96 s) at 100 BPM and the visuals are locked to the **bar
counter**, not to wall-clock time, so every transition lands on a musical event.

| Bars | Section | Scene |
|---|---|---|
| 0–4 | *Praeludium* — broken chords, Em Am B7 Em | Illuminated initial; the title gilded by a travelling highlight |
| 4–12 | *Bourrée* — circle of fifths, Em Am D G C F♯° B7 Em | Rotating wireframe lute; the melody written onto a five-line stave in real notation as it plays |
| 12–28 | *Bourrée* with arpeggio and tabor, then *Tremolo andaluz* — the phrygian cadence Am G F E | The credit roll, with the workshop plates drifting behind it |
| 28–36 | *Canon per descensum* — Em Bm C G Am Em Am B7 | Rose-window vault receding over a rotozoomed lattice |
| 36–40 | *Colophon* — the praeludium returns | Wax seal, impressed ring, **FINIS** |

Underneath, from bar 3.4 to the end, the greeting appears as discrete blocks that
condense out of the mist — from both margins at once, or from the left, or from
the right — hold, and disperse the way they came.

The music is an original setting in the baroque manner, not a quotation. Five
tracker channels — plucked gut string, steel lead, triangle bass, pulse arpeggio,
percussion — into a two-tap feedback hall, a high shelf and a compressor.

### The plates

The five studies that drift behind the credit roll are a workshop notebook, not
decoration. Four are drawn from luthiers' dimensions rather than from memory —
a classical guitar after Torres (body 485 mm, lower bout 365, waist 240, scale
650) laid out on the circles it is struck from and shown in section beside its
own plan; a seven-course Renaissance lute with its bowl in section and its ribs
divided; that guitar's soundboard with Torres fan bracing and its harmonic bars;
and the fingerboard, with the first three modes of the open string standing over
it and the consonances — the half, the two thirds, the three quarters — dropped
onto the frets equal temperament puts them on. Body outlines are tables of
half-widths as a fraction of body length, the form a plan is dimensioned in, so
the proportions are the real ones.

The fifth is a portrait, and it is drawn the same way the others are. What ships
is not the picture: it is a 190 × 271 tone map at eight levels of grey and 170
traced polylines — the creases, lids, hair edges and folds a difference of two
Gaussians finds — delta-coded to a byte a step, about 19 kB together. At load
the renderer hatches across the tone in ten passes at rising thresholds and
tightening spacing, then strokes the creases over the top, all with the same
jittered pencil the other four are built from. Same ink, same hand, same weight,
so it sits in the page rather than on it. `scripts/mkportrait.py` regenerates
both from the original drawing.

---

## How it stays cheap

Measured in the dev host on a 1393 × 622 stage: **60 fps, 0.39 ms of
JavaScript per frame** at the top quality tier — about 2.5 % of a frame budget.

**Precomputation.** A 1024-entry sine/cosine table; nothing in the loop calls
`Math.sin`. A second, six-bit sine table quantised so that *four* samples sum to
exactly 0–255 — one palette index, no clamping, no branch. A 256-entry palette
baked to `Uint32Array` in native ABGR, so a pixel is a single 32-bit store.

**The plasma is separable.** Evaluated on a 192 × 86 buffer (16.5 k pixels) and
stretched by the GPU. Two small tables are filled per frame — one per column, one
per row — and the inner loop is then one add, one lookup, one store:

```ts
for (let y = 0; y < PH; y++) {
  const b = ty[y];
  for (let x = 0; x < PW; x++) buf[p++] = pal[b + tx[x]];
}
```

**Everything else is baked once and blitted.** Parchment, rosette, lattice tile,
wax seal, stave and clef, noteheads, ribbon gradient, gold plate, highlight
sweep, credit roll, block text, the five pencil studies and every piece of
display type are rasterised into offscreen canvases at construction and
thereafter only `drawImage`d. The credit roll and the block text — the largest
bitmaps here — are baked at a scale derived from the display's real size rather
than always at 2×.

**No expensive canvas state in the loop.** No `ctx.filter`, no `shadowBlur`, no
gradient or pattern constructed per frame, one full-canvas composite. The lute's
215 edges batch into four `Path2D` objects by weight and depth, so the whole
instrument is four `stroke()` calls. Blur is faked where it is needed — the
pencil studies get a four-tap offset draw, the block slices a two-tap smear —
which costs three extra `drawImage` calls instead of a second blurred bitmap and
a convolution.

**Adaptive governor.** An exponential moving average of frame cost drives three
tiers: plasma resolution (192×86 / 148×66 / 104×47), plasma stride (every frame /
2nd / 3rd), motes (92 / 54 / 26), vault rings, and credit-roll band height.
Downgrades are permanent for the session; upgrades are capped at two, so the
tiers cannot oscillate.

**It stops when it should.** Closing the dialog or hiding the tab cancels the
`requestAnimationFrame` loop *and* suspends the `AudioContext`; the plain dossier
stops the loop too.

### On the audio click

The tambourine used to start a noise buffer at full amplitude through a 6.2 kHz
high-pass — an instantaneous broadband step measured at **0.131 per sample**, ten
times the kick, which is audible as a high-frequency tick. Percussion enters at
bar 12 = **28.8 s**, which is why it started about half a minute in.

Every percussion voice now has a real 3–4 ms attack ramp, the tambourine sits in
a bounded band (3.1 kHz band-pass into a 5.2 kHz low-pass) instead of an open
shelf, hits read the noise bed at a random offset so repeats are not identical,
and the master bus carries a −7 dB shelf above 9 kHz. Measured after the fix:
max step **0.045**, and the discontinuity at onset is **0** on all three drums.

---

## Accessibility, controls, browser support

See [`packages/demoscene/README.md`](packages/demoscene/README.md) — they belong
to the package, not to this workspace.
