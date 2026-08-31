import { ctx2d, mkCanvas, rng, spline, TAU } from '../core/util';
import {
  PORTRAIT_GRID,
  PORTRAIT_LINES,
  PORTRAIT_TH,
  PORTRAIT_TONE,
  PORTRAIT_TW,
} from './portraitData';

/**
 * Pencil studies from the workshop notebook, in the manner of a Renaissance
 * engineer's page: a classical guitar set out on the circles that govern it,
 * a lute in plan and section, a portrait, the fan bracing of a soundboard,
 * and the fingerboard with the string divisions the frets come from.
 *
 * Each is baked once into a transparent bitmap. They are drawn at very low
 * alpha with a four-tap offset blur at draw time, which costs three extra
 * `drawImage` calls and saves keeping a second, blurred copy of every sketch
 * in memory. Nothing here runs after the first frame.
 */

export type Sketch = HTMLCanvasElement;

const INK = 'rgba(64,44,24,';

/** A stroke drawn two or three times with slight jitter, like a soft pencil. */
function pencil(
  g: CanvasRenderingContext2D,
  pts: readonly number[],
  r: () => number,
  opts: { passes?: number; jitter?: number; alpha?: number; width?: number } = {},
): void {
  const { passes = 2, jitter = 1.1, alpha = 0.5, width = 1 } = opts;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    const j: number[] = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) j[i] = pts[i] + (r() - 0.5) * jitter;
    g.strokeStyle = `${INK}${(alpha / passes + 0.06).toFixed(3)})`;
    g.lineWidth = width * (1 + (r() - 0.5) * 0.3);
    g.beginPath();
    spline(g, j);
    g.stroke();
  }
}

/**
 * The same hand, but following the points exactly instead of splining through
 * them. Everything with a corner in it -- a bridge, a pegbox, a fret -- wants
 * this; anything that curves wants `pencil`.
 */
function ruled(
  g: CanvasRenderingContext2D,
  pts: readonly number[],
  r: () => number,
  opts: { passes?: number; jitter?: number; alpha?: number; width?: number } = {},
): void {
  const { passes = 2, jitter = 0.7, alpha = 0.5, width = 1 } = opts;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    g.strokeStyle = `${INK}${(alpha / passes + 0.06).toFixed(3)})`;
    g.lineWidth = width * (1 + (r() - 0.5) * 0.3);
    g.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] + (r() - 0.5) * jitter;
      const y = pts[i + 1] + (r() - 0.5) * jitter;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
}

function pencilArc(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rad: number,
  a0: number,
  a1: number,
  r: () => number,
  opts: { passes?: number; alpha?: number; width?: number } = {},
): void {
  const { passes = 2, alpha = 0.42, width = 1 } = opts;
  const steps = Math.max(10, Math.round((Math.abs(a1 - a0) / TAU) * 48));
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  pencil(g, pts, r, { passes, alpha, width, jitter: 0.9 });
}

/** Construction dashes: the thin guide lines of a technical drawing. */
function guide(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  alpha = 0.26,
): void {
  g.save();
  g.setLineDash([5, 5]);
  g.strokeStyle = `${INK}${alpha})`;
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.restore();
}

/** A construction circle: the geometry the outline was struck from. */
function guideCircle(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rad: number,
  alpha = 0.2,
): void {
  g.save();
  g.setLineDash([4, 6]);
  g.strokeStyle = `${INK}${alpha})`;
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(cx, cy, rad, 0, TAU);
  g.stroke();
  g.restore();
}

/** A measured span, ticked at both ends. */
function dimension(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: () => number,
  tick = 5,
): void {
  ruled(g, [x0, y0, x1, y1], r, { passes: 1, alpha: 0.3, width: 0.7 });
  const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
  const dx = Math.cos(a) * tick;
  const dy = Math.sin(a) * tick;
  ruled(g, [x0 - dx, y0 - dy, x0 + dx, y0 + dy], r, { passes: 1, alpha: 0.3, width: 0.7 });
  ruled(g, [x1 - dx, y1 - dy, x1 + dx, y1 + dy], r, { passes: 1, alpha: 0.3, width: 0.7 });
}

/** Diagonal hatching inside a rectangle, as a shaded plane. */
function hatch(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  alpha: number,
): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = `${INK}${alpha})`;
  g.lineWidth = 0.6;
  g.beginPath();
  for (let i = -h; i < w + h; i += step) {
    g.moveTo(x + i, y + h);
    g.lineTo(x + i + h, y);
  }
  g.stroke();
  g.restore();
}

/**
 * Marginalia. Not text -- a hand's worth of it, at the size the page is seen
 * from, which is all that ever reads anyway. Notes were written on every plate
 * of every notebook this is pretending to come from; a plate without them
 * looks printed.
 */
function scribble(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  lines: number,
  r: () => number,
  alpha = 0.3,
): void {
  for (let l = 0; l < lines; l++) {
    const yy = y + l * 8.5;
    let cx = x + (l === 0 ? 0 : r() * 5);
    const end = x + w * (l === lines - 1 ? 0.4 + r() * 0.3 : 0.82 + r() * 0.18);
    while (cx < end) {
      const word = 7 + r() * 16;
      const pts: number[] = [];
      for (let s = 0; s <= word; s += 2.2) {
        pts.push(cx + s, yy + Math.sin((cx + s) * 2.6) * 0.9 + (r() - 0.5) * 1.9);
      }
      if (pts.length >= 4) {
        pencil(g, pts, r, { passes: 1, alpha, width: 0.75, jitter: 0.35 });
      }
      cx += word + 3 + r() * 3;
    }
  }
}

/** Equal-tempered fret distance from the nut, for a string of length `scale`. */
function fret(scale: number, n: number): number {
  return scale * (1 - Math.pow(2, -n / 12));
}

/**
 * An instrument body as a closed outline: half-widths sampled down one side,
 * mirrored back up the other. Both tables below are `u, half` pairs, `u` along
 * the body and `half` across it, each as a fraction of the body length -- the
 * form luthiers' plans are dimensioned in, so the proportions are the real
 * ones rather than whatever looked right on the canvas.
 */
function outline(table: readonly number[], cx: number, top: number, len: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < table.length; i += 2) {
    pts.push(cx + table[i + 1] * len, top + table[i] * len);
  }
  for (let i = table.length - 2; i >= 0; i -= 2) {
    pts.push(cx - table[i + 1] * len, top + table[i] * len);
  }
  return pts;
}

/* Classical guitar, after Torres: body 485 mm, lower bout 365, waist 240,
   upper bout 274, scale 650. Divide those by the body length and you get: */
const GUITAR = [
  0.000, 0.0000, 0.020, 0.1051, 0.050, 0.1626, 0.090, 0.2072, 0.140, 0.2438,
  0.190, 0.2670, 0.240, 0.2794, 0.282, 0.2825, 0.340, 0.2783, 0.400, 0.2675,
  0.460, 0.2568, 0.510, 0.2494, 0.545, 0.2475, 0.580, 0.2594, 0.620, 0.2944,
  0.660, 0.3378, 0.700, 0.3659, 0.730, 0.3760, 0.770, 0.3719, 0.810, 0.3591,
  0.850, 0.3369, 0.890, 0.3029, 0.920, 0.2660, 0.950, 0.2174, 0.970, 0.1723,
  0.985, 0.1268, 0.995, 0.0750, 1.000, 0.0000,
] as const;

/* Seven-course Renaissance lute: body 460 mm long by 330 wide, neck 270,
   pegbox 250 bent back near enough to a right angle. The body is widest a
   third of the way down and closes to the end clasp, where the ribs meet. */
const LUTE = [
  0.000, 0.2800, 0.040, 0.3170, 0.085, 0.3450, 0.140, 0.3660, 0.205, 0.3810,
  0.285, 0.3890, 0.360, 0.3900, 0.435, 0.3860, 0.510, 0.3760, 0.580, 0.3600,
  0.650, 0.3380, 0.715, 0.3100, 0.775, 0.2780, 0.830, 0.2420, 0.878, 0.2050,
  0.918, 0.1670, 0.950, 0.1300, 0.975, 0.0950, 0.991, 0.0610, 0.999, 0.0300,
  1.003, 0.0000,
] as const;

const S = 340;

/*
 * The portrait alone is baked above 340. Hatching is line work: at the size of
 * the other plates it comes out coarse enough to read as printing rather than
 * drawing. The stage passes a destination size to `drawImage`, so a larger
 * plate costs nothing per frame -- only the bake, and only once.
 */

/* ------------------------------------------------------------------------ *
 * I. The guitar, set out on its circles.
 * ------------------------------------------------------------------------ */

function sketchGuitar(): Sketch {
  const c = mkCanvas(S, S);
  const g = ctx2d(c);
  const r = rng(0x1e07);

  const ax = 124;                     /* the axis everything is struck from */
  const L = 148;                      /* body length */
  const top = 170;                    /* where the neck meets the body */
  const bot = top + L;
  const scale = L * 1.34;             /* 650 mm of string over 485 of body */
  const nut = top - scale / 2;        /* the twelfth fret is the body join */
  const holeR = L * 0.0885;
  const holeY = top + L * 0.282;
  const bridgeY = nut + scale;

  guide(g, ax, 12, ax, bot + 16);

  /* the geometry first, as it would have been struck: the two bout circles
     and the arcs that cut the waist between them */
  guideCircle(g, ax, top + L * 0.282, L * 0.2825);
  guideCircle(g, ax, top + L * 0.730, L * 0.3760);
  guideCircle(g, ax + L * 0.408, top + L * 0.545, L * 0.160, 0.17);
  guideCircle(g, ax - L * 0.408, top + L * 0.545, L * 0.160, 0.17);

  /* then the outline traced over it */
  pencil(g, outline(GUITAR, ax, top, L), r, {
    passes: 3,
    alpha: 0.62,
    width: 1.1,
    jitter: 1.1,
  });

  /* neck and fingerboard: 52 mm at the nut, 62 at the join, running on over
     the soundboard to the nineteenth fret */
  const boardEnd = holeY - holeR - 2;
  const halfAt = (y: number) => 7.9 + ((y - nut) / (top - nut)) * 1.6;
  ruled(g, [ax - halfAt(nut), nut, ax - halfAt(boardEnd), boardEnd], r, { alpha: 0.5 });
  ruled(g, [ax + halfAt(nut), nut, ax + halfAt(boardEnd), boardEnd], r, { alpha: 0.5 });
  ruled(g, [ax - halfAt(nut), nut, ax + halfAt(nut), nut], r, { alpha: 0.55, width: 1.4 });

  for (let n = 1; n <= 19; n++) {
    const y = nut + fret(scale, n);
    if (y > boardEnd) break;
    const h = halfAt(y);
    ruled(g, [ax - h, y, ax + h, y], r, {
      passes: 1,
      alpha: n === 12 ? 0.42 : 0.3,
      width: n === 12 ? 1 : 0.75,
    });
  }

  /* the head: slotted, as classical heads are, with its rollers */
  const headTop = nut - L * 0.36;
  const hw = 11;
  ruled(
    g,
    [ax - 8.4, nut, ax - hw, nut - 9, ax - hw + 0.6, headTop, ax + hw - 0.6, headTop,
      ax + hw, nut - 9, ax + 8.4, nut],
    r,
    { alpha: 0.5 },
  );
  for (const s of [-1, 1]) {
    ruled(
      g,
      [ax + s * 3.4, headTop + 7, ax + s * 7.4, headTop + 7,
        ax + s * 7.4, nut - 14, ax + s * 3.4, nut - 14, ax + s * 3.4, headTop + 7],
      r,
      { passes: 1, alpha: 0.34, width: 0.75 },
    );
    for (let i = 0; i < 3; i++) {
      const y = headTop + 12 + i * 10.5;
      ruled(g, [ax + s * 2.4, y, ax + s * 14, y], r, { passes: 1, alpha: 0.3, width: 0.8 });
      pencilArc(g, ax + s * 14, y, 2.1, 0, TAU, r, { passes: 1, alpha: 0.32, width: 0.7 });
    }
  }

  /* soundhole and rosette */
  pencilArc(g, ax, holeY, holeR, 0, TAU, r, { alpha: 0.5, width: 1 });
  pencilArc(g, ax, holeY, holeR + 4.2, 0, TAU, r, { passes: 1, alpha: 0.34, width: 0.8 });
  pencilArc(g, ax, holeY, holeR + 7.6, 0, TAU, r, { passes: 1, alpha: 0.28, width: 0.7 });
  g.strokeStyle = `${INK}0.2)`;
  g.lineWidth = 0.6;
  g.beginPath();
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    g.moveTo(ax + ca * (holeR + 4.4), holeY + sa * (holeR + 4.4));
    g.lineTo(ax + ca * (holeR + 7.4), holeY + sa * (holeR + 7.4));
  }
  g.stroke();

  /* bridge, saddle, and the six strings over both */
  const bhw = L * 0.19;
  ruled(
    g,
    [ax - bhw, bridgeY, ax - bhw * 0.66, bridgeY - 5.5, ax + bhw * 0.66, bridgeY - 5.5,
      ax + bhw, bridgeY, ax + bhw * 0.66, bridgeY + 5.5, ax - bhw * 0.66, bridgeY + 5.5,
      ax - bhw, bridgeY],
    r,
    { alpha: 0.5, width: 1.1 },
  );
  ruled(g, [ax - bhw * 0.62, bridgeY - 1.6, ax + bhw * 0.62, bridgeY - 1.6], r, {
    passes: 1,
    alpha: 0.34,
    width: 0.8,
  });
  /* six strings, drawn as strings rather than as construction */
  for (let i = 0; i < 6; i++) {
    const u = i / 5 - 0.5;
    ruled(g, [ax + u * 13.2, nut, ax + u * 18, bridgeY - 1.6], r, {
      passes: 1,
      alpha: 0.2,
      width: 0.55,
      jitter: 0.3,
    });
  }

  /* the body in section, laid off to the side: 95 mm deep, the soundboard
     flat and the back domed, as it is built */
  const sx = 236;
  const dep = L * 0.196;
  ruled(g, [sx, top, sx, bot], r, { alpha: 0.42, width: 1 });
  const back: number[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    back.push(sx + dep * (0.78 + 0.22 * Math.sin(u * Math.PI)), top + u * L);
  }
  pencil(g, back, r, { passes: 2, alpha: 0.4, width: 1 });
  ruled(g, [sx, top, sx + dep * 0.78, top], r, { passes: 1, alpha: 0.36, width: 0.9 });
  ruled(g, [sx, bot, sx + dep * 0.78, bot], r, { passes: 1, alpha: 0.36, width: 0.9 });
  hatch(g, sx + 1, top + 2, dep * 0.76, L - 4, 10, 0.07);
  dimension(g, sx - 9, top, sx - 9, bot, r);

  /* and the width of the lower bout, measured */
  dimension(g, ax - L * 0.376, bot + 12, ax + L * 0.376, bot + 12, r);
  scribble(g, 206, 40, 118, 4, r, 0.26);
  return c;
}

/* ------------------------------------------------------------------------ *
 * II. The lute, in plan and in section.
 * ------------------------------------------------------------------------ */

function sketchLute(): Sketch {
  const c = mkCanvas(S, S);
  const g = ctx2d(c);
  const r = rng(0x2b71);

  const ax = 150;
  const Lb = 134;                 /* body length */
  const top = 182;
  const bot = top + Lb;
  const neck = Lb * 0.587;
  const nut = top - neck;
  const bridgeY = top + Lb * 0.80;
  const str = bridgeY - nut;      /* sounding length */

  guide(g, ax, 34, ax, bot + 18);
  guideCircle(g, ax, top + Lb * 0.36, Lb * 0.39);

  pencil(g, outline(LUTE, ax, top, Lb).concat([ax + Lb * 0.28, top]), r, {
    passes: 3,
    alpha: 0.62,
    width: 1.1,
    jitter: 1.1,
  });
  /* the neck block: the one straight edge on the whole instrument */
  ruled(g, [ax - Lb * 0.28, top, ax + Lb * 0.28, top], r, { alpha: 0.42, width: 1 });

  /* neck, and the eight gut frets tied round it */
  const nHalf = (y: number) => 7.6 + ((y - nut) / neck) * 3.1;
  ruled(g, [ax - nHalf(nut), nut, ax - nHalf(top), top], r, { alpha: 0.5 });
  ruled(g, [ax + nHalf(nut), nut, ax + nHalf(top), top], r, { alpha: 0.5 });
  for (let n = 1; n <= 8; n++) {
    const y = nut + fret(str, n);
    const h = nHalf(y);
    ruled(g, [ax - h, y, ax + h, y], r, { passes: 1, alpha: 0.3, width: 0.8 });
  }

  /*
   * The head, drawn in line with the neck. A lute pegbox is really bent back
   * off the neck at very nearly a right angle, but swung into the page it
   * reads as an instrument that has been snapped rather than built, and put in
   * the margin as its own view it reads as one that has come apart. So it goes
   * where the eye expects it, foreshortened, with the break marked only by the
   * nut and the taper.
   */
  ruled(g, [ax - nHalf(nut), nut, ax + nHalf(nut), nut], r, { alpha: 0.55, width: 1.4 });

  const pl = Lb * 0.44;
  const pTop = nut - pl;
  const pw0 = 7.2;
  const pw1 = 5.4;
  ruled(g, [ax - pw0, nut, ax - pw1, pTop], r, { alpha: 0.48, width: 1 });
  ruled(g, [ax + pw0, nut, ax + pw1, pTop], r, { alpha: 0.48, width: 1 });
  ruled(g, [ax - pw1, pTop, ax + pw1, pTop], r, { alpha: 0.46, width: 1.1 });
  /* the string channel down the middle of the box */
  guide(g, ax - pw1 * 0.45, pTop + 4, ax - pw0 * 0.45, nut - 3, 0.2);
  guide(g, ax + pw1 * 0.45, pTop + 4, ax + pw0 * 0.45, nut - 3, 0.2);

  /* thirteen pegs for seven courses, alternating down the box */
  for (let i = 0; i < 13; i++) {
    const t = 0.1 + (i / 12) * 0.82;
    const sg = i % 2 === 0 ? 1 : -1;
    const py = nut - pl * t;
    const pw = pw0 + (pw1 - pw0) * t;
    ruled(g, [ax + sg * pw, py, ax + sg * (pw + 4.6), py], r, {
      passes: 1,
      alpha: 0.32,
      width: 0.85,
    });
    pencilArc(g, ax + sg * (pw + 5.8), py, 1.8, 0, TAU, r, {
      passes: 1,
      alpha: 0.3,
      width: 0.65,
    });
  }

  /* the rose, cut into the soundboard rather than laid on it */
  const roseY = top + Lb * 0.34;
  const roseR = 13.5;
  pencilArc(g, ax, roseY, roseR, 0, TAU, r, { alpha: 0.46, width: 1 });
  pencilArc(g, ax, roseY, roseR * 0.66, 0, TAU, r, { passes: 1, alpha: 0.3, width: 0.8 });
  g.strokeStyle = `${INK}0.24)`;
  g.lineWidth = 0.6;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const cx = ax + Math.cos(a) * roseR * 0.5;
    const cy = roseY + Math.sin(a) * roseR * 0.5;
    g.moveTo(cx + roseR * 0.5, cy);
    g.arc(cx, cy, roseR * 0.5, 0, TAU);
  }
  g.stroke();

  /* bridge, and seven courses running to it */
  ruled(
    g,
    [ax - 21, bridgeY + 2, ax - 17, bridgeY - 3, ax + 17, bridgeY - 3,
      ax + 21, bridgeY + 2],
    r,
    { alpha: 0.5, width: 1.1 },
  );
  for (let i = 0; i < 7; i++) {
    const u = i / 6 - 0.5;
    ruled(g, [ax + u * 12.4, nut, ax + u * 32, bridgeY - 3], r, {
      passes: 1,
      alpha: 0.2,
      width: 0.55,
      jitter: 0.3,
    });
  }

  /* the bowl in section: eleven ribs struck from one centre */
  const cx = 273;
  const cy = 244;
  const rad = 30;
  ruled(g, [cx - rad, cy, cx + rad, cy], r, { alpha: 0.42, width: 1 });
  pencilArc(g, cx, cy, rad, 0, Math.PI, r, { alpha: 0.46, width: 1.05 });
  pencilArc(g, cx, cy, rad - 2.6, 0, Math.PI, r, { passes: 1, alpha: 0.26, width: 0.7 });
  g.strokeStyle = `${INK}0.26)`;
  g.lineWidth = 0.7;
  g.beginPath();
  for (let i = 1; i < 11; i++) {
    const a = (i / 11) * Math.PI;
    g.moveTo(cx + Math.cos(a) * (rad - 2.6), cy + Math.sin(a) * (rad - 2.6));
    g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.stroke();
  guide(g, cx, cy - 12, cx, cy + rad + 8, 0.22);
  dimension(g, cx - rad, cy + rad + 12, cx + rad, cy + rad + 12, r);

  dimension(g, ax - Lb * 0.39, bot + 14, ax + Lb * 0.39, bot + 14, r);
  scribble(g, 20, 250, 96, 4, r, 0.26);
  return c;
}

/* ------------------------------------------------------------------------ *
 * III. The portrait.
 * ------------------------------------------------------------------------ */

/**
 * Hatching, laid across a tone map at a fixed angle: the pen crosses the whole
 * plate and touches down only where the tone is darker than this pass wants.
 * Successive passes at rising thresholds and tightening spacing build the
 * shadows the way a pen does, and every run of a pass goes into one path, so a
 * pass of two thousand strokes costs a single `stroke()`.
 */
function hatchTone(
  g: CanvasRenderingContext2D,
  tone: (x: number, y: number) => number,
  box: readonly [number, number, number, number],
  deg: number,
  spacing: number,
  level: number,
  alpha: number,
  pen: number,
  step: number,
  jit: number,
  r: () => number,
): void {
  const [bx, by, bw, bh] = box;
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const span = Math.sqrt(bw * bw + bh * bh) / 2;
  const lines = Math.ceil(span / spacing);
  const inv = 1e9;
  const ix = dx === 0 ? inv : 1 / dx;
  const iy = dy === 0 ? inv : 1 / dy;

  g.strokeStyle = `${INK}${alpha})`;
  g.lineWidth = pen;
  g.lineCap = 'round';
  g.beginPath();

  for (let i = -lines; i <= lines; i++) {
    const ox = cx - dy * i * spacing;
    const oy = cy + dx * i * spacing;

    /* clip the pen stroke to the plate before walking it: outside the plate
       there is nothing to sample, and the diagonal is two and a half times
       the plate */
    let t0 = -span * 2;
    let t1 = span * 2;
    if (dx === 0) {
      if (ox < bx || ox >= bx + bw) continue;
    } else {
      const a = (bx - ox) * ix;
      const b = (bx + bw - ox) * ix;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (dy === 0) {
      if (oy < by || oy >= by + bh) continue;
    } else {
      const a = (by - oy) * iy;
      const b = (by + bh - oy) * iy;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t1 <= t0) continue;

    let open = false;
    for (let t = t0; t <= t1; t += step) {
      const x = ox + dx * t;
      const y = oy + dy * t;
      if (tone(x, y) > level) {
        const jx = x + (r() - 0.5) * jit;
        const jy = y + (r() - 0.5) * jit;
        if (open) g.lineTo(jx, jy);
        else {
          g.moveTo(jx, jy);
          open = true;
        }
      } else {
        open = false;
      }
    }
  }
  g.stroke();
}

/**
 * A portrait study. The tone map is inlined as a few kilobytes of PNG; the
 * drawing itself is made here, at load, by hatching over it -- so it is built
 * from the same ink and the same jittered stroke as the plates around it and
 * sits in the page instead of on top of it. The bitmap it bakes into is what
 * the render loop sees, so it costs exactly what the other studies cost.
 *
 * The image decodes asynchronously. Until it does the canvas is empty, and
 * drawing an empty canvas costs nothing -- the scene it appears in is a good
 * twenty seconds away.
 */
/**
 * The line work, unpacked: a run of `x, y, n` and then `n` signed-byte steps,
 * repeated. Two bytes a point, decoded once into flat coordinate arrays. It is
 * kept in the grid it was traced in and scaled at draw time, so the plate can
 * be baked at any size.
 */
function decodeLines(b64: string): Float32Array[] {
  const bin = atob(b64);
  const out: Float32Array[] = [];
  let i = 0;
  while (i + 5 <= bin.length) {
    let x = (bin.charCodeAt(i) << 8) | bin.charCodeAt(i + 1);
    let y = (bin.charCodeAt(i + 2) << 8) | bin.charCodeAt(i + 3);
    const n = bin.charCodeAt(i + 4);
    i += 5;
    const pts = new Float32Array((n + 1) * 2);
    pts[0] = x;
    pts[1] = y;
    for (let k = 0; k < n; k++) {
      const dx = bin.charCodeAt(i++);
      const dy = bin.charCodeAt(i++);
      x += dx > 127 ? dx - 256 : dx;
      y += dy > 127 ? dy - 256 : dy;
      pts[k * 2 + 2] = x;
      pts[k * 2 + 3] = y;
    }
    out.push(pts);
  }
  return out;
}

/**
 * Every crease in one path, splined and stroked twice with a little offset --
 * the hand going over its own line, which is what makes ink look like ink.
 * Two `stroke()` calls for the lot.
 */
function strokeLines(
  g: CanvasRenderingContext2D,
  lines: readonly Float32Array[],
  x0: number,
  y0: number,
  k: number,
  pen: number,
  alpha: number,
  r: () => number,
): void {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.strokeStyle = `${INK}${alpha.toFixed(3)})`;
    g.lineWidth = pen * (pass ? 0.75 : 1);
    g.beginPath();
    for (const src of lines) {
      const pts = new Array<number>(src.length);
      for (let i = 0; i < src.length; i += 2) {
        pts[i] = x0 + src[i] * k + (r() - 0.5) * 0.7;
        pts[i + 1] = y0 + src[i + 1] * k + (r() - 0.5) * 0.7;
      }
      spline(g, pts);
    }
    g.stroke();
  }
}

/** How hard the pen is, how close it lays down, and how big the plate is. */
export interface PortraitStyle {
  size: number;
  fill: number;
  pen: number;
  step: number;
  jitter: number;
  /** pen and opacity for the traced creases laid over the hatching */
  linePen: number;
  lineAlpha: number;
  /** angle, spacing, threshold, alpha -- light to dark */
  passes: readonly (readonly [number, number, number, number])[];
}

export const PORTRAIT_STYLE: PortraitStyle = {
  size: 680,
  fill: 0.632,
  pen: 0.7,
  step: 1.2,
  jitter: 0.7,
  linePen: 0.8,
  lineAlpha: 0.19,
  passes: [
    [-62, 2.60, 0.05, 0.100],
    [-62, 2.51, 0.15, 0.120],
    [-62, 2.42, 0.25, 0.140],
    [22, 2.33, 0.35, 0.160],
    [-62, 2.24, 0.45, 0.180],
    [22, 2.16, 0.55, 0.200],
    [-62, 2.07, 0.65, 0.220],
    [78, 1.98, 0.74, 0.240],
    [-62, 1.89, 0.83, 0.260],
    [22, 1.80, 0.91, 0.280],
  ],
};

let LINES: Float32Array[] = [];

export function sketchPortrait(st: PortraitStyle = PORTRAIT_STYLE): Sketch {
  if (!LINES.length) LINES = decodeLines(PORTRAIT_LINES);
  const c = mkCanvas(st.size, st.size);
  const g = ctx2d(c);

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    /* Hatching a plate this size is tens of milliseconds of path building --
       once, but enough to cost a frame if it lands while the title is coming
       up. The scene it appears in is a good twenty seconds out, so it waits
       for the browser to be idle. Until then the canvas is empty, and drawing
       an empty canvas costs nothing. */
    const paint = () => {
      try {
        paintPortrait(g, img, st);
      } catch {
        /* a tainted or unreadable canvas costs us one study, nothing more */
      }
    };
    const ric = (window as { requestIdleCallback?: (cb: () => void) => void })
      .requestIdleCallback;
    if (ric) ric(paint);
    else setTimeout(paint, 300);
  };
  img.src = PORTRAIT_TONE;
  return c;
}

function paintPortrait(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  st: PortraitStyle,
): void {
  const PS = st.size;
  const r = rng(0x3c05);
  const TW = PORTRAIT_TW;
  const TH = PORTRAIT_TH;

  const tc = mkCanvas(TW, TH);
  const tg = ctx2d(tc);
  tg.drawImage(img, 0, 0, TW, TH);
  const px = tg.getImageData(0, 0, TW, TH).data;

  /* one plane of tone, in the plate's own coordinates */
  const map = new Float32Array(TW * TH);
  for (let i = 0; i < TW * TH; i++) map[i] = px[i * 4] / 255;

  const w = PS * st.fill;
  const h = (w * TH) / TW;
  const x0 = (PS - w) / 2;
  const y0 = (PS - h) / 2 + PS * 0.012;
  const sx = TW / w;
  const sy = TH / h;

  const tone = (x: number, y: number): number => {
    const u = (x - x0) * sx;
    const v = (y - y0) * sy;
    if (u < 0 || v < 0 || u > TW - 1.001 || v > TH - 1.001) return 0;
    const ix = u | 0;
    const iy = v | 0;
    const fx = u - ix;
    const fy = v - iy;
    const o = iy * TW + ix;
    const a = map[o] + (map[o + 1] - map[o]) * fx;
    const b = map[o + TW] + (map[o + TW + 1] - map[o + TW]) * fx;
    return a + (b - a) * fy;
  };

  const box: [number, number, number, number] = [x0, y0, w, h];
  /* the angles turn with the tone, so shadows cross-hatch instead of striping */
  const k = PS / 544;
  for (const [deg, sp, lv, al] of st.passes) {
    hatchTone(g, tone, box, deg, sp * k, lv, al, st.pen * k, st.step * k, st.jitter * k, r);
  }

  /* and the creases over the top, in the grid they were traced in */
  if (st.lineAlpha > 0) {
    strokeLines(g, LINES, x0, y0, w / PORTRAIT_GRID, st.linePen * k, st.lineAlpha, r);
  }

  /* the proportional guides a study of a head is laid out on, drawn after the
     hatching so they read as construction rather than as features */
  const cx = x0 + w * 0.5;
  guide(g, cx, y0 + h * 0.02, cx, y0 + h * 0.96, 0.13);
  for (const u of [0.17, 0.38, 0.5, 0.63, 0.76]) {
    guide(g, x0 + w * 0.06, y0 + h * u, x0 + w * 0.94, y0 + h * u, 0.11);
  }
  guideCircle(g, cx, y0 + h * 0.33, w * 0.4, 0.11);

  /* and a soft edge, so the plate lies on the parchment rather than being cut
     out of it -- one composited gradient, once */
  g.globalCompositeOperation = 'destination-out';
  const vg = g.createRadialGradient(PS / 2, PS / 2, PS * 0.27, PS / 2, PS / 2, PS * 0.54);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.7, 'rgba(0,0,0,0.5)');
  vg.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = vg;
  g.fillRect(0, 0, PS, PS);
  g.globalCompositeOperation = 'source-over';

  scribble(g, PS * 0.08, PS - 68, 150, 2, r, 0.2);
}

/* ------------------------------------------------------------------------ *
 * IV. The soundboard, and what holds it up.
 * ------------------------------------------------------------------------ */

function sketchBracing(): Sketch {
  const c = mkCanvas(S, S);
  const g = ctx2d(c);
  const r = rng(0x4d19);

  const ax = 136;
  const L = 244;
  const top = 46;
  const bot = top + L;
  const holeR = L * 0.0885;
  const holeY = top + L * 0.282;

  guide(g, ax, top - 14, ax, bot + 14);
  pencil(g, outline(GUITAR, ax, top, L), r, {
    passes: 2,
    alpha: 0.5,
    width: 1,
    jitter: 1,
  });
  pencilArc(g, ax, holeY, holeR, 0, TAU, r, { alpha: 0.44, width: 1 });
  pencilArc(g, ax, holeY, holeR + 6, 0, TAU, r, { passes: 1, alpha: 0.26, width: 0.7 });

  /* half-width of the plate at any point down it, so the bars can be run out
     to the lining instead of to a guessed rectangle */
  const half = (y: number): number => {
    const u = (y - top) / L;
    let i = 0;
    while (i < GUITAR.length - 4 && GUITAR[i + 2] < u) i += 2;
    const t = (u - GUITAR[i]) / (GUITAR[i + 2] - GUITAR[i]);
    return (GUITAR[i + 1] + (GUITAR[i + 3] - GUITAR[i + 1]) * t) * L;
  };

  /* two harmonic bars above the hole, two below it */
  const bar = (y: number, inset: number, thick: number) => {
    const hw = half(y) - inset;
    ruled(g, [ax - hw, y, ax + hw, y, ax + hw, y + thick, ax - hw, y + thick, ax - hw, y], r, {
      passes: 1,
      alpha: 0.38,
      width: 0.9,
    });
    hatch(g, ax - hw, y, hw * 2, thick, 4, 0.13);
  };
  bar(top + L * 0.115, 5, 5);
  bar(holeY - holeR - 9, 4, 5.5);
  bar(holeY + holeR + 4, 4, 5.5);

  /* the foot of the neck block, which is what the top bar is butted against */
  const nbw = L * 0.062;
  ruled(g, [ax - nbw, top + 2, ax + nbw, top + 2, ax + nbw, top + L * 0.09,
    ax - nbw, top + L * 0.09, ax - nbw, top + 2], r, {
    passes: 1,
    alpha: 0.34,
    width: 0.9,
  });
  hatch(g, ax - nbw, top + 2, nbw * 2, L * 0.09 - 2, 4, 0.12);

  /* the fan: seven struts let into the bar under the hole, spread along it
     rather than sprung from one point, and splaying out to the lining */
  const fanY = holeY + holeR + 11;
  for (let i = -3; i <= 3; i++) {
    const a = (i / 3) * 0.54;
    const ox = ax + i * 4.6;
    const len = L * (0.46 - Math.abs(i) * 0.028);
    ruled(g, [ox, fanY, ox + Math.sin(a) * len, fanY + Math.cos(a) * len], r, {
      passes: 1,
      alpha: 0.36,
      width: i === 0 ? 1.1 : 0.95,
    });
  }
  /* the two closing bars, short, across the corners the fan leaves open */
  for (const sg of [-1, 1]) {
    const y0 = bot - L * 0.155;
    const y1 = bot - L * 0.075;
    ruled(g, [ax + sg * L * 0.15, y0, ax + sg * (half(y1) - 7), y1], r, {
      passes: 1,
      alpha: 0.3,
      width: 0.85,
    });
  }

  /* the bridge plate, dashed because it is under the top */
  const bY = top + L * 0.669;
  const bhw = L * 0.19;
  g.save();
  g.setLineDash([5, 4]);
  g.strokeStyle = `${INK}0.3)`;
  g.lineWidth = 0.8;
  g.strokeRect(ax - bhw, bY - 7, bhw * 2, 14);
  g.restore();

  dimension(g, ax - L * 0.376, bot + 14, ax + L * 0.376, bot + 14, r);
  dimension(g, ax - half(holeY) - 12, top, ax - half(holeY) - 12, bot, r);
  scribble(g, 250, 96, 78, 5, r, 0.26);
  scribble(g, 246, 250, 82, 3, r, 0.24);
  return c;
}

/* ------------------------------------------------------------------------ *
 * V. The fingerboard, and the divisions the frets come from.
 * ------------------------------------------------------------------------ */

function sketchFretboard(): Sketch {
  const c = mkCanvas(S, S);
  const g = ctx2d(c);
  const r = rng(0x5f21);

  const x0 = 30;
  const x1 = 314;
  const scale = x1 - x0;
  const bY = 158;
  const bH = 46;

  /* the open string, and the first three modes standing on it */
  for (let mode = 1; mode <= 3; mode++) {
    const y = 118 - (mode - 1) * 34;
    const amp = 12 - mode * 1.4;
    for (const s of [1, -1]) {
      const pts: number[] = [];
      for (let i = 0; i <= 56; i++) {
        const u = i / 56;
        pts.push(x0 + scale * u, y - s * Math.sin(u * Math.PI * mode) * amp);
      }
      pencil(g, pts, r, { passes: s > 0 ? 2 : 1, alpha: s > 0 ? 0.32 : 0.2, width: 0.85, jitter: 0.6 });
    }
    guide(g, x0, y, x1, y, 0.2);
    for (let k = 1; k < mode; k++) {
      pencilArc(g, x0 + (scale * k) / mode, y, 2.4, 0, TAU, r, {
        passes: 1,
        alpha: 0.38,
        width: 0.8,
      });
    }
  }
  ruled(g, [x0, 46, x0, 132], r, { alpha: 0.44, width: 1.2 });
  ruled(g, [x1, 46, x1, 132], r, { alpha: 0.44, width: 1.2 });

  /* the fingerboard under them: nut at the left, the string stopped at each
     fret, the frets where equal temperament puts them */
  ruled(g, [x0, bY, x1 - 46, bY], r, { alpha: 0.5 });
  ruled(g, [x0, bY + bH, x1 - 46, bY + bH], r, { alpha: 0.5 });
  ruled(g, [x0, bY - 3, x0, bY + bH + 3], r, { alpha: 0.55, width: 1.6 });

  const dots = [3, 5, 7, 9, 15, 17, 19];
  for (let n = 1; n <= 19; n++) {
    const x = x0 + fret(scale, n);
    ruled(g, [x, bY, x, bY + bH], r, {
      passes: 1,
      alpha: n === 12 ? 0.42 : 0.3,
      width: n === 12 ? 1.1 : 0.8,
    });
    const prev = x0 + fret(scale, n - 1);
    const mid = (x + prev) / 2;
    if (dots.indexOf(n) >= 0) {
      pencilArc(g, mid, bY + bH / 2, 2.6, 0, TAU, r, { passes: 1, alpha: 0.34, width: 0.8 });
    } else if (n === 12) {
      pencilArc(g, mid, bY + bH * 0.3, 2.6, 0, TAU, r, { passes: 1, alpha: 0.34, width: 0.8 });
      pencilArc(g, mid, bY + bH * 0.7, 2.6, 0, TAU, r, { passes: 1, alpha: 0.34, width: 0.8 });
    }
  }
  for (let i = 0; i < 6; i++) {
    const y = bY + 5 + (i * (bH - 10)) / 5;
    guide(g, x0, y, x1, y, 0.17);
  }

  /* the consonances, dropped from the string onto the frets they fall on:
     the half, the two thirds, the three quarters, the four fifths */
  const ratios: readonly [number, number][] = [[0.5, 12], [2 / 3, 7], [0.75, 5], [0.8, 4]];
  for (const [p, n] of ratios) {
    const x = x0 + scale * (1 - p);
    guide(g, x, 46, x, bY + bH + 26, 0.28);
    pencilArc(g, x, 118, 3.2, 0, TAU, r, { passes: 1, alpha: 0.42, width: 0.9 });
    const fx = x0 + fret(scale, n);
    if (Math.abs(fx - x) > 1.2) guide(g, x, bY + bH + 12, fx, bY + bH + 26, 0.24);
    dimension(g, x0, bY + bH + 34, x, bY + bH + 34, r, 4);
  }

  scribble(g, 34, bY + bH + 56, 250, 4, r, 0.24);
  return c;
}

export function bakeSketches(): Sketch[] {
  return [sketchGuitar(), sketchLute(), sketchPortrait(), sketchBracing(), sketchFretboard()];
}

/** Logical size the sketches are authored at. */
export const SKETCH_SIZE = S;
