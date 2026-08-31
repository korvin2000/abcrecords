import type { HeraldTone } from "@/lib/herald";
import type { MsgKey } from "@/lib/messages";

/**
 * Everything that varies by tone, in one static table.
 *
 * A lookup rather than conditionals in the components: the frame, the
 * ornaments and the label all read the same row, so a new tone is one entry
 * here plus its CSS class — no `if (tone === …)` sprinkled across three files.
 * Class names are literal strings so Tailwind's scanner and the `.herald--*`
 * rules in index.css can both see them.
 */
export interface ToneStyle {
  /** Modifier class on the frame (paired with `.herald` in index.css). */
  readonly frame: string;
  /** Colour for the four corner ornaments and the rules. */
  readonly accent: string;
  /** Glyph before the label. */
  readonly glyph: string;
  /** Glyph after it — given separately so a directional pair (❝ … ❞) reads
   *  correctly; the symmetric tones simply repeat their own. */
  readonly glyphEnd: string;
  /** Small caps label above the message; null for the plain opening line. */
  readonly label: MsgKey | null;
  readonly labelClass: string;
  readonly textClass: string;
}

export const TONES: Record<HeraldTone, ToneStyle> = {
  default: {
    frame: "herald--default",
    accent: "#b8902a",
    glyph: "✦",
    glyphEnd: "✦",
    label: null,
    labelClass: "text-sepia-600/80",
    textClass: "text-sepia-600",
  },
  birth: {
    frame: "herald--birth",
    accent: "#d4af37",
    glyph: "✧",
    glyphEnd: "✧",
    label: "herald.label.born",
    labelClass: "text-gold-800",
    textClass: "text-ink-800",
  },
  mourning: {
    frame: "herald--mourning",
    accent: "#7a1f2b",
    glyph: "❦",
    glyphEnd: "❦",
    label: "herald.label.died",
    labelClass: "text-burgundy-700/85",
    textClass: "text-ink-800",
  },
  quote: {
    frame: "herald--quote",
    accent: "#8a6a1f",
    glyph: "❝",
    glyphEnd: "❞",
    label: "herald.label.quote",
    labelClass: "text-sepia-600/85",
    textClass: "text-sepia-700",
  },
};
