import type { Gender } from "../types";

/**
 * What the herald block can be showing, as a closed union.
 *
 * The `tone` on each variant is what the frame styles itself from, so adding a
 * new kind of message never means touching the frame — only adding a builder
 * and one view branch.
 */

export type HeraldTone = "default" | "birth" | "mourning" | "quote";

/** The line the block opens with: the catalogue's own subtitle. */
export interface DefaultMessage {
  readonly kind: "default";
  readonly tone: "default";
}

/** "On this day, N years ago …" — a rounded anniversary of a catalogued life. */
export interface AnniversaryMessage {
  readonly kind: "anniversary";
  readonly tone: "birth" | "mourning";
  readonly event: "born" | "died";
  /** Whole years elapsed; always ≥ 1. */
  readonly years: number;
  readonly slug: string;
  readonly name: string;
  readonly gender: Gender | undefined;
}

/** A saying from `pages/quotes/quote-<lang>.json`. */
export interface QuoteMessage {
  readonly kind: "quote";
  readonly tone: "quote";
  readonly author: string;
  readonly text: string;
}

export type HeraldMessage = DefaultMessage | AnniversaryMessage | QuoteMessage;

export const DEFAULT_MESSAGE: DefaultMessage = { kind: "default", tone: "default" };

/** Stable identity for animation keys — messages are rebuilt on every
 *  language switch, so object identity is not a key. */
export function messageKey(message: HeraldMessage): string {
  switch (message.kind) {
    case "default":
      return "default";
    case "anniversary":
      return `${message.event}:${message.slug}`;
    case "quote":
      return `quote:${message.author}:${message.text.slice(0, 24)}`;
  }
}
