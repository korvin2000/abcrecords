import type { ResolvedContent } from '../types';
import {
  BURGUNDY,
  cs,
  GOLD,
  GOLD_D,
  GOLD_L,
  PALETTE,
  SEPIA,
  SIN6,
  SIN_MASK,
  sn,
} from '../core/palette';
import { clamp, ctx2d, ease, mkCanvas, rng, roundRect, TAU } from '../core/util';
import { CH_BASS, CH_LEAD, CH_PERC, Chiptune } from '../audio/Chiptune';
import { BAR_DUR, SONG } from '../audio/score';
import {
  AS,
  bakeDropcap,
  bakeGoldPlate,
  bakeParchment,
  bakeRadial,
  bakeRibbon,
  bakeRoll,
  bakeRosette,
  bakeSeal,
  bakeSweep,
  bakeTextMask,
  bakeTile,
  LH,
  LW,
  type Dropcap,
  type Roll,
  type TextMask,
} from './assets';
import { bakeNoteHeads, bakeStave, noteY, type NoteSprites, type StaveMetrics } from './notation';
import { bakeSketches, SKETCH_SIZE, type Sketch } from './sketches';
import { bakeBlocks, blockAt, drawBlock, type BlockAsset } from './blocks';
import { buildLute, type LuteModel } from './lute';

/* Scene boundaries, in bars of the score. */
const SC = {
  TITLE: [0, 4],
  LUTE: [4, 12],
  ROLL: [12, 28],
  ROSE: [28, 36],
  SEAL: [36, 40],
} as const;

/* Stave placement on the stage, logical. */
const STAVE_X = 78;
const STAVE_Y = 268;
const STAVE_W = 804;
const STAVE_H = 80;
const STAVE_GAP = 9;

function windowAlpha(bar: number, a: number, b: number, fi: number, fo: number): number {
  if (bar <= a || bar >= b) return 0;
  const i = fi ? ease((bar - a) / fi) : 1;
  const o = fo ? ease((b - bar) / fo) : 1;
  return i < o ? i : o;
}

interface Assets {
  parchment: HTMLCanvasElement;
  mote: HTMLCanvasElement;
  halo: HTMLCanvasElement;
  rosette: HTMLCanvasElement;
  tile: HTMLCanvasElement;
  seal: HTMLCanvasElement;
  ribbon: HTMLCanvasElement;
  pattern: CanvasPattern | null;
  stave: StaveMetrics;
  notes: NoteSprites;
  sketches: Sketch[];
  roll: Roll;
  blocks: BlockAsset[];
  title: TextMask;
  subtitle: TextMask;
  edition: TextMask;
  banner: TextMask;
  finis: TextMask;
  dropcap: Dropcap;
  plate: HTMLCanvasElement;
  sweep: HTMLCanvasElement;
  scratch: HTMLCanvasElement;
  sg: CanvasRenderingContext2D;
}

/**
 * One canvas, one requestAnimationFrame loop, one adaptive governor.
 * Everything is authored in a 960x430 logical space; the canvas transform
 * does the rest, so no layout arithmetic runs per frame.
 */
export class Stage {
  private g: CanvasRenderingContext2D;
  private A!: Assets;
  private lute: LuteModel;
  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;

  W = 1;
  H = 1;
  S = 1;
  private oy = 0;
  private frameNo = 0;
  ema = 16;
  private qLock = 0;
  private upgrades = 2;
  quality = 2;
  pulse = 0;
  lead = 0;

  /** Notes written on the stave: flat `[x, midi, ...]`. */
  staveNotes: number[] = [];
  staveX = 0;

  private raf = 0;
  running = false;
  private lastT = 0;

  /* quality-tier state */
  pw = 192;
  ph = 86;
  private pstride = 1;
  private pcan!: HTMLCanvasElement;
  private pctx!: CanvasRenderingContext2D;
  private pimg!: ImageData;
  private p32!: Uint32Array;
  private tx!: Uint8Array;
  private ty!: Uint8Array;
  private rings = 9;
  private band = 6;
  private motes!: Float32Array;
  nMotes = 92;
  private pdirty = true;

  rollScale = 1;
  ui = 1;
  blockH = 44;
  blockY = LH - 36;
  footTop = LH - 66;

  constructor(
    private cv: HTMLCanvasElement,
    private cfg: ResolvedContent,
    private tune: Chiptune,
    private maxDpr = 1.6,
  ) {
    this.g = ctx2d(cv, false);
    this.lute = buildLute();
    this.px = new Float32Array(this.lute.n);
    this.py = new Float32Array(this.lute.n);
    this.pz = new Float32Array(this.lute.n);
    this.bake();
    this.setQuality(2);
    this.layout();
  }

  /* ------------------------------------------------------------- baking */

  private bake(): void {
    const cfg = this.cfg;
    const stave = bakeStave(STAVE_W, STAVE_H, STAVE_GAP, AS);
    const A: Assets = {
      parchment: bakeParchment(),
      mote: bakeRadial(24, 'rgba(255,244,208,0.95)', 'rgba(206,166,84,0.35)'),
      halo: bakeRadial(256, 'rgba(255,236,186,0.42)', 'rgba(196,150,68,0.13)'),
      rosette: bakeRosette(),
      tile: bakeTile(),
      seal: bakeSeal(),
      ribbon: bakeRibbon(),
      pattern: null,
      stave,
      notes: bakeNoteHeads(STAVE_GAP, AS),
      sketches: bakeSketches(),
      roll: bakeRoll(cfg, this.rollScale),
      blocks: bakeBlocks(cfg.blocks, this.rollScale, 640),
      title: bakeTextMask(cfg.title, 46, '400', 0, true),
      subtitle: bakeTextMask(cfg.subtitle, 17, '400', 0),
      edition: bakeTextMask(cfg.edition, 15, '400', 0),
      banner: bakeTextMask(cfg.work, 38, '600', 1, true),
      finis: bakeTextMask('ABC-GUITARS', 34, '400', 1, true),
      dropcap: bakeDropcap(cfg.dropcap),
      plate: mkCanvas(1, 1),
      sweep: mkCanvas(1, 1),
      scratch: mkCanvas(1, 1),
      sg: ctx2d(mkCanvas(1, 1)),
    };
    A.pattern = this.g.createPattern(A.tile, 'repeat');

    const masks = [A.title, A.subtitle, A.edition, A.banner, A.finis];
    const mw = Math.max(...masks.map((m) => m.w));
    const mh = Math.max(...masks.map((m) => m.h));
    A.plate = bakeGoldPlate(mw, mh);
    A.sweep = bakeSweep(mh);
    A.scratch = mkCanvas(mw * AS, mh * AS);
    A.sg = ctx2d(A.scratch);

    this.A = A;
  }

  /* ------------------------------------------------------------ quality */

  setQuality(q: number): void {
    this.quality = q = clamp(q | 0, 0, 2);
    const dims = [
      [104, 47],
      [148, 66],
      [192, 86],
    ][q];
    this.pw = dims[0];
    this.ph = dims[1];
    this.pstride = [3, 2, 1][q];
    this.pcan = mkCanvas(this.pw, this.ph);
    this.pctx = ctx2d(this.pcan, false);
    this.pimg = this.pctx.createImageData(this.pw, this.ph);
    this.p32 = new Uint32Array(this.pimg.data.buffer);
    this.tx = new Uint8Array(this.pw);
    this.ty = new Uint8Array(this.ph);
    this.rings = [6, 7, 9][q];
    this.band = [10, 8, 6][q];

    const nm = [26, 54, 92][q];
    const m = new Float32Array(nm * 4);
    const r = rng(0xb0ba);
    for (let i = 0; i < nm; i++) {
      m[i * 4] = r() * LW;
      m[i * 4 + 1] = r() * LH;
      m[i * 4 + 2] = 0.28 + r() * 0.9;
      m[i * 4 + 3] = 3 + r() * 11;
    }
    this.motes = m;
    this.nMotes = nm;
    this.pdirty = true;
  }

  private layout(): void {
    /* On a small stage the block text would shrink below legibility, so the
       foot band is measured against device pixels rather than logical ones. */
    this.ui = clamp(0.74 / this.S, 1, 1.5);
    this.blockH = 46 * this.ui;
    this.blockY = LH - 14 - this.blockH / 2;
    this.footTop = this.blockY - this.blockH / 2 - 10;
  }

  resize(cssW: number, cssH: number, dprIn: number): void {
    const dpr = clamp(dprIn, 1, this.quality === 0 ? 1 : this.maxDpr);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (w === this.W && h === this.H) return;
    this.cv.width = w;
    this.cv.height = h;
    this.W = w;
    this.H = h;
    this.S = w / LW;
    this.oy = (h - LH * this.S) / 2;
    this.g.imageSmoothingEnabled = true;
    this.pdirty = true;
    this.layout();

    /* The credit roll and the blocks are the largest bitmaps here. Baking
       them at the resolution the display actually asks for, instead of always
       at 2x, is the difference between 20 MB of texture and 5. */
    const want = clamp(Math.round(this.S * 1.15 * 4) / 4, 1, 2);
    if (Math.abs(want - this.rollScale) > 0.24) {
      this.rollScale = want;
      this.A.roll = bakeRoll(this.cfg, want);
      this.A.blocks = bakeBlocks(this.cfg.blocks, want, 640);
    }
  }

  /* ------------------------------------------------------------- plasma */

  private plasma(t: number): void {
    const { pw: PW, ph: PH, tx, ty, p32: buf } = this;
    const pal = PALETTE;
    const t1 = (t * 88) | 0;
    const t2 = (t * -61) | 0;
    const t3 = (t * 47) | 0;
    const t4 = (t * 70) | 0;
    const zx = (5.1 + sn(t * 0.11) * 1.5) * (192 / PW);
    const zy = (6.3 + cs(t * 0.09) * 1.7) * (86 / PH);

    for (let x = 0; x < PW; x++) {
      tx[x] = SIN6[((x * zx + t1) | 0) & SIN_MASK] + SIN6[((x * zx * 2.13 + t2) | 0) & SIN_MASK];
    }
    for (let y = 0; y < PH; y++) {
      ty[y] = SIN6[((y * zy + t3) | 0) & SIN_MASK] + SIN6[((y * zy * 1.71 + t4) | 0) & SIN_MASK];
    }

    /* the whole point of the two tables: one add, one lookup, one store */
    let p = 0;
    for (let y = 0; y < PH; y++) {
      const b = ty[y];
      for (let x = 0; x < PW; x++) buf[p++] = pal[b + tx[x]];
    }
    this.pctx.putImageData(this.pimg, 0, 0);
  }

  /* ------------------------------------------------------------- events */

  consume(now: number, dt: number): void {
    const ev = this.tune.events;
    let n = 0;
    while (n < ev.length && ev[n] <= now) {
      const ch = ev[n + 1];
      const note = ev[n + 2];
      if (ch === CH_BASS || (ch === CH_PERC && note === 36)) this.pulse = 1;
      if (ch === CH_LEAD) {
        this.lead = 1;
        this.pushNote(note);
      }
      n += 3;
    }
    if (n) ev.splice(0, n);
    this.pulse *= Math.pow(0.0009, dt);
    this.lead *= Math.pow(0.004, dt);
  }

  /** Write one note at the quill position; wrap when the stave is full. */
  pushNote(midi: number): void {
    const m = this.A.stave;
    const start = m.noteX0;
    const end = m.x1 - 18;
    if (this.staveX < start || this.staveX > end) {
      if (this.staveX > end) this.staveNotes.length = 0;
      this.staveX = start;
    }
    this.staveNotes.push(this.staveX, midi);
    this.staveX += 23;
    if (this.staveNotes.length > 80) this.staveNotes.splice(0, 2);
  }

  resetStave(): void {
    this.staveNotes.length = 0;
    this.staveX = 0;
  }

  /* ------------------------------------------------------------- render */

  render(clockT: number): void {
    const g = this.g;
    const A = this.A;
    const t = clockT;
    const bar = (t / BAR_DUR) % SONG.bars;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(A.parchment, 0, 0, this.W, this.H);

    if (this.frameNo % this.pstride === 0 || this.pdirty) {
      this.plasma(t);
      this.pdirty = false;
    }
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.38 + this.pulse * 0.07;
    g.drawImage(this.pcan, 0, 0, this.W, this.H);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;

    g.setTransform(this.S, 0, 0, this.S, 0, this.oy);

    this.drawMotes(t);

    let a: number;
    if ((a = windowAlpha(bar, SC.TITLE[0] - 0.01, SC.TITLE[1], 1.2, 0.6))) this.sceneTitle(t, bar, a);
    if ((a = windowAlpha(bar, SC.LUTE[0], SC.LUTE[1], 0.6, 0.6))) this.sceneLute(t, bar, a);
    if ((a = windowAlpha(bar, SC.ROLL[0], SC.ROLL[1], 0.7, 0.7))) this.sceneRoll(t, bar, a);
    if ((a = windowAlpha(bar, SC.ROSE[0], SC.ROSE[1], 0.7, 0.7))) this.sceneRose(t, bar, a);
    if ((a = windowAlpha(bar, SC.SEAL[0], SC.SEAL[1] + 0.01, 0.7, 0.5))) this.sceneSeal(t, bar, a);

    if ((a = windowAlpha(bar, 3.4, SONG.bars, 0.8, 0.6))) this.drawBlocks(t, bar, a);

    this.rules();
    this.frameNo++;
  }

  private drawMotes(t: number): void {
    const g = this.g;
    const m = this.motes;
    const spr = this.A.mote;
    const glow = 0.34 + this.pulse * 0.22;
    for (let i = 0; i < this.nMotes; i++) {
      const o = i * 4;
      const z = m[o + 2];
      const x = m[o] + sn(t * 0.21 + i) * 10 * z;
      let y = m[o + 1] - ((t * m[o + 3]) % (LH + 60));
      if (y < 0) y += LH + 60;
      const s = 5 + z * 12;
      g.globalAlpha = glow * z * 0.55;
      g.drawImage(spr, x - s / 2, y - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }

  /* --------------------------------------------------------- gilt text */

  private gilded(
    mask: TextMask,
    x: number,
    y: number,
    alpha: number,
    sweepPhase: number | null,
    scale = 1,
  ): void {
    const A = this.A;
    const sg = A.sg;
    const g = this.g;
    const w = mask.w * AS;
    const h = mask.h * AS;

    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, w, h);
    sg.drawImage(A.plate, 0, 0, A.plate.width, A.plate.height, 0, 0, w, h);
    if (sweepPhase !== null) {
      sg.globalCompositeOperation = 'lighter';
      sg.drawImage(A.sweep, (sweepPhase % 1) * (w + 520 * AS) - 260 * AS, 0, A.sweep.width, h);
    }
    sg.globalCompositeOperation = 'destination-in';
    sg.drawImage(mask.c, 0, 0);
    sg.globalCompositeOperation = 'source-over';

    const dx = x - (mask.w * scale) / 2;
    const dy = y - (mask.h * scale) / 2;
    if (mask.shade) {
      g.globalAlpha = alpha * 0.9;
      g.drawImage(mask.shade, 0, 0, w, h, dx + 1.4 * scale, dy + 1.6 * scale, mask.w * scale, mask.h * scale);
    }
    g.globalAlpha = alpha;
    g.drawImage(A.scratch, 0, 0, w, h, dx, dy, mask.w * scale, mask.h * scale);
    g.globalAlpha = 1;
  }

  private inked(mask: TextMask, x: number, y: number, alpha: number, colour: string, scale = 1): void {
    const A = this.A;
    const sg = A.sg;
    const g = this.g;
    const w = mask.w * AS;
    const h = mask.h * AS;

    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, w, h);
    sg.fillStyle = colour;
    sg.fillRect(0, 0, w, h);
    sg.globalCompositeOperation = 'destination-in';
    sg.drawImage(mask.c, 0, 0);
    sg.globalCompositeOperation = 'source-over';

    g.globalAlpha = alpha;
    g.drawImage(
      A.scratch, 0, 0, w, h,
      x - (mask.w * scale) / 2, y - (mask.h * scale) / 2,
      mask.w * scale, mask.h * scale,
    );
    g.globalAlpha = 1;
  }

  private cartouche(cx: number, cy: number, w: number, h: number, al: number): void {
    const g = this.g;
    g.globalAlpha = al * 0.86;
    g.fillStyle = 'rgba(247,239,219,0.92)';
    roundRect(g, cx - w / 2, cy - h / 2, w, h, 7);
    g.fill();
    g.globalAlpha = al * 0.7;
    g.strokeStyle = 'rgba(160,124,44,0.75)';
    g.lineWidth = 1;
    roundRect(g, cx - w / 2, cy - h / 2, w, h, 7);
    g.stroke();
    g.globalAlpha = al * 0.45;
    g.lineWidth = 0.7;
    roundRect(g, cx - w / 2 + 4, cy - h / 2 + 4, w - 8, h - 8, 4);
    g.stroke();
    g.globalAlpha = 1;
  }

  private flourish(cx: number, y: number, half: number, al: number): void {
    if (half < 2 || al <= 0) return;
    const g = this.g;
    g.globalAlpha = al;
    g.strokeStyle = 'rgba(140,106,34,0.72)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(cx - half, y);
    g.lineTo(cx - 11, y);
    g.moveTo(cx + 11, y);
    g.lineTo(cx + half, y);
    g.stroke();
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(cx, y - 5.5);
    g.lineTo(cx + 6.5, y);
    g.lineTo(cx, y + 5.5);
    g.lineTo(cx - 6.5, y);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(140,43,43,0.6)';
    g.beginPath();
    g.arc(cx - half - 4, y, 3, 0, TAU);
    g.moveTo(cx + half + 7, y);
    g.arc(cx + half + 4, y, 3, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }

  /* ========================= SCENE I -- title ========================= */

  private sceneTitle(t: number, bar: number, al: number): void {
    const g = this.g;
    const A = this.A;
    const cx = LW / 2;

    const e1 = ease((bar - 0.15) / 1.1);
    const s = 0.86 + e1 * 0.14;
    g.globalAlpha = al * e1;
    g.drawImage(
      A.dropcap.c,
      cx - (A.dropcap.size * s) / 2,
      96 - (A.dropcap.size * s) / 2 + (1 - e1) * 10,
      A.dropcap.size * s,
      A.dropcap.size * s,
    );
    g.globalAlpha = 1;

    const e2 = ease((bar - 0.9) / 1.0);
    this.flourish(cx, 186, 250 * e2, al * e2);
    this.flourish(cx, 322, 210 * e2, al * e2);

    const e3 = ease((bar - 1.1) / 1.3);
    if (e3 > 0) {
      g.save();
      g.beginPath();
      g.rect(cx - (A.title.w / 2) * e3 - 4, 200, A.title.w * e3 + 8, 60);
      g.clip();
      this.gilded(A.title, cx, 230, al, t * 0.24, 1);
      g.restore();
    }

    const e4 = ease((bar - 2.0) / 1.0);
    if (e4 > 0) {
      this.inked(A.subtitle, cx, 274, al * e4 * 0.9, 'rgba(107,76,37,0.95)');
      this.inked(A.edition, cx, 348, al * e4 * 0.85, 'rgba(140,43,43,0.9)');
    }
  }

  /* ====================== SCENE II -- the lute ======================= */

  private sceneLute(t: number, bar: number, al: number): void {
    const g = this.g;
    const A = this.A;
    const cx = LW / 2;
    const cy = 134;

    for (let i = 0; i < 5; i++) {
      const ry = cy + sn(t * 0.42 + i * 1.05) * 118 + cs(t * 0.27 + i * 0.7) * 34;
      g.globalAlpha = al * 0.3;
      g.drawImage(A.ribbon, 0, 0, 4, A.ribbon.height, 0, ry - 22, LW, 44);
    }
    g.globalAlpha = 1;

    const hs = 300 + this.pulse * 60;
    g.globalAlpha = al * (0.55 + this.pulse * 0.35);
    g.drawImage(A.halo, cx - hs / 2, cy - hs / 2, hs, hs);
    g.globalAlpha = 1;

    this.drawLute(cx, cy, 136 + this.pulse * 6, t * 0.52, sn(t * 0.31) * 0.3, -0.27 + sn(t * 0.19) * 0.09, al);
    this.drawStave(al * ease((bar - 5) / 1.2));
  }

  private drawLute(
    cx: number,
    cy: number,
    scale: number,
    ry: number,
    rx: number,
    rz: number,
    al: number,
  ): void {
    const L = this.lute;
    const v = L.v;
    const { px, py, pz } = this;
    const cY = cs(ry);
    const sY = sn(ry);
    const cX = cs(rx);
    const sX = sn(rx);
    const cZ = cs(rz);
    const sZ = sn(rz);
    const FOV = 5.2;
    const DIST = 5.0;
    const YC = 0.92;

    for (let i = 0; i < L.n; i++) {
      const x = v[i * 3];
      const y = v[i * 3 + 1] - YC;
      const z = v[i * 3 + 2];
      const x1 = x * cY - z * sY;
      const z1 = x * sY + z * cY;
      const y1 = y * cX - z1 * sX;
      const z2 = y * sX + z1 * cX;
      const d = FOV / (FOV + z2 + DIST);
      const sx = x1 * d * scale;
      const sy = -y1 * d * scale * 0.86;
      px[i] = cx + sx * cZ - sy * sZ;
      py[i] = cy + sx * sZ + sy * cZ;
      pz[i] = d;
    }

    const g = this.g;
    const back = new Path2D();
    const front = new Path2D();
    const fBack = new Path2D();
    const fFront = new Path2D();
    const mid = FOV / (FOV + DIST);

    const e = L.e;
    for (let i = 0; i < e.length; i += 2) {
      const a = e[i];
      const b = e[i + 1];
      const p = (pz[a] + pz[b]) * 0.5 > mid ? front : back;
      p.moveTo(px[a], py[a]);
      p.lineTo(px[b], py[b]);
    }
    const f = L.f;
    for (let i = 0; i < f.length; i += 2) {
      const a = f[i];
      const b = f[i + 1];
      const p = (pz[a] + pz[b]) * 0.5 > mid ? fFront : fBack;
      p.moveTo(px[a], py[a]);
      p.lineTo(px[b], py[b]);
    }

    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.globalAlpha = al * 0.26; g.strokeStyle = SEPIA;  g.lineWidth = 1.0; g.stroke(back);
    g.globalAlpha = al * 0.16; g.strokeStyle = GOLD_D; g.lineWidth = 0.7; g.stroke(fBack);
    g.globalAlpha = al * 0.96; g.strokeStyle = GOLD_D; g.lineWidth = 2.2; g.stroke(front);
    g.globalAlpha = al * 0.8;  g.strokeStyle = GOLD_L; g.lineWidth = 0.9; g.stroke(front);
    g.globalAlpha = al * 0.44; g.strokeStyle = SEPIA;  g.lineWidth = 0.8; g.stroke(fFront);
    g.globalAlpha = 1;
  }

  /** The melody, written onto the stave as the scribe hears it. */
  private drawStave(al: number): void {
    if (al <= 0) return;
    const g = this.g;
    const A = this.A;
    const m = A.stave;
    const notes = this.staveNotes;

    g.globalAlpha = al * 0.9;
    g.drawImage(m.canvas, 0, 0, m.canvas.width, m.canvas.height, STAVE_X, STAVE_Y, STAVE_W, STAVE_H);
    g.globalAlpha = 1;

    const gap = m.gap;
    const nh = A.notes;
    const lastIdx = notes.length - 2;

    for (let i = 0; i < notes.length; i += 2) {
      const x = STAVE_X + notes[i];
      const midi = notes[i + 1];
      const y = STAVE_Y + noteY(m, midi);
      const fresh = i === lastIdx ? this.lead : 0;
      g.globalAlpha = al * (0.78 + fresh * 0.22);

      /* ledger lines, for anything off the stave */
      const topY = STAVE_Y + m.topY;
      const botY = STAVE_Y + m.bottomY;
      g.strokeStyle = 'rgba(120,64,48,0.6)';
      g.lineWidth = 0.9;
      if (y < topY - 1) {
        for (let ly = topY - gap; ly >= y - 1; ly -= gap) {
          g.beginPath();
          g.moveTo(x - gap * 0.85, Math.round(ly) + 0.5);
          g.lineTo(x + gap * 0.85, Math.round(ly) + 0.5);
          g.stroke();
        }
      } else if (y > botY + 1) {
        for (let ly = botY + gap; ly <= y + 1; ly += gap) {
          g.beginPath();
          g.moveTo(x - gap * 0.85, Math.round(ly) + 0.5);
          g.lineTo(x + gap * 0.85, Math.round(ly) + 0.5);
          g.stroke();
        }
      }

      /* stem: up on the right below the middle line, down on the left above */
      const middle = STAVE_Y + m.topY + gap * 2;
      const up = y >= middle;
      g.strokeStyle = fresh > 0.25 ? GOLD : 'rgba(32,22,10,0.82)';
      g.lineWidth = 1.3;
      g.beginPath();
      if (up) {
        g.moveTo(x + gap * 0.6, y - 0.5);
        g.lineTo(x + gap * 0.6, y - gap * 3.1);
      } else {
        g.moveTo(x - gap * 0.6, y + 0.5);
        g.lineTo(x - gap * 0.6, y + gap * 3.1);
      }
      g.stroke();

      const spr = fresh > 0.25 ? nh.headFresh : nh.head;
      g.drawImage(spr, 0, 0, spr.width, spr.height, x - nh.w / 2, y - nh.h / 2, nh.w, nh.h);
    }

    /* the quill, hovering where the next note will land */
    if (this.staveX >= m.noteX0) {
      g.globalAlpha = al * 0.45;
      g.strokeStyle = BURGUNDY;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(STAVE_X + this.staveX, STAVE_Y + m.topY - 8);
      g.lineTo(STAVE_X + this.staveX, STAVE_Y + m.bottomY + 8);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  /* ====================== SCENE III -- the roll ====================== */

  private sceneRoll(t: number, bar: number, al: number): void {
    const g = this.g;
    const A = this.A;
    const R = A.roll;

    this.drawSketches(t, bar, al);

    const u = clamp((bar - SC.ROLL[0] - 0.2) / (SC.ROLL[1] - SC.ROLL[0] - 0.9), 0, 1);
    const yTop = LH + 24 - u * (R.h + LH + 48);
    const RS = R.s;
    const BAND = this.band;
    const BH = BAND * RS;
    const cxl = (LW - R.w) / 2;
    const jmax = Math.ceil((R.h * RS) / BH);
    const j0 = Math.max(0, Math.floor((-yTop * RS) / BH) - 1);
    const j1 = Math.min(jmax, Math.ceil(((LH - yTop) * RS) / BH) + 1);

    for (let j = j0; j < j1; j++) {
      const sy = j * BH;
      const dy = yTop + sy / RS;
      if (dy > this.footTop - 2 || dy + BAND < 0) continue;
      const mid = dy + BAND * 0.5;
      const fade = Math.min(ease(mid / 66), ease((this.footTop - 6 - mid) / 66));
      if (fade <= 0.002) continue;
      const dx = sn(mid * 0.0165 + t * 0.62) * 3.4;
      g.globalAlpha = al * fade;
      g.drawImage(R.c, 0, sy, R.w * RS, BH, cxl + dx, dy, R.w, BAND + 0.7);
    }
    g.globalAlpha = 1;
  }

  /**
   * The pencil studies behind the roll: two at a time, on either side, each
   * fading up and away on its own four-bar cycle. The four-tap offset draw is
   * what makes them read as indistinct without a second blurred bitmap.
   */
  private drawSketches(t: number, bar: number, al: number): void {
    const g = this.g;
    const list = this.A.sketches;
    if (!list.length) return;
    const local = bar - SC.ROLL[0];
    const CYCLE = 4;

    for (let lane = 0; lane < 2; lane++) {
      const phase = local / CYCLE + lane * 0.5;
      const slot = Math.floor(phase);
      const f = phase - slot;
      /* up over the first fifth, hold, away over the last third */
      const fade = Math.min(ease(f / 0.2), ease((1 - f) / 0.3)) * 0.72;
      if (fade <= 0.01) continue;

      const sk = list[((slot * 2 + lane) % list.length + list.length) % list.length];
      const size = SKETCH_SIZE * (0.86 + f * 0.1) * (lane === 0 ? 0.95 : 1.05);
      const cx = lane === 0 ? 228 : 742;
      const cy = 168 + sn(t * 0.13 + lane * 2.1) * 14 - f * 12;
      const a = al * fade * 0.5;

      /* four taps at sub-pixel offsets: a cheap blur, no ctx.filter */
      const spread = 1.6 + (1 - Math.min(f / 0.25, 1)) * 4.5;
      const offs: readonly [number, number][] = [
        [-spread, -spread * 0.6],
        [spread, -spread * 0.4],
        [-spread * 0.5, spread],
        [0, 0],
      ];
      for (let k = 0; k < offs.length; k++) {
        g.globalAlpha = a * (k === 3 ? 0.5 : 0.24);
        g.drawImage(sk, cx - size / 2 + offs[k][0], cy - size / 2 + offs[k][1], size, size);
      }
    }
    g.globalAlpha = 1;
  }

  /* ====================== SCENE IV -- rose vault ===================== */

  private sceneRose(t: number, bar: number, al: number): void {
    const g = this.g;
    const A = this.A;
    const cx = LW / 2;
    const cy = 160;

    const rs = 1.15 + sn(t * 0.19) * 0.42;
    g.save();
    g.globalAlpha = al * 0.3;
    g.translate(cx, cy);
    g.rotate(t * 0.085);
    g.scale(rs, rs);
    g.translate(-t * 15, t * 9);
    if (A.pattern) {
      g.fillStyle = A.pattern;
      g.fillRect(-1100, -1100, 2200, 2200);
    }
    g.restore();
    g.globalAlpha = 1;

    const N = this.rings;
    const ph = (t * 0.3) % 1;
    for (let i = N - 1; i >= 0; i--) {
      const fq = i + ph;
      const sc = 0.048 * Math.pow(1.66, fq) * (1 + this.pulse * 0.045);
      const av = ease(fq * 1.1) * ease((N - fq) * 0.55) * 0.62;
      if (av <= 0.004) continue;
      g.save();
      g.globalAlpha = al * av;
      g.translate(cx, cy);
      g.rotate(fq * 0.2 + t * 0.06);
      g.scale(sc, sc);
      g.drawImage(A.rosette, -256, -256);
      g.restore();
    }
    g.globalAlpha = 1;

    const e = ease((bar - SC.ROSE[0] - 0.8) / 1.6);
    if (e > 0) {
      const b = A.banner;
      const yb = 296 + sn(t * 0.5) * 4;
      this.cartouche(cx, yb, b.w * 0.88 + 54, b.h * 0.74, al * e);
      this.gilded(b, cx, yb, al * e, t * 0.2, 0.88 + this.pulse * 0.02);
      this.flourish(cx, 338, 230 * e, al * e * 0.8);
    }
  }

  /* ======================== SCENE V -- the seal ====================== */

  private sceneSeal(t: number, bar: number, al: number): void {
    const g = this.g;
    const A = this.A;
    const cx = LW / 2;
    const cy = 158;
    const e = ease((bar - SC.SEAL[0] - 0.1) / 1.1);

    const rr = 60 + e * 118;
    g.globalAlpha = al * (1 - e) * 0.5;
    g.strokeStyle = GOLD;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(cx, cy, rr, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;

    const sq = 1 + (1 - e) * 0.22;
    const sz = 156 * e * (1 + this.pulse * 0.02);
    g.globalAlpha = al * e;
    g.drawImage(A.seal, cx - (sz * sq) / 2, cy - sz / 2, sz * sq, sz);
    g.globalAlpha = 1;

    const e2 = ease((bar - SC.SEAL[0] - 1.3) / 1.2);
    if (e2 > 0) {
      this.cartouche(cx, 284, A.finis.w * 0.86 + 60, A.finis.h * 0.72, al * e2);
      this.gilded(A.finis, cx, 284, al * e2, t * 0.18, 0.9);
      this.flourish(cx, 326, 190 * e2, al * e2 * 0.8);
    }
  }

  /* ==================== the greeting, in blocks ====================== */

  private drawBlocks(t: number, bar: number, al: number): void {
    const g = this.g;
    const list = this.A.blocks;
    if (!list.length) return;

    const START = 3.4;
    const u = clamp((bar - START) / (SONG.bars - START), 0, 0.99999);
    const timing = blockAt(u, list.length);
    if (!timing) return;

    g.globalAlpha = al * 0.28;
    g.strokeStyle = 'rgba(140,106,34,0.8)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(40, this.footTop);
    g.lineTo(LW - 40, this.footTop);
    g.stroke();
    g.globalAlpha = 1;

    const b = list[timing.index];
    /* the mist the block condenses out of */
    if (timing.p < 0.98) {
      const mw = 520 * (1.1 - timing.p * 0.25);
      g.globalAlpha = al * (1 - timing.p) * 0.28;
      g.drawImage(this.A.halo, LW / 2 - mw / 2, this.blockY - 70, mw, 140);
      g.globalAlpha = 1;
    }
    drawBlock(g, b, LW / 2, this.blockY, timing.p, al * timing.alpha, t);
  }

  /* ------------------------------------------------------------- frame */

  private rules(): void {
    const g = this.g;
    g.globalAlpha = 0.62;
    g.strokeStyle = 'rgba(140,106,34,0.95)';
    g.lineWidth = 1.4;
    roundRect(g, 9, 9, LW - 18, LH - 18, 10);
    g.stroke();
    g.globalAlpha = 0.4;
    g.lineWidth = 0.8;
    roundRect(g, 15, 15, LW - 30, LH - 30, 7);
    g.stroke();
    g.globalAlpha = 0.5;
    g.fillStyle = GOLD;
    const pts: readonly [number, number][] = [
      [9, 9], [LW - 9, 9], [9, LH - 9], [LW - 9, LH - 9],
    ];
    for (const [x, y] of pts) {
      g.beginPath();
      g.moveTo(x, y - 4.5);
      g.lineTo(x + 4.5, y);
      g.lineTo(x, y + 4.5);
      g.lineTo(x - 4.5, y);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
  }

  /* ------------------------------------------------------ loop + tiers */

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const step = (ms: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(step);
      let dt = (ms - this.lastT) / 1000;
      this.lastT = ms;
      if (dt > 0.25) dt = 0.25;

      const t0 = performance.now();
      const now = this.tune.clock();
      this.consume(now, dt);
      this.render(now);
      const cost = performance.now() - t0;

      this.ema += (cost - this.ema) * 0.06;
      if (++this.qLock > 72) {
        this.qLock = 0;
        if (this.ema > 12.5 && this.quality > 0) {
          this.setQuality(this.quality - 1);
          this.upgrades = 0;
        } else if (this.ema < 4.5 && this.quality < 2 && this.upgrades > 0) {
          this.upgrades--;
          this.setQuality(this.quality + 1);
        }
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
