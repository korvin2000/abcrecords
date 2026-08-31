/**
 * The score: 40 bars at 100 BPM, five channels, sixteen rows to the bar.
 *
 * An original setting in the baroque manner -- a praeludium of broken chords,
 * a bourrée on the circle of fifths, a phrygian tremolo after the Spanish
 * guitarists, and a canon by descent. Not a quotation of anything.
 */

const SEMI: Record<string, number> = {
  c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6,
  g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11,
};

export function midiOf(tok: string): number {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(tok);
  if (!m) return 0;
  return 12 * (parseInt(m[3], 10) + 1) + SEMI[m[1] + (m[2] ?? '')];
}

/** One bar of sixteen tokens; `-` means "no event". */
function bar(src: string): Int16Array {
  const t = src.trim().split(/\s+/);
  const out = new Int16Array(16);
  for (let i = 0; i < 16 && i < t.length; i++) out[i] = t[i] === '-' ? 0 : midiOf(t[i]);
  return out;
}

function seq(bars: readonly string[]): Int16Array {
  const out = new Int16Array(bars.length * 16);
  bars.forEach((b, i) => out.set(bar(b), i * 16));
  return out;
}

const R16 = '- - - - - - - - - - - - - - - -';

/* --- I. Praeludium (4 bars): Em Am B7 Em ------------------------------- */
const PR_HARP = [
  'e3 b3 e4 g4 b4 e5 b4 g4 e4 b3 e4 g4 b4 g4 e4 b3',
  'a2 e3 a3 c4 e4 a4 e4 c4 a3 e3 a3 c4 e4 c4 a3 e3',
  'b2 f#3 b3 d#4 f#4 a4 f#4 d#4 b3 f#3 b3 d#4 f#4 d#4 b3 f#3',
  'e3 b3 e4 g4 b4 e5 b4 g4 e4 b3 e4 g4 b4 g4 e4 b3',
];
const PR_BASS = [
  'e2 - - - - - - - - - - - - - - -',
  'a2 - - - - - - - - - - - - - - -',
  'b2 - - - - - - - - - - - - - - -',
  'e2 - - - - - - - - - - - - - - -',
];

/* --- II. Bourrée (8 bars): Em Am D G C F#dim B7 Em --------------------- */
const BO_LEAD = [
  'b4 - e5 - g5 - b5 - a5 - g5 - f#5 - e5 -',
  'a4 - c5 - e5 - a5 - g5 - f#5 - e5 - d5 -',
  'f#4 - a4 - d5 - f#5 - e5 - d5 - c#5 - b4 -',
  'g4 - b4 - d5 - g5 - f#5 - e5 - d5 - c5 -',
  'c5 - e5 - g5 - b5 - a5 - g5 - f#5 - e5 -',
  'a4 - c5 - d#5 - f#5 - a5 - f#5 - d#5 - c5 -',
  'b4 - d#5 - f#5 - a5 - b5 - a5 - f#5 - d#5 -',
  'e5 - - - - - - - g5 - f#5 - e5 - b4 -',
];
const BO_HARP = [
  'e3 - b3 - e4 - g4 - b3 - e4 - g4 - e4 -',
  'a2 - e3 - a3 - c4 - e3 - a3 - c4 - a3 -',
  'd3 - a3 - d4 - f#4 - a3 - d4 - f#4 - d4 -',
  'g2 - d3 - g3 - b3 - d3 - g3 - b3 - g3 -',
  'c3 - g3 - c4 - e4 - g3 - c4 - e4 - c4 -',
  'f#2 - c3 - f#3 - a3 - c3 - f#3 - a3 - f#3 -',
  'b2 - f#3 - b3 - d#4 - f#3 - a3 - d#4 - b3 -',
  'e3 - b3 - e4 - g4 - b3 - e4 - g4 - b4 -',
];
const BO_BASS = [
  'e2 - - - b2 - - - e3 - - - b2 - - -',
  'a2 - - - e3 - - - a2 - - - e3 - - -',
  'd3 - - - a2 - - - d3 - - - f#3 - - -',
  'g2 - - - d3 - - - g2 - - - b2 - - -',
  'c3 - - - g2 - - - c3 - - - e3 - - -',
  'f#2 - - - c3 - - - f#2 - - - a2 - - -',
  'b2 - - - f#3 - - - b2 - - - d#3 - - -',
  'e2 - - - b2 - - - e3 - - - e2 - - -',
];
const BO_ARP = [
  'e4 g4 b4 e4 g4 b4 e4 g4 b4 e4 g4 b4 e4 g4 b4 e5',
  'a3 c4 e4 a3 c4 e4 a3 c4 e4 a3 c4 e4 a3 c4 e4 a4',
  'd4 f#4 a4 d4 f#4 a4 d4 f#4 a4 d4 f#4 a4 d4 f#4 a4 d5',
  'g3 b3 d4 g3 b3 d4 g3 b3 d4 g3 b3 d4 g3 b3 d4 g4',
  'c4 e4 g4 c4 e4 g4 c4 e4 g4 c4 e4 g4 c4 e4 g4 c5',
  'f#3 a3 c4 f#3 a3 c4 f#3 a3 c4 f#3 a3 c4 f#3 a3 c4 f#4',
  'b3 d#4 f#4 b3 d#4 f#4 a3 d#4 f#4 b3 d#4 f#4 a3 d#4 f#4 b4',
  'e4 g4 b4 e4 g4 b4 e4 g4 b4 e4 g4 b4 e4 g4 b4 e5',
];
const TABOR = 'c2 - - - d2 - f#2 - c2 - - - d2 - f#2 -';
const TABOR_F = 'c2 - - - d2 - f#2 - c2 - d2 - d2 - f#2 f#2';
const BO_PERC = [TABOR, TABOR, TABOR, TABOR_F, TABOR, TABOR, TABOR, TABOR_F];

/* --- III. Tremolo andaluz (8 bars): Am G F E -------------------------- */
const TR_LEAD = [
  'a5 a5 a5 a5 a5 a5 a5 a5 a5 a5 a5 a5 a5 a5 a5 a5',
  'a5 a5 a5 a5 c6 c6 c6 c6 b5 b5 b5 b5 a5 a5 a5 a5',
  'g5 g5 g5 g5 g5 g5 g5 g5 g5 g5 g5 g5 g5 g5 g5 g5',
  'g5 g5 g5 g5 b5 b5 b5 b5 a5 a5 a5 a5 g5 g5 g5 g5',
  'f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5',
  'f5 f5 f5 f5 a5 a5 a5 a5 g5 g5 g5 g5 f5 f5 f5 f5',
  'e5 e5 e5 e5 e5 e5 e5 e5 g#5 g#5 g#5 g#5 b5 b5 b5 b5',
  'e6 e6 e6 e6 d6 d6 d6 d6 c6 c6 c6 c6 b5 b5 b5 b5',
];
const TR_HARP = [
  'a2 - e3 - a3 - e3 - a2 - e3 - a3 - e3 -',
  'a2 - e3 - a3 - e3 - a2 - e3 - a3 - c4 -',
  'g2 - d3 - g3 - d3 - g2 - d3 - g3 - d3 -',
  'g2 - d3 - g3 - d3 - g2 - d3 - g3 - b3 -',
  'f2 - c3 - f3 - c3 - f2 - c3 - f3 - c3 -',
  'f2 - c3 - f3 - c3 - f2 - c3 - f3 - a3 -',
  'e2 - b2 - e3 - b2 - e2 - b2 - e3 - g#3 -',
  'e2 - b2 - e3 - g#3 - b3 - g#3 - e3 - b2 -',
];
const TR_BASS = [
  'a2 - - - - - - - a2 - - - - - - -',
  'a2 - - - - - - - a2 - - - - - - -',
  'g2 - - - - - - - g2 - - - - - - -',
  'g2 - - - - - - - g2 - - - - - - -',
  'f2 - - - - - - - f2 - - - - - - -',
  'f2 - - - - - - - f2 - - - - - - -',
  'e2 - - - - - - - e2 - - - - - - -',
  'e2 - - - - - - - e2 - - - - - - -',
];
const SOFT = 'c2 - - - - - - - d2 - - - - - - -';
const TR_PERC = [SOFT, SOFT, SOFT, SOFT, SOFT, SOFT, SOFT, TABOR_F];

/* --- IV. Canon per descensum (8 bars): Em Bm C G Am Em Am B7 ---------- */
const CA_LEAD = [
  'b5 - - - b5 - a5 - g5 - - - f#5 - - -',
  'f#5 - - - f#5 - g5 - a5 - - - b5 - - -',
  'c6 - - - b5 - a5 - g5 - - - e5 - - -',
  'd5 - - - e5 - f#5 - g5 - - - b5 - - -',
  'a5 - - - g5 - f#5 - e5 - - - c5 - - -',
  'b4 - - - e5 - g5 - b5 - - - g5 - - -',
  'a5 - - - g5 - f#5 - e5 - d5 - c5 - b4 -',
  'b4 - d#5 - f#5 - a5 - b5 - - - - - - -',
];
const CA_HARP = [
  'e3 b3 e4 g4 b4 g4 e4 b3 e3 b3 e4 g4 b4 g4 e4 b3',
  'b2 f#3 b3 d4 f#4 d4 b3 f#3 b2 f#3 b3 d4 f#4 d4 b3 f#3',
  'c3 g3 c4 e4 g4 e4 c4 g3 c3 g3 c4 e4 g4 e4 c4 g3',
  'g2 d3 g3 b3 d4 b3 g3 d3 g2 d3 g3 b3 d4 b3 g3 d3',
  'a2 e3 a3 c4 e4 c4 a3 e3 a2 e3 a3 c4 e4 c4 a3 e3',
  'e3 b3 e4 g4 b4 g4 e4 b3 e3 b3 e4 g4 b4 g4 e4 b3',
  'a2 e3 a3 c4 e4 c4 a3 e3 a2 e3 a3 c4 e4 c4 a3 e3',
  'b2 f#3 b3 d#4 f#4 a4 f#4 d#4 b2 f#3 b3 d#4 f#4 a4 f#4 d#4',
];
const CA_BASS = [
  'e2 - - - b2 - - - e2 - - - b2 - - -',
  'b2 - - - f#3 - - - b2 - - - d3 - - -',
  'c3 - - - g3 - - - c3 - - - e3 - - -',
  'g2 - - - d3 - - - g2 - - - b2 - - -',
  'a2 - - - e3 - - - a2 - - - c3 - - -',
  'e2 - - - b2 - - - e2 - - - g2 - - -',
  'a2 - - - e3 - - - a2 - - - c3 - - -',
  'b2 - - - f#3 - - - b2 - - - a2 - - -',
];
const CA_ARP = [
  'e4 g4 b4 e4 g4 b4 e4 g4 b4 e4 g4 b4 e4 g4 b4 e5',
  'b3 d4 f#4 b3 d4 f#4 b3 d4 f#4 b3 d4 f#4 b3 d4 f#4 b4',
  'c4 e4 g4 c4 e4 g4 c4 e4 g4 c4 e4 g4 c4 e4 g4 c5',
  'g3 b3 d4 g3 b3 d4 g3 b3 d4 g3 b3 d4 g3 b3 d4 g4',
  'a3 c4 e4 a3 c4 e4 a3 c4 e4 a3 c4 e4 a3 c4 e4 a4',
  'e4 g4 b4 e4 g4 b4 e4 g4 b4 e4 g4 b4 e4 g4 b4 e5',
  'a3 c4 e4 a3 c4 e4 a3 c4 e4 a3 c4 e4 a3 c4 e4 a4',
  'b3 d#4 f#4 a4 d#4 f#4 b3 d#4 f#4 a4 d#4 f#4 b3 d#4 f#4 b4',
];
const CA_PERC = [TABOR, TABOR, TABOR, TABOR_F, TABOR, TABOR, TABOR, TABOR_F];

/* --- V. Colophon (4 bars) --------------------------------------------- */
const CO_LEAD = [
  'b5 - - - - - - - - - - - - - - -',
  'a5 - - - - - - - - - - - - - - -',
  'f#5 - - - - - - - - - - - - - - -',
  'e5 - - - - - - - - - - - - - - -',
];

export type ChannelName = 'harp' | 'lead' | 'bass' | 'arp' | 'perc';
export const CHANNELS: readonly ChannelName[] = ['harp', 'lead', 'bass', 'arp', 'perc'];

interface Section {
  id: string;
  bars: number;
  gain: number;
  harp?: readonly string[];
  lead?: readonly string[];
  bass?: readonly string[];
  arp?: readonly string[];
  perc?: readonly string[];
}

const SECTIONS: readonly Section[] = [
  { id: 'praeludium', bars: 4, gain: 0.85, harp: PR_HARP, bass: PR_BASS, lead: [R16, R16, R16, R16] },
  { id: 'bourree', bars: 8, gain: 1.0, harp: BO_HARP, bass: BO_BASS, lead: BO_LEAD },
  { id: 'bourree2', bars: 8, gain: 1.0, harp: BO_HARP, bass: BO_BASS, lead: BO_LEAD, arp: BO_ARP, perc: BO_PERC },
  { id: 'tremolo', bars: 8, gain: 0.95, harp: TR_HARP, bass: TR_BASS, lead: TR_LEAD, perc: TR_PERC },
  { id: 'canon', bars: 8, gain: 1.0, harp: CA_HARP, bass: CA_BASS, lead: CA_LEAD, arp: CA_ARP, perc: CA_PERC },
  { id: 'colophon', bars: 4, gain: 0.8, harp: PR_HARP, bass: PR_BASS, lead: CO_LEAD },
];

export interface Song {
  rows: number;
  bars: number;
  bpm: number;
  stepsPerBar: number;
  ch: Record<ChannelName, Int16Array>;
  gain: Float32Array;
}

function buildSong(): Song {
  const total = SECTIONS.reduce((n, s) => n + s.bars, 0);
  const rows = total * 16;
  const ch = {
    harp: new Int16Array(rows),
    lead: new Int16Array(rows),
    bass: new Int16Array(rows),
    arp: new Int16Array(rows),
    perc: new Int16Array(rows),
  } as Record<ChannelName, Int16Array>;
  const gain = new Float32Array(total);

  let barIndex = 0;
  for (const s of SECTIONS) {
    for (let k = 0; k < s.bars; k++) gain[barIndex + k] = s.gain;
    for (const name of CHANNELS) {
      const src = s[name];
      if (src) ch[name].set(seq(src), barIndex * 16);
    }
    barIndex += s.bars;
  }
  return { rows, bars: total, bpm: 100, stepsPerBar: 16, ch, gain };
}

export const SONG: Song = buildSong();
/** Seconds per sixteenth note. */
export const ROW_DUR = 60 / SONG.bpm / 4;
/** Seconds for one pass of the whole score (~96 s). */
export const SONG_DUR = SONG.rows * ROW_DUR;
/** Seconds per bar. */
export const BAR_DUR = ROW_DUR * SONG.stepsPerBar;
