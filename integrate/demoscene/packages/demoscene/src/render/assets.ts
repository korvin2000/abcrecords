import type { ResolvedContent } from '../types';
import { BURGUNDY, GOLD, GOLD_D, SERIF } from '../core/palette';
import {
  ctx2d,
  ease,
  mkCanvas,
  rng,
  roundRect,
  spaced,
  spline,
  TAU,
  wrapLines,
} from '../core/util';

/** Authoring resolution of the stage. Everything is laid out in these units. */
export const LW = 960;
export const LH = 430;
/** Default asset scale: 1:1 on a 1920-pixel-wide stage. */
export const AS = 2;

export interface Sprite {
  c: HTMLCanvasElement;
  w: number;
  h: number;
  s: number;
}

/* ---------------------------------------------------------------- ground */

export function bakeParchment(): HTMLCanvasElement {
  const w = 512;
  const h = 230;
  const c = mkCanvas(w, h);
  const g = ctx2d(c, false);
  const r = rng(0xc0dec5);

  g.fillStyle = '#f5ecd6';
  g.fillRect(0, 0, w, h);

  for (let i = 0; i < 46; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 26 + r() * 96;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.42;
    grd.addColorStop(0, dark ? 'rgba(120,88,42,0.055)' : 'rgba(255,250,232,0.20)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, TAU);
    g.fill();
  }

  g.lineWidth = 0.6;
  for (let i = 0; i < 150; i++) {
    const x = r() * w;
    const y = r() * h;
    g.strokeStyle = `rgba(150,120,70,${(0.03 + r() * 0.05).toFixed(3)})`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 12);
    g.stroke();
  }

  const vig = g.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, w * 0.62);
  vig.addColorStop(0, 'rgba(74,52,22,0)');
  vig.addColorStop(1, 'rgba(74,52,22,0.155)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
  return c;
}

export function bakeRadial(size: number, inner: string, outer: string): HTMLCanvasElement {
  const c = mkCanvas(size, size);
  const g = ctx2d(c);
  const h = size / 2;
  const grd = g.createRadialGradient(h, h, 0, h, h, h);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.45, outer);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

/* -------------------------------------------------------------- ornament */

export function bakeRosette(): HTMLCanvasElement {
  const S = 512;
  const c = mkCanvas(S, S);
  const g = ctx2d(c);
  g.translate(S / 2, S / 2);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  g.strokeStyle = GOLD;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, 236, 0, TAU);
  g.stroke();
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(0, 0, 224, 0, TAU);
  g.stroke();
  g.strokeStyle = GOLD_D;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 168, 0, TAU);
  g.stroke();

  g.strokeStyle = GOLD;
  g.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const cx = Math.cos(a);
    const sy = Math.sin(a);
    g.beginPath();
    g.moveTo(cx * 88, sy * 88);
    g.lineTo(cx * 222, sy * 222);
    g.stroke();
    g.beginPath();
    g.arc(cx * 196, sy * 196, 22, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(cx * 128, sy * 128, 11, 0, TAU);
    g.stroke();
  }

  g.strokeStyle = 'rgba(140,43,43,0.62)';
  g.lineWidth = 3.4;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    g.beginPath();
    g.arc(Math.cos(a) * 42, Math.sin(a) * 42, 34, 0, TAU);
    g.stroke();
  }
  g.strokeStyle = '#d7bb70';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 30, 0, TAU);
  g.stroke();
  return c;
}

/** Seamless 128px lattice for the rotozoomer. */
export function bakeTile(): HTMLCanvasElement {
  const S = 128;
  const c = mkCanvas(S, S);
  const g = ctx2d(c);
  g.strokeStyle = 'rgba(140,106,34,0.55)';
  g.lineWidth = 1.4;
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(i * 64 - 64, -64);
    g.lineTo(i * 64 + 192, 192);
    g.stroke();
    g.beginPath();
    g.moveTo(i * 64 - 64, 192);
    g.lineTo(i * 64 + 192, -64);
    g.stroke();
  }
  const nodes: readonly [number, number][] = [
    [0, 0], [128, 0], [0, 128], [128, 128], [64, 64],
  ];
  for (const [x, y] of nodes) {
    g.strokeStyle = 'rgba(110,27,35,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 9, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(181,139,52,0.75)';
    g.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      g.beginPath();
      g.arc(x + Math.cos(a) * 15, y + Math.sin(a) * 15, 6.5, 0, TAU);
      g.stroke();
    }
  }
  return c;
}

export function bakeSeal(): HTMLCanvasElement {
  const S = 320;
  const c = mkCanvas(S, S);
  const g = ctx2d(c);
  g.translate(S / 2, S / 2);

  const r0 = rng(0x5ea1);
  g.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * TAU;
    const rr =
      126 + Math.sin(a * 7) * 5 + Math.sin(a * 3 + 1.2) * 7 + (r0() - 0.5) * 4;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  const grd = g.createRadialGradient(-34, -40, 12, 0, 0, 140);
  grd.addColorStop(0, '#98333a');
  grd.addColorStop(0.55, '#7a2029');
  grd.addColorStop(1, '#4d1119');
  g.fillStyle = grd;
  g.fill();
  g.strokeStyle = 'rgba(40,10,14,0.55)';
  g.lineWidth = 2.5;
  g.stroke();

  g.strokeStyle = 'rgba(48,12,16,0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 100, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(226,180,132,0.30)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(0, 0, 94, 0, TAU);
  g.stroke();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    g.strokeStyle = 'rgba(40,10,14,0.4)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 104, Math.sin(a) * 104);
    g.lineTo(Math.cos(a) * 116, Math.sin(a) * 116);
    g.stroke();
  }

  /* an impressed lyre, drawn rather than set as a glyph */
  g.strokeStyle = 'rgba(238,205,160,0.66)';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  spline(g, [-40, 44, -44, 4, -30, -30, -12, -46]);
  g.stroke();
  g.beginPath();
  spline(g, [40, 44, 44, 4, 30, -30, 12, -46]);
  g.stroke();
  g.beginPath();
  g.moveTo(-40, 44);
  g.lineTo(40, 44);
  g.stroke();
  g.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const x = -24 + i * 12;
    g.beginPath();
    g.moveTo(x, 40);
    g.lineTo(x * 0.62, -40);
    g.stroke();
  }
  return c;
}

export function bakeGoldPlate(w: number, h: number, s = AS): HTMLCanvasElement {
  const c = mkCanvas(w * s, h * s);
  const g = ctx2d(c);
  const grd = g.createLinearGradient(0, 0, 0, h * s);
  grd.addColorStop(0.0, '#c9a54a');
  grd.addColorStop(0.26, '#9a7328');
  grd.addColorStop(0.46, '#6d4f1d');
  grd.addColorStop(0.55, '#e2c987');
  grd.addColorStop(0.74, '#8c6a22');
  grd.addColorStop(1.0, '#a8812f');
  g.fillStyle = grd;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function bakeSweep(h: number, s = AS): HTMLCanvasElement {
  const w = 260 * s;
  const c = mkCanvas(w, h * s);
  const g = ctx2d(c);
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0.0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.42, 'rgba(120,96,42,0.10)');
  grd.addColorStop(0.5, 'rgba(255,246,214,0.75)');
  grd.addColorStop(0.58, 'rgba(120,96,42,0.10)');
  grd.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, c.height);
  return c;
}

export function bakeRibbon(): HTMLCanvasElement {
  const h = 44 * AS;
  const c = mkCanvas(4, h);
  const g = ctx2d(c);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0.0, 'rgba(181,139,52,0)');
  grd.addColorStop(0.22, 'rgba(160,120,44,0.30)');
  grd.addColorStop(0.46, 'rgba(233,213,160,0.62)');
  grd.addColorStop(0.54, 'rgba(255,248,224,0.72)');
  grd.addColorStop(0.76, 'rgba(140,43,43,0.26)');
  grd.addColorStop(1.0, 'rgba(110,27,35,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, h);
  return c;
}

/* ------------------------------------------------------------------ text */

export interface TextMask extends Sprite {
  shade: HTMLCanvasElement | null;
}

export function bakeTextMask(
  text: string,
  size: number,
  weight = '400',
  track: 0 | 1 | 2 = 0,
  shade = false,
): TextMask {
  const probe = ctx2d(mkCanvas(8, 8));
  const font = `${weight} ${size * AS}px ${SERIF}`;
  probe.font = font;
  const t = track ? spaced(text, track === 2) : text;
  const w = Math.ceil(probe.measureText(t).width) + 40 * AS;
  const h = Math.ceil(size * AS * 1.7);

  const c = mkCanvas(w, h);
  const g = ctx2d(c);
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.fillText(t, w / 2, h / 2);

  let sc: HTMLCanvasElement | null = null;
  if (shade) {
    sc = mkCanvas(w, h);
    const sg = ctx2d(sc);
    sg.font = font;
    sg.textAlign = 'center';
    sg.textBaseline = 'middle';
    sg.fillStyle = 'rgba(72,50,24,0.42)';
    sg.fillText(t, w / 2, h / 2);
  }
  return { c, shade: sc, w: w / AS, h: h / AS, s: AS };
}

export interface Dropcap {
  c: HTMLCanvasElement;
  size: number;
}

export function bakeDropcap(letter: string): Dropcap {
  const S = 132 * AS;
  const c = mkCanvas(S, S);
  const g = ctx2d(c);
  const pad = 6 * AS;

  g.fillStyle = BURGUNDY;
  roundRect(g, pad, pad, S - pad * 2, S - pad * 2, 8 * AS);
  g.fill();
  g.strokeStyle = GOLD;
  g.lineWidth = 2.4 * AS;
  roundRect(g, pad, pad, S - pad * 2, S - pad * 2, 8 * AS);
  g.stroke();
  g.strokeStyle = 'rgba(215,187,112,0.55)';
  g.lineWidth = 1 * AS;
  roundRect(g, pad + 7 * AS, pad + 7 * AS, S - pad * 2 - 14 * AS, S - pad * 2 - 14 * AS, 5 * AS);
  g.stroke();

  g.strokeStyle = 'rgba(215,187,112,0.62)';
  g.lineWidth = 1.6 * AS;
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate((i / 4) * TAU);
    g.translate(-S / 2, -S / 2);
    g.beginPath();
    g.moveTo(pad + 12 * AS, pad + 12 * AS);
    g.bezierCurveTo(
      pad + 34 * AS, pad + 10 * AS,
      pad + 40 * AS, pad + 26 * AS,
      pad + 26 * AS, pad + 30 * AS,
    );
    g.stroke();
    g.beginPath();
    g.arc(pad + 27 * AS, pad + 24 * AS, 3.2 * AS, 0, TAU);
    g.stroke();
    g.restore();
  }

  const grd = g.createLinearGradient(0, pad, 0, S - pad);
  grd.addColorStop(0, '#f0dfae');
  grd.addColorStop(0.45, '#d7bb70');
  grd.addColorStop(0.55, '#b58b34');
  grd.addColorStop(1, '#e6cf94');
  g.fillStyle = grd;
  g.font = `700 ${92 * AS}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, S / 2, S / 2 + 4 * AS);
  return { c, size: S / AS };
}

export interface Roll {
  c: HTMLCanvasElement;
  /** Logical width and height. */
  w: number;
  h: number;
  s: number;
}

/** The credit roll: one tall bitmap, composed once, in logical units * `s`. */
export function bakeRoll(cfg: ResolvedContent, s: number): Roll {
  const LWID = 660;
  const W = LWID * s;
  const probe = ctx2d(mkCanvas(8, 8));

  const F_WORK = `600 ${34 * s}px ${SERIF}`;
  const F_DED = `italic ${17 * s}px ${SERIF}`;
  const F_ROLE = `600 ${15 * s}px ${SERIF}`;
  const F_SUB = `italic ${14 * s}px ${SERIF}`;
  const F_NAME = `${25 * s}px ${SERIF}`;
  const F_SEP = `${17 * s}px ${SERIF}`;
  const F_COLO = `${15 * s}px ${SERIF}`;
  const F_EDN = `italic ${16 * s}px ${SERIF}`;
  const LH_DED = 23 * s;
  const LH_COLO = 21 * s;

  interface Row {
    k: string;
    h: number;
    t?: string;
    lines?: string[];
  }
  const rows: Row[] = [{ k: 'gap', h: 40 * s }];
  rows.push({ k: 'work', h: 55 * s, t: cfg.work });
  rows.push({ k: 'rule', h: 34 * s });

  probe.font = F_DED;
  const dl = wrapLines(probe, cfg.dedication, W - 90 * s);
  rows.push({ k: 'ded', h: dl.length * LH_DED + 20 * s, lines: dl });
  rows.push({ k: 'rule', h: 40 * s });

  for (const cr of cfg.credits) {
    rows.push({ k: 'role', h: 31 * s, t: cr.role });
    if (cr.sub) rows.push({ k: 'sub', h: 24 * s, t: cr.sub });
    for (const nm of cr.names) rows.push({ k: 'name', h: 36 * s, t: nm });
    rows.push({ k: 'sep', h: 40 * s });
  }

  rows.push({ k: 'rule', h: 42 * s });
  probe.font = F_COLO;
  const cl = wrapLines(probe, cfg.colophon, W - 110 * s);
  rows.push({ k: 'colo', h: cl.length * LH_COLO + 25 * s, lines: cl });
  rows.push({ k: 'edition', h: 45 * s, t: cfg.edition });
  rows.push({ k: 'gap', h: 55 * s });

  const total = rows.reduce((n, r) => n + r.h, 0);

  const c = mkCanvas(W, Math.ceil(total));
  const g = ctx2d(c);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cx = W / 2;
  let y = 0;

  const rule = (yy: number, halfw: number) => {
    const gap = 8 * s;
    const lz = 4 * s;
    g.strokeStyle = 'rgba(140,106,34,0.55)';
    g.lineWidth = 0.8 * s;
    g.beginPath();
    g.moveTo(cx - halfw, yy + 0.5);
    g.lineTo(cx - gap, yy + 0.5);
    g.moveTo(cx + gap, yy + 0.5);
    g.lineTo(cx + halfw, yy + 0.5);
    g.stroke();
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(cx, yy - lz * 1.7);
    g.lineTo(cx + lz * 2, yy);
    g.lineTo(cx, yy + lz * 1.7);
    g.lineTo(cx - lz * 2, yy);
    g.closePath();
    g.fill();
  };

  for (const rw of rows) {
    const my = y + rw.h / 2;
    switch (rw.k) {
      case 'work':
        g.font = F_WORK;
        g.fillStyle = BURGUNDY;
        g.fillText(spaced(rw.t ?? '', false), cx, my);
        break;
      case 'rule':
        rule(my, W * 0.33);
        break;
      case 'ded':
        g.font = F_DED;
        g.fillStyle = 'rgba(59,42,23,0.86)';
        (rw.lines ?? []).forEach((ln, j) => g.fillText(ln, cx, y + 13 * s + j * LH_DED));
        break;
      case 'role':
        g.font = F_ROLE;
        g.fillStyle = 'rgba(140,43,43,0.95)';
        g.fillText(spaced(rw.t ?? '', true), cx, my);
        break;
      case 'sub':
        g.font = F_SUB;
        g.fillStyle = 'rgba(107,76,37,0.82)';
        g.fillText(rw.t ?? '', cx, my);
        break;
      case 'name':
        g.font = F_NAME;
        g.fillStyle = '#2b1e10';
        g.fillText(rw.t ?? '', cx, my);
        break;
      case 'sep':
        g.font = F_SEP;
        g.fillStyle = 'rgba(140,106,34,0.75)';
        g.fillText('❦', cx, my);
        break;
      case 'colo':
        g.font = F_COLO;
        g.fillStyle = 'rgba(59,42,23,0.78)';
        (rw.lines ?? []).forEach((ln, j) => g.fillText(ln, cx, y + 14 * s + j * LH_COLO));
        break;
      case 'edition':
        g.font = F_EDN;
        g.fillStyle = 'rgba(107,76,37,0.92)';
        g.fillText(rw.t ?? '', cx, my);
        break;
      default:
        break;
    }
    y += rw.h;
  }

  return { c, w: LWID, h: total / s, s };
}

export { ease };
