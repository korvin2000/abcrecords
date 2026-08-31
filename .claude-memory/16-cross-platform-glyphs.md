# 16 · Unicode signs across platforms — why they keep breaking, and the one rule (2026-08-30)

> **The rule, in one line:** a Unicode sign that is not in the text faces is
> drawn with `<Glyph>` (`apps/guitar-codex/src/components/Glyph.tsx`), never with a
> `font-size`, and never with a hand-tuned offset.
>
> Read this before adding, resizing, or "nudging" any of ♀ ♂ ⚥ 𝄞 ♪ ◀ ▶ ✦ ❖ ❧ ✕.

---

## 1 · Why this kept happening

Three separate bugs of this shape shipped and were fixed one at a time — the
search box's clef (2026-08-13), the gender strip and the tablature clef
(2026-08-30). Each fix was local, so the *next* sign was written the same way
again. The pattern is worth naming because it is not obvious and it is not a
mistake anyone makes once.

**A sign in this UI is not a character. It is a font substitution you did not
make.** None of ♀ ♂ ⚥ 𝄞 ♪ ◀ ▶ exists in Cormorant. When one appears in the
markup the browser walks the `font-family` stack, then the platform's own
fallback chain, and draws it from whichever face gets there first:

| Platform | Who actually draws it |
|---|---|
| Windows | Segoe UI Symbol |
| macOS / iOS | Apple Symbols |
| Linux / Android | Noto Music, Noto Sans Symbols 2, DejaVu Sans |

Those faces are unrelated designs. They disagree about **three** things at once,
and each disagreement produces a different visible defect:

1. **Ink size.** The drawn mark can be 0.55 em in one face and 0.95 em in
   another *at the same `font-size`*. Measured: U+1D11E rendered about a fifth
   larger on Linux/Android than on Windows.
   → *the symptom:* the icon is too big, and overhangs its box.
2. **Ink position relative to the baseline.** A clef hangs far below it; a
   gender sign floats above it; the offset differs per face.
   → *the symptom:* the icon is not vertically centred, and a `translateY`
   tuned on one machine makes it worse on another.
3. **Line-box height.** `line-height: normal` is derived from the *face's* own
   ascent/descent, and symbol faces reserve headroom for marks far taller than
   the one being drawn.
   → *the symptom:* **the control around the icon gets taller** — which is
   exactly what the Android gender strip did, standing higher than the language
   strip beside it while matching it on Windows.

A Windows developer sees none of the three, because Windows is where the
literal was calibrated. **That is the whole reason it recurs**: the defect is
invisible on the machine that writes it, and there is no failing test — only a
screenshot from a phone, weeks later.

There is a fourth, independent trap: several of these codepoints are
`Emoji=Yes, Emoji_Presentation=No` (♀ ♂ ◀ ▶ ✦ among them). Unqualified they
*should* draw as text, but a fallback chain that reaches a colour emoji face
first will draw a burgundy sign as a purple pictograph. Android's chain reaches
Noto Color Emoji readily.

---

## 2 · The fix, and why it is a-priori rather than empirical

Two files, one primitive:

- **`apps/guitar-codex/src/lib/glyph.ts`** — the measurement.
- **`apps/guitar-codex/src/components/Glyph.tsx`** + **`apps/guitar-codex/src/styles/glyph.css`** — the element.

### 2.1 Take the font out of layout entirely

`<Glyph>` renders two elements. The outer one is the **layout box**: its
`block-size` is stated by the caller, its `line-height` is `0`, and the text
inside is `position: absolute`. **No face's metrics can change the size of
anything.** That alone kills failure mode 3 — the control can no longer grow —
and it does so without measuring a thing.

### 2.2 Measure the two quantities CSS cannot express

- **Where the baseline sits inside a `line-height: 1` line box** — measured in
  the DOM with the classic zero-size `inline-block` baseline probe. *Not*
  derived from canvas `fontBoundingBox*`: that is a guess about which face
  supplied the strut, and the guess is wrong precisely when a fallback drew the
  glyph.
- **Where the ink is** — `canvas.measureText()`'s `actualBoundingBox*`, the
  only API that reports a glyph's drawn extent. No layout, no reflow.

From five measured numbers come four unitless ratios (`scale`, `aspect`,
`dx`/`dy`, `cx`), handed to CSS as custom properties. Unitless is the point:
the caller keeps its own `clamp()` and CSS does the arithmetic, so fluid sizing
still works.

> ⚠️ Sign convention: `actualBoundingBoxLeft` is positive **leftwards** from
> the alignment point. Ink width is `left + right`, not `right − left`. Getting
> that backwards silently halves every box.

### 2.3 Normalise the *face*, not the glyph

`sizedBy` exists because a set of related signs (♀ ♂ ⚥) must keep the
proportions its designer gave it. Normalising each sign to an identical ink
height would grow ♀ — naturally shorter than ♂ — until the two circles no
longer matched. So **one** glyph of the set is the reference, and the whole set
is scaled by that single factor. Centring, by contrast, is per glyph.

### 2.4 Pin the text presentation

Every emoji-capable sign is written **once**, in `apps/guitar-codex/src/lib/signs.ts`, with
U+FE0E appended. `--font-symbol` and `--font-music` (tokens.css) additionally
carry no emoji face at all. `--font-emoji` exists for the one place a picture is
actually wanted (the unknown-document 📜).

---

## 3 · How to use it

```tsx
import { Glyph } from "@/components/Glyph";
import { SIGN, GENDER_REF } from "@/lib/signs";

// a lone sign in a fixed medallion
<span className="grid h-10 w-10 place-items-center rounded-full border">
  <Glyph char={SIGN.clef} font="var(--font-music)" size="1.15rem" />
</span>

// a set that must keep its own proportions
<Glyph char={SIGN.female} sizedBy={GENDER_REF} size="var(--segment-icon)" />
```

| Prop | Meaning |
|---|---|
| `char` | the sign — take it from `SIGN`, never a literal |
| `sizedBy` | the set's reference glyph (defaults to `char`) |
| `font` | `var(--font-symbol)` (default), `var(--font-music)`, `var(--font-emoji)` |
| `size` | the **reference ink height** — any CSS length, `clamp()` included |
| `label` | only when the sign carries meaning nothing around it repeats |

`size` is an *ink height*, not a `font-size`. The element's box ends up exactly
that tall on every platform, and exactly as wide as the mark inside it.

A face that arrives late (a web font in the stack) invalidates every
measurement once, via `document.fonts.ready`; components re-render through
`useSyncExternalStore`. An engine with no ink metrics degrades to plain text —
unstyled but readable, never placed by guesswork.

---

## 4 · The checklist

Before adding a sign to the UI:

- [ ] Is it in Cormorant? If yes, it is ordinary text — nothing here applies.
- [ ] Add it to `SIGN` in `lib/signs.ts`. Is it in the Unicode emoji set? If
      so, append U+FE0E.
- [ ] Draw it with `<Glyph>`. Give `size` an **ink height**.
- [ ] Part of a set? Give every member the same `sizedBy`.
- [ ] Never write `font-size`, `line-height`, `transform: translateY`, or a
      `position` offset for it. If it looks wrong, the dial is `size`.
- [ ] Does the box around it have a stated height? (A control whose height
      comes from its content is one substitution away from growing.)

**Red flags in review** — any of these is the bug coming back:

```css
/* ✗ a font-size for a sign that is not in the text faces */
font-family: var(--font-music);
font-size: 0.9rem;

/* ✗ a hand-tuned offset, however well commented */
transform: translateY(-0.1em);   /* "measured against Cormorant SC" */
```

Both of those are descriptions of one face on one operating system.

---

## 5 · The general lesson, beyond glyphs

The gender strip and the year boxes in the search panel had the *same* defect
from two different causes, and the shared sentence is worth keeping:

> **A control centres a line box. It never centres ink.**

- Gender signs: the ink sat low because the symbol face's ascent is huge.
- Year fields: "1944" sat ~4 px low because **Cormorant's default figures are
  oldstyle** — the 9s and the 4 hang a fifth of an em below the baseline while
  only the 1 reaches x-height. Fixed by asking for the right figures
  (`font-variant-numeric: lining-nums tabular-nums`, `.form-ink--figures`), not
  by padding the box: a nudge is right at 16 px and wrong at every other size.

When something inside a box looks off-centre, work out **where its ink actually
is** before touching padding. The arithmetic is short, and it is written out in
the comment above `.form-ink--figures` in `search.css` as a worked example.

---

## 6 · Where the signs live now

| Sign | Where | Face |
|---|---|---|
| ⚥ ♂ ♀ | search panel gender strip · Lore tab | `--font-symbol` |
| 𝄞 | search box (turning) · gallery tablature rows · documents · footer rosette | `--font-music` |
| ♪ | audio download rows and pills | `--font-music` |
| ◀ ▶ | codex page-turn buttons | `--font-symbol` |
| ✕ | codex / image / pdf / tablature close | `--font-symbol` |
| ❖ ❧ ✦ | documents tab type plates | `--font-symbol` |
| 📜 | documents tab, unknown type | `--font-emoji` |

Still drawn as bare inline text, and fine for now because they sit *in* a text
run beside a word rather than centred in a box of their own: the tablature
viewer's `■ ⇩ ⤡ Ⅱ` transport labels. They are still worth converting if that
toolbar is ever reworked.
