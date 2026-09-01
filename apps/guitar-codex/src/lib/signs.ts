/**
 * The Unicode signs the chrome is drawn with, in one place.
 *
 * Two reasons this is a module and not a set of literals scattered through the
 * components:
 *
 * **Text presentation.** Several of these codepoints are `Emoji=Yes,
 * Emoji_Presentation=No` — ♀ ♂ ◀ ▶ ✦ ✕ among them. Unqualified they are
 * *supposed* to draw as text, but a platform whose font fallback reaches its
 * colour emoji face before its symbol face will draw a burgundy sign as a
 * purple pictograph instead — and Android's fallback chain reaches Noto Color
 * Emoji readily. `︎` (VARIATION SELECTOR-15) states the intent
 * explicitly, and `--font-symbol` (tokens.css) carries no emoji face as a
 * second line of defence. Codepoints outside the emoji set (⚥, 𝄞, ❖, ❧) take
 * no selector: appending one to a non-emoji character is meaningless at best
 * and a tofu box at worst.
 *
 * **Measurement.** `lib/glyph.ts` caches a fit per exact string, so the same
 * sign written two ways in two files is measured twice and — if only one of
 * them carries the selector — possibly against two different faces. One
 * constant, one measurement, one appearance.
 *
 * Draw them with `<Glyph>` (components/Glyph.tsx), never with a bare
 * `font-size`.
 */

/** VARIATION SELECTOR-15 — "render the preceding character as text". */
const TEXT = "︎";

export const SIGN = {
  /** ♂ MALE SIGN */
  male: `♂${TEXT}`,
  /** ♀ FEMALE SIGN */
  female: `♀${TEXT}`,
  /** ⚥ MALE AND FEMALE SIGN — not an emoji codepoint, so no selector. */
  either: "⚥",
  /** 𝄞 MUSICAL SYMBOL G CLEF */
  clef: "\u{1D11E}",
  /** ♪ EIGHTH NOTE */
  note: `♪${TEXT}`,
  /** ◀ BLACK LEFT-POINTING TRIANGLE — the codex's "previous entry". */
  prev: `◀${TEXT}`,
  /** ▶ BLACK RIGHT-POINTING TRIANGLE — the codex's "next entry". */
  next: `▶${TEXT}`,
  /** ✕ MULTIPLICATION X — "close". Not an emoji codepoint (✖ U+2716 is). */
  close: "✕",
  /** ❖ BLACK DIAMOND MINUS WHITE X — a dossier. */
  dossier: "❖",
  /** ❧ ROTATED FLORAL HEART BULLET — an article. */
  article: "❧",
  /** ✦ BLACK FOUR POINTED STAR — a source. */
  source: "✦",
  /** ✉ ENVELOPE — correspondence: the row that opens the visitors' book. */
  mail: `✉${TEXT}`,
  /** 📜 SCROLL — the fallback for an unknown document type. Deliberately the
   *  one pictograph in the set: it *is* a picture, so it keeps its colour
   *  presentation and is drawn by the emoji face on purpose. */
  scroll: "\u{1F4DC}",
} as const;

/** The sign whose ink height scales the whole gender set — see `Glyph`'s
 *  `sizedBy`. ♂ is the tallest of the three in every face that carries them,
 *  so normalising to it never enlarges a sibling past its designed size. */
export const GENDER_REF = SIGN.male;

/** Likewise for the two page-turn triangles, which must match each other
 *  exactly however the platform draws them. */
export const TURN_REF = SIGN.next;
