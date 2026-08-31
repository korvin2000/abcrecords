import { TAU } from '../core/util';

/**
 * A wireframe lute: ~200 vertices, ~215 edges, built once.
 *
 * Edges are split into "solid" (body, neck, head, bridge) and "fine" (strings,
 * frets, rose tracery) so the renderer can batch them into four `Path2D`
 * objects by weight and depth -- the whole instrument is four `stroke()` calls.
 */

export interface LuteModel {
  v: Float32Array;
  e: Uint16Array;
  f: Uint16Array;
  n: number;
}

/** Half-width of the body at position `y` along the neck axis, -1 .. 1. */
export function bodyHalfWidth(y: number): number {
  const lower = 0.46 * Math.exp(-((y + 0.5) * (y + 0.5)) / (2 * 0.34 * 0.34));
  const upper = 0.3 * Math.exp(-((y - 0.52) * (y - 0.52)) / (2 * 0.3 * 0.3));
  const win = Math.pow(Math.max(0, 1 - Math.pow(y, 12)), 0.4);
  return (0.3 + lower + upper) * win;
}

export function buildLute(): LuteModel {
  const V: number[] = [];
  const E: number[] = [];
  const F: number[] = [];
  const v = (x: number, y: number, z: number): number => {
    V.push(x, y, z);
    return V.length / 3 - 1;
  };
  const e = (a: number, b: number) => {
    E.push(a, b);
  };
  const f = (a: number, b: number) => {
    F.push(a, b);
  };

  /* ---- body: two rings joined by struts ---- */
  const N = 46;
  const d = 0.155;
  const r0: number[] = [];
  const r1: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const y = Math.cos(a);
    const s = Math.sin(a) >= 0 ? 1 : -1;
    const x = s * bodyHalfWidth(y);
    r0.push(v(x, y, -d));
    r1.push(v(x, y, d));
  }
  for (let i = 0; i < N; i++) {
    e(r0[i], r0[(i + 1) % N]);
    e(r1[i], r1[(i + 1) % N]);
    if (i % 2 === 0) e(r0[i], r1[i]);
  }

  /* ---- neck ---- */
  const y0 = 0.99;
  const y1 = 2.44;
  const w0 = 0.125;
  const w1 = 0.098;
  const nz = 0.055;
  const nk = [
    v(-w0, y0, -nz), v(w0, y0, -nz), v(w1, y1, -nz), v(-w1, y1, -nz),
    v(-w0, y0, nz), v(w0, y0, nz), v(w1, y1, nz), v(-w1, y1, nz),
  ];
  e(nk[0], nk[1]); e(nk[1], nk[2]); e(nk[2], nk[3]); e(nk[3], nk[0]);
  e(nk[4], nk[5]); e(nk[5], nk[6]); e(nk[6], nk[7]); e(nk[7], nk[4]);
  e(nk[0], nk[4]); e(nk[1], nk[5]); e(nk[2], nk[6]); e(nk[3], nk[7]);

  /* ---- headstock, tilted back ---- */
  const hz = 0.16;
  const hy = 2.92;
  const hw = 0.145;
  const hd = [
    v(-w1, y1, -nz), v(w1, y1, -nz),
    v(hw, hy, -nz - hz), v(-hw, hy, -nz - hz),
    v(-w1, y1, nz), v(w1, y1, nz),
    v(hw, hy, nz - hz), v(-hw, hy, nz - hz),
  ];
  e(hd[0], hd[3]); e(hd[1], hd[2]); e(hd[2], hd[3]);
  e(hd[4], hd[7]); e(hd[5], hd[6]); e(hd[6], hd[7]);
  e(hd[2], hd[6]); e(hd[3], hd[7]);
  for (let i = 0; i < 3; i++) {
    const py = 2.56 + i * 0.15;
    f(v(-hw - 0.09, py, 0), v(-w1 * 0.6, py, 0));
    f(v(hw + 0.09, py, 0), v(w1 * 0.6, py, 0));
  }

  /* ---- rose ---- */
  const rc = 0.3;
  const rr = 0.185;
  const RN = 22;
  const ringA: number[] = [];
  const ringB: number[] = [];
  for (let i = 0; i < RN; i++) {
    const a = (i / RN) * TAU;
    ringA.push(v(Math.cos(a) * rr, rc + Math.sin(a) * rr, -d + 0.005));
    ringB.push(v(Math.cos(a) * rr * 0.62, rc + Math.sin(a) * rr * 0.62, -d + 0.005));
  }
  for (let i = 0; i < RN; i++) {
    f(ringA[i], ringA[(i + 1) % RN]);
    f(ringB[i], ringB[(i + 1) % RN]);
    if (i % 2 === 0) f(ringA[i], ringB[i]);
  }

  /* ---- bridge ---- */
  const by = -0.56;
  const bw = 0.19;
  const bh = 0.045;
  const bz = -d + 0.004;
  const bp = [
    v(-bw, by - bh, bz), v(bw, by - bh, bz),
    v(bw, by + bh, bz), v(-bw, by + bh, bz),
  ];
  e(bp[0], bp[1]); e(bp[1], bp[2]); e(bp[2], bp[3]); e(bp[3], bp[0]);

  /* ---- frets ---- */
  for (let i = 1; i <= 9; i++) {
    const t = 1 - Math.pow(2, -i / 12);
    const fy = y0 + (y1 - y0) * t * 1.32;
    if (fy > y1 - 0.03) break;
    const fw = w0 + (w1 - w0) * ((fy - y0) / (y1 - y0));
    f(v(-fw, fy, -nz - 0.001), v(fw, fy, -nz - 0.001));
  }

  /* ---- six courses of strings ---- */
  for (let i = 0; i < 6; i++) {
    const u = i / 5 - 0.5;
    f(v(u * 0.3, by, bz - 0.028), v(u * 0.185, 2.46, -nz - 0.022));
  }

  return {
    v: new Float32Array(V),
    e: new Uint16Array(E),
    f: new Uint16Array(F),
    n: V.length / 3,
  };
}
