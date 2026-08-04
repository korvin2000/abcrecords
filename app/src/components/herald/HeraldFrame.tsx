import type { ReactNode } from "react";
import clsx from "clsx";
import { CornerOrnament } from "@/components/OrnateFrame";
import type { ToneStyle } from "./tones";

const CORNERS = [
  { pos: "left-0 top-0", flipX: false, flipY: false },
  { pos: "right-0 top-0", flipX: true, flipY: false },
  { pos: "left-0 bottom-0", flipX: false, flipY: true },
  { pos: "right-0 bottom-0", flipX: true, flipY: true },
] as const;

/**
 * The framed plaque the herald speaks from: an aged panel with a gold
 * hairline, two inner rules and the codex's four musical corners, tinted by
 * tone.
 *
 * Purely presentational and tone-driven — it never learns what kind of message
 * it holds. Note that `.herald` in index.css owns `position`, so nothing here
 * may set a Tailwind position utility on the same element (unlayered CSS beats
 * layered utilities in this project).
 */
export function HeraldFrame({ tone, children }: { tone: ToneStyle; children: ReactNode }) {
  return (
    <div className={clsx("herald", tone.frame)}>
      {CORNERS.map((c) => (
        <CornerOrnament
          key={c.pos}
          accent={tone.accent}
          flipX={c.flipX}
          flipY={c.flipY}
          className={clsx("herald-corner", c.pos)}
        />
      ))}
      <div className="herald-body">{children}</div>
    </div>
  );
}
