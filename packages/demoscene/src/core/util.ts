/** Small shared primitives. Nothing here allocates inside the render loop. */

export const TAU = Math.PI * 2;

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
/** smoothstep, clamped */
export function ease(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}
export function easeIn(t: number): number {
  t = clamp(t, 0, 1);
  return t * t;
}
export function easeOut(t: number): number {
  t = clamp(t, 0, 1);
  return 1 - (1 - t) * (1 - t);
}

export function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement, alpha = true): CanvasRenderingContext2D {
  const g = c.getContext('2d', { alpha });
  if (!g) throw new Error('2D canvas context unavailable');
  return g;
}

/** Deterministic xorshift, so parchment grain and pencil jitter never change. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * Smooth open curve through a point list (Catmull-Rom converted to cubic
 * Béziers). Used for the clef, the corner volutes and the pencil sketches --
 * hand-drawn shapes are far easier to author as a handful of points.
 */
export function spline(
  g: CanvasRenderingContext2D,
  pts: readonly number[],
  tension = 1,
): void {
  const n = pts.length / 2;
  if (n < 2) return;
  const px = (i: number) => pts[clamp(i, 0, n - 1) * 2];
  const py = (i: number) => pts[clamp(i, 0, n - 1) * 2 + 1];

  g.moveTo(px(0), py(0));
  for (let i = 0; i < n - 1; i++) {
    const x0 = px(i - 1), y0 = py(i - 1);
    const x1 = px(i), y1 = py(i);
    const x2 = px(i + 1), y2 = py(i + 1);
    const x3 = px(i + 2), y3 = py(i + 2);
    const k = tension / 6;
    g.bezierCurveTo(
      x1 + (x2 - x0) * k,
      y1 + (y2 - y0) * k,
      x2 - (x3 - x1) * k,
      y2 - (y3 - y1) * k,
      x2,
      y2,
    );
  }
}

/**
 * Cheap, convincing blur: shrink then grow with smoothing on. Two draws,
 * no `ctx.filter`, no convolution -- which matters because `ctx.filter` is
 * expensive and unevenly supported.
 */
export function softenCopy(src: HTMLCanvasElement, divisor = 7): HTMLCanvasElement {
  const w = Math.max(1, Math.round(src.width / divisor));
  const h = Math.max(1, Math.round(src.height / divisor));
  const small = mkCanvas(w, h);
  const sg = ctx2d(small);
  sg.imageSmoothingEnabled = true;
  sg.drawImage(src, 0, 0, w, h);

  const out = mkCanvas(src.width, src.height);
  const og = ctx2d(out);
  og.imageSmoothingEnabled = true;
  og.imageSmoothingQuality = 'high';
  og.drawImage(small, 0, 0, src.width, src.height);
  return out;
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Letter-spacing without depending on `ctx.letterSpacing`. */
export function spaced(s: string, wide = false): string {
  return s.split('').join(wide ? '  ' : ' ');
}

export function wrapLines(
  g: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}
