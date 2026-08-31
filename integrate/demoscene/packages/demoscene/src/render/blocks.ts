import { SERIF, sn } from '../core/palette';
import { clamp, ctx2d, ease, mkCanvas } from '../core/util';

/**
 * The greeting, presented as discrete blocks rather than a running line.
 *
 * Each block is baked once, then rendered as a row of vertical slices that
 * drift in out of the mist -- from both margins at once, or from the left, or
 * from the right -- and drift back out the way they came. Slices nearest the
 * margin they enter from arrive first, so the phrase assembles toward its
 * centre instead of sliding as a rigid lump.
 *
 * Cost: one `drawImage` per slice once the block has settled, two while it is
 * still moving (the second, offset copy is what reads as blur without paying
 * for `ctx.filter`).
 */

export type BlockMode = 'both' | 'left' | 'right';

export interface BlockAsset {
  c: HTMLCanvasElement;
  /** Logical size. */
  w: number;
  h: number;
  /** Asset scale the bitmap was baked at. */
  s: number;
  mode: BlockMode;
}

const MODES: readonly BlockMode[] = ['both', 'left', 'right', 'both', 'right', 'left'];

export function bakeBlocks(texts: readonly string[], s: number, maxW: number): BlockAsset[] {
  const probe = ctx2d(mkCanvas(8, 8));
  return texts.map((text, i) => {
    /* shrink the face a little for long phrases rather than letting them
       overflow the page */
    let size = 21;
    for (;;) {
      probe.font = `500 ${size * s}px ${SERIF}`;
      if (probe.measureText(text).width <= maxW * s || size <= 12) break;
      size -= 1;
    }
    const font = `500 ${size * s}px ${SERIF}`;
    probe.font = font;
    const w = Math.ceil(probe.measureText(text).width / s) + 24;
    const h = Math.ceil(size * 1.9);

    const c = mkCanvas(w * s, h * s);
    const g = ctx2d(c);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(56,39,21,0.94)';
    g.fillText(text, (w * s) / 2, (h * s) / 2);

    return { c, w, h, s, mode: MODES[i % MODES.length] };
  });
}

/** Slice width on the page, logical px. Wider slices, fewer draw calls. */
const SLICE = 13;
/** How far a slice travels before settling. */
const TRAVEL = 210;
/** Fraction of the transition spent staggering slice arrivals. */
const STAGGER = 0.45;

/**
 * Draw one block.
 *
 * `p` is presence: 0 fully dispersed, 1 fully assembled. The caller eases it
 * up on entry and back down on exit, so the same code does both.
 */
export function drawBlock(
  g: CanvasRenderingContext2D,
  b: BlockAsset,
  cx: number,
  cy: number,
  p: number,
  alpha: number,
  t: number,
): void {
  if (alpha <= 0.002) return;
  const n = Math.max(1, Math.ceil(b.w / SLICE));
  const sliceSrc = (b.w * b.s) / n;
  const left = cx - b.w / 2;
  const top = cy - b.h / 2;
  const den = n > 1 ? n - 1 : 1;

  for (let i = 0; i < n; i++) {
    const u = i / den;
    /* which margin this slice comes from, and how far along that edge it is */
    const from: number =
      b.mode === 'left' ? -1 : b.mode === 'right' ? 1 : u < 0.5 ? -1 : 1;
    const delay = from < 0 ? u : 1 - u;

    const pi = clamp(p * (1 + STAGGER) - delay * STAGGER, 0, 1);
    if (pi <= 0.001) continue;
    const e = ease(pi);

    const dx = from * (1 - e) * TRAVEL;
    /* a little vertical drift, so the mist does not look like a shutter */
    const dy = (1 - e) * sn(t * 0.7 + i * 0.9) * 9;
    const a = alpha * e;

    const sx = i * sliceSrc;
    const dxp = left + i * SLICE + dx;

    if (e < 0.995) {
      /*
       * The smear is what the eye reads as "still condensing", so its opacity
       * must NOT fall off with the slice's own opacity -- otherwise a slice
       * that has not arrived yet is simply absent, and the phrase looks like
       * it has a hole in it rather than a wisp.
       */
      const smear = alpha * 0.34 * (1 - e);
      const off = from * 9 * (1 - e);
      g.globalAlpha = smear;
      g.drawImage(b.c, sx, 0, sliceSrc, b.c.height, dxp - off, top + dy, SLICE + 1.4, b.h);
      g.globalAlpha = smear * 0.7;
      g.drawImage(b.c, sx, 0, sliceSrc, b.c.height, dxp + off * 0.5, top + dy * 1.4, SLICE + 1.4, b.h);
    }
    g.globalAlpha = a;
    g.drawImage(b.c, sx, 0, sliceSrc, b.c.height, dxp, top + dy, SLICE + 0.9, b.h);
  }
  g.globalAlpha = 1;
}

export interface BlockTiming {
  index: number;
  /** 0..1 presence for the current block. */
  p: number;
  /** Overall opacity, so a block can fade as well as disperse. */
  alpha: number;
}

/**
 * Which block is on screen, and how far in or out it is.
 * `u` runs 0..1 across the whole presentation window.
 */
export function blockAt(u: number, count: number): BlockTiming | null {
  if (count <= 0) return null;
  const span = 1 / count;
  const idx = clamp(Math.floor(u / span), 0, count - 1);
  const local = (u - idx * span) / span; /* 0..1 within this block's slot */

  const IN = 0.26;
  const OUT = 0.74;
  let p: number;
  let alpha: number;
  if (local < IN) {
    p = local / IN;
    alpha = ease(p);
  } else if (local > OUT) {
    p = 1 - (local - OUT) / (1 - OUT);
    alpha = ease(p);
  } else {
    p = 1;
    alpha = 1;
  }
  return { index: idx, p: ease(p), alpha };
}
