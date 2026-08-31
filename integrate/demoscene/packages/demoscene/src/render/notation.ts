import { ctx2d, mkCanvas, spline, TAU } from '../core/util';

/**
 * Five-line stave, a real G-clef and proper oval noteheads.
 *
 * The clef is a single stroked spline rather than a filled glyph outline: a
 * quill draws a clef in one continuous stroke, and stroking a spline both
 * looks the part and lets the whole thing be authored as twenty-odd points.
 * The stroke order is the one a scribe uses -- up from the tail, over the top
 * curl, down the left, round the big bow, and inward to the spiral that sits
 * on the G line.
 */

/** Clef control points, in staff spaces, origin on the G line at the spiral. */
const CLEF_PTS: readonly number[] = [
  -0.60, 2.70,
  -0.10, 2.94,
   0.31, 2.60,
   0.37, 1.70,
   0.32, 0.62,
   0.24, -0.50,
   0.16, -1.60,
   0.12, -2.60,
   0.21, -3.36,
   0.59, -3.70,
   0.83, -3.26,
   0.70, -2.60,
   0.32, -1.94,
  -0.25, -1.22,
  -0.77, -0.54,
  -1.12, 0.24,
  -1.11, 0.98,
  -0.69, 1.43,
  -0.07, 1.49,
   0.55, 1.18,
   0.81, 0.59,
   0.72, -0.03,
   0.41, -0.49,
  -0.09, -0.60,
  -0.49, -0.29,
  -0.46, 0.15,
  -0.11, 0.39,
   0.17, 0.21,
];

/** Semitone -> diatonic degree within an octave (c d e f g a b). */
const PC_DEG = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

/** Diatonic step number; G4 (midi 67) is 32. */
export function diatonic(midi: number): number {
  const oct = Math.floor(midi / 12) - 1;
  return oct * 7 + PC_DEG[((midi % 12) + 12) % 12];
}

/** True when the pitch needs an accidental in E minor / A minor context. */
export function isSharp(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

export interface StaveMetrics {
  /** Baked bitmap of the five lines plus the clef. */
  canvas: HTMLCanvasElement;
  /** Logical width and height of that bitmap. */
  w: number;
  h: number;
  /** Logical x of the stave's left end, within the bitmap. */
  x0: number;
  /** Logical x where notes may start -- clear of the clef. */
  noteX0: number;
  /** Logical x where the stave ends. */
  x1: number;
  /** Distance between adjacent stave lines, logical px. */
  gap: number;
  /** Logical y of the G line (2nd from the bottom), within the bitmap. */
  gLineY: number;
  /** Logical y of the top and bottom lines. */
  topY: number;
  bottomY: number;
}

const LINE_INK = 'rgba(120,64,48,0.55)';
const CLEF_INK = 'rgba(38,25,12,0.86)';

/**
 * Bake the stave. `w` and `h` are logical; `s` is the asset scale.
 * Everything the note renderer needs comes back in logical units.
 */
export function bakeStave(w: number, h: number, gap: number, s: number): StaveMetrics {
  const canvas = mkCanvas(w * s, h * s);
  const g = ctx2d(canvas);
  g.scale(s, s);

  const x0 = 4;
  const x1 = w - 4;
  const topY = (h - gap * 4) / 2;
  const gLineY = topY + gap * 3;

  g.strokeStyle = LINE_INK;
  g.lineWidth = 0.9;
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const y = Math.round(topY + i * gap) + 0.5;
    g.moveTo(x0, y);
    g.lineTo(x1, y);
  }
  g.stroke();

  /* the clef, drawn about the G line */
  const cx = x0 + gap * 2.1;
  g.save();
  g.translate(cx, gLineY);
  g.scale(gap, gap);
  g.strokeStyle = CLEF_INK;
  g.lineWidth = 0.3;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  spline(g, CLEF_PTS);
  g.stroke();
  /* the small dot that terminates the tail */
  g.beginPath();
  g.arc(-0.63, 2.68, 0.2, 0, TAU);
  g.fillStyle = CLEF_INK;
  g.fill();
  g.restore();

  /* Notes start clear of the clef. The glyph reaches 0.83 staff spaces to the
     right of `cx`, a notehead is 0.66 wide, and a stem-down note hangs another
     0.6 to the left of its own centre -- so anything under ~2.1 touches the
     clef. 3.2 leaves a visible gap between the two. */
  return {
    canvas,
    w,
    h,
    x0,
    noteX0: cx + gap * 3.2,
    x1,
    gap,
    gLineY,
    topY,
    bottomY: topY + gap * 4,
  };
}

/** Where a pitch sits, in logical px relative to the stave bitmap. */
export function noteY(m: StaveMetrics, midi: number): number {
  return m.gLineY - (diatonic(midi) - 32) * (m.gap / 2);
}

export interface NoteSprites {
  /** Filled oval notehead, ink. */
  head: HTMLCanvasElement;
  /** The same head in gold, for the note just struck. */
  headFresh: HTMLCanvasElement;
  /** Logical size of the sprites. */
  w: number;
  h: number;
}

/**
 * Noteheads are baked rather than drawn per note: an ellipse plus a rotation
 * is ~30 path ops, and the stave carries up to thirty of them at once.
 */
export function bakeNoteHeads(gap: number, s: number): NoteSprites {
  const rw = gap * 0.66;
  const rh = gap * 0.46;
  const pad = 2;
  const w = rw * 2 + pad * 2;
  const h = rh * 2 + pad * 2 + 2;

  const make = (fill: string) => {
    const c = mkCanvas(w * s, h * s);
    const g = ctx2d(c);
    g.scale(s, s);
    g.translate(w / 2, h / 2);
    g.rotate(-0.34);
    g.fillStyle = fill;
    g.beginPath();
    g.ellipse(0, 0, rw, rh, 0, 0, TAU);
    g.fill();
    return c;
  };

  return {
    head: make('rgba(32,22,10,0.9)'),
    headFresh: make('#b58b34'),
    w,
    h,
  };
}
