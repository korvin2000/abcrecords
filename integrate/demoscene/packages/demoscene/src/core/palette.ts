import { ease, TAU } from './util';

/* The manuscript's colour vocabulary, in one place. */
export const INK = '#1d1409';
export const BISTRE = '#3b2a17';
export const SEPIA = '#6b4c25';
export const GOLD_D = '#8c6a22';
export const GOLD = '#b58b34';
export const GOLD_L = '#d7bb70';
export const GOLD_P = '#eddcac';
export const BURGUNDY = '#6e1b23';
export const RUBRIC = '#8c2b2b';
export const IVORY = '#f2e6c9';
export const VELLUM = '#e8d7ae';

export const SERIF =
  '"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,' +
  '"Times New Roman",serif';

/* ------------------------------------------------------------------------ *
 * Trigonometry, once.
 * ------------------------------------------------------------------------ */

const SN = 1024;
export const SIN_MASK = SN - 1;
const SK = SN / TAU;

export const SIN = new Float32Array(SN);
export const COS = new Float32Array(SN);
/**
 * Six-bit sine. Quantised so that FOUR samples sum to exactly 0..255 -- one
 * palette index, no clamping, no branch. This is what makes the plasma inner
 * loop a single add and a single lookup.
 */
export const SIN6 = new Uint8Array(SN);

for (let i = 0; i < SN; i++) {
  const a = (i / SN) * TAU;
  SIN[i] = Math.sin(a);
  COS[i] = Math.cos(a);
  SIN6[i] = ((Math.sin(a) * 0.5 + 0.5) * 63.4999) | 0;
}

/** sin(radians) from the table. */
export function sn(r: number): number {
  return SIN[((r * SK) | 0) & SIN_MASK];
}
/** cos(radians) from the table. */
export function cs(r: number): number {
  return COS[((r * SK) | 0) & SIN_MASK];
}

/* ------------------------------------------------------------------------ *
 * The plasma ramp: bistre -> burgundy -> ochre -> gold -> ivory, packed in
 * native little-endian ABGR so a pixel is one 32-bit store.
 * ------------------------------------------------------------------------ */

function buildPalette(): Uint32Array {
  const stops: readonly [number, number, number, number][] = [
    [0, 0x7a, 0x45, 0x38],
    [46, 0x8e, 0x60, 0x38],
    [96, 0xb2, 0x8e, 0x50],
    [144, 0xd2, 0xb6, 0x82],
    [188, 0xe9, 0xd8, 0xb0],
    [224, 0xf4, 0xe9, 0xcd],
    [255, 0xfc, 0xf6, 0xe6],
  ];
  const pal = new Uint32Array(256);
  let s = 0;
  for (let i = 0; i < 256; i++) {
    while (s < stops.length - 2 && i > stops[s + 1][0]) s++;
    const a = stops[s];
    const b = stops[s + 1];
    const t = ease((i - a[0]) / (b[0] - a[0]));
    const r = (a[1] + (b[1] - a[1]) * t) | 0;
    const g = (a[2] + (b[2] - a[2]) * t) | 0;
    const bl = (a[3] + (b[3] - a[3]) * t) | 0;
    pal[i] = (255 << 24) | (bl << 16) | (g << 8) | r;
  }
  return pal;
}

export const PALETTE = buildPalette();
