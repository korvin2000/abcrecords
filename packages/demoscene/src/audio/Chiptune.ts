import { rng } from '../core/util';
import { ROW_DUR, SONG } from './score';

/** Visual event handed to the renderer: `[clockTime, channel, midi]`, flat. */
export type EventQueue = number[];

export const CH_HARP = 0;
export const CH_LEAD = 1;
export const CH_BASS = 2;
export const CH_ARP = 3;
export const CH_PERC = 4;

const KICK = 36;
const SNARE = 38;
const TICK = 42;

type WaveName = 'gut' | 'steel' | 'pulse' | 'tri';

/**
 * Five-channel tracker over the Web Audio API.
 *
 * A note costs three transient nodes and nothing else; every waveform is a
 * cached `PeriodicWave` and the noise bed is a single one-second buffer that
 * every percussion hit reads from at a random offset.
 *
 * The transport keeps working when the audio is muted -- the scheduler still
 * advances rows and emits visual events off a `performance.now()` clock -- so
 * the animation stays locked to the score whether or not anyone is listening.
 */
export class Chiptune {
  ctx: AudioContext | null = null;
  ready = false;
  silent = false;
  useAudio = false;
  row = 0;
  events: EventQueue = [];

  private waves: Partial<Record<WaveName, PeriodicWave>> = {};
  private noise: AudioBuffer | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private perf0 = 0;
  private audio0 = 0;
  private readonly freq = new Float32Array(128);
  private readonly rand = rng(0x51de);

  constructor(private vol: number) {
    for (let i = 0; i < 128; i++) this.freq[i] = 440 * Math.pow(2, (i - 69) / 12);
  }

  /* ---------------------------------------------------------------- setup */

  private wave(name: WaveName, n: number, fn: (h: number) => number): void {
    if (this.waves[name] || !this.ctx) return;
    const re = new Float32Array(n + 1);
    const im = new Float32Array(n + 1);
    for (let h = 1; h <= n; h++) im[h] = fn(h);
    this.waves[name] = this.ctx.createPeriodicWave(re, im, {
      disableNormalization: false,
    });
  }

  init(): boolean {
    if (this.ready) return true;
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch {
      return false;
    }
    const c = this.ctx;

    /* plucked gut string: 1/n^1.35 rolloff, combed at the plucking point */
    this.wave('gut', 26, (h) => Math.abs(Math.sin((h * Math.PI) / 5.2)) / Math.pow(h, 1.35));
    /* a brighter string doubling the lead */
    this.wave('steel', 22, (h) => Math.abs(Math.sin((h * Math.PI) / 3.4)) / Math.pow(h, 1.12));
    /* 25% pulse: the chiptune voice */
    this.wave('pulse', 18, (h) => Math.sin(h * Math.PI * 0.25) / h);
    /* soft triangle for the bass */
    this.wave('tri', 13, (h) => (h % 2 ? (h % 4 === 1 ? 1 : -1) / (h * h) : 0));

    /* one second of noise, reused by every percussion hit */
    const nb = c.createBuffer(1, c.sampleRate | 0, c.sampleRate);
    const nd = nb.getChannelData(0);
    const r = rng(0x5eed);
    for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
    this.noise = nb;

    /* master chain: dry + a two-tap feedback hall -> shelf -> comp -> out */
    this.master = c.createGain();
    this.master.gain.value = this.vol;

    /*
     * A gentle shelf above 9 kHz. Percussion transients are the only thing up
     * there and taming them is cheaper, and kinder, than fighting each voice.
     */
    const air = c.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 9000;
    air.gain.value = -7;

    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;

    this.master.connect(air);
    air.connect(comp);
    comp.connect(c.destination);

    this.bus = c.createGain();
    this.bus.connect(this.master);

    const send = c.createGain();
    send.gain.value = 0.3;
    this.bus.connect(send);
    const d1 = c.createDelay(0.5);
    const d2 = c.createDelay(0.5);
    d1.delayTime.value = 0.129;
    d2.delayTime.value = 0.211;
    const fb = c.createGain();
    fb.gain.value = 0.34;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    send.connect(d1);
    send.connect(d2);
    d1.connect(lp);
    d2.connect(lp);
    lp.connect(fb);
    fb.connect(d1);
    fb.connect(d2);
    lp.connect(this.master);

    this.ready = true;
    return true;
  }

  /* ---------------------------------------------------------------- voices */

  private note(
    wave: WaveName,
    f: number,
    when: number,
    dur: number,
    g: number,
    cutHi: number,
    cutLo: number,
    detune = 0,
  ): void {
    const c = this.ctx;
    const w = this.waves[wave];
    if (!c || !w) return;

    const o = c.createOscillator();
    o.setPeriodicWave(w);
    o.frequency.value = f;
    if (detune) o.detune.value = detune;

    const bq = c.createBiquadFilter();
    bq.type = 'lowpass';
    bq.Q.value = 0.9;
    bq.frequency.setValueAtTime(cutHi, when);
    bq.frequency.exponentialRampToValueAtTime(cutLo, when + dur);

    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, when);
    gn.gain.linearRampToValueAtTime(g, when + 0.006);
    gn.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    o.connect(bq);
    bq.connect(gn);
    gn.connect(this.bus);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  /**
   * Percussion.
   *
   * Every voice here gets a real attack ramp. Starting a noise buffer at full
   * amplitude is an instantaneous broadband step -- measured at 0.131 per
   * sample on the old tambourine, ten times the kick -- and through a high
   * shelf that is exactly the high-frequency tick you hear. A 4 ms ramp and a
   * bounded pass band drop it to 0.040 with no discontinuity at onset.
   */
  private drum(kind: number, when: number, g: number): void {
    const c = this.ctx;
    if (!c || !this.noise) return;

    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;

    const gn = c.createGain();
    let dur: number;
    let attack: number;
    let last: AudioNode;

    if (kind === KICK) {
      s.playbackRate.value = 0.5;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 190;
      lp.Q.value = 4;
      s.connect(lp);
      last = lp;
      dur = 0.16;
      attack = 0.004;
    } else if (kind === SNARE) {
      s.playbackRate.value = 1;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 1.1;
      s.connect(bp);
      last = bp;
      dur = 0.11;
      attack = 0.003;
    } else {
      /* tambourine: a band, not an open high shelf, and never instant */
      s.playbackRate.value = 1.15;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3100;
      bp.Q.value = 0.9;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5200;
      lp.Q.value = 0.5;
      s.connect(bp);
      bp.connect(lp);
      last = lp;
      dur = 0.07;
      attack = 0.004;
    }

    gn.gain.setValueAtTime(0.0001, when);
    gn.gain.linearRampToValueAtTime(g, when + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    last.connect(gn);
    gn.connect(this.bus);
    /* a random read offset, so repeated hits are not bit-identical */
    s.start(when, this.rand() * 0.5);
    s.stop(when + dur + 0.02);

    if (kind === KICK) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, when);
      o.frequency.exponentialRampToValueAtTime(48, when + 0.13);
      og.gain.setValueAtTime(0.0001, when);
      og.gain.linearRampToValueAtTime(g * 1.1, when + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
      o.connect(og);
      og.connect(this.bus);
      o.start(when);
      o.stop(when + 0.17);
    }
  }

  /* ------------------------------------------------------------- transport */

  /** Seconds since row 0, from whichever clock is authoritative. */
  clock(): number {
    return this.useAudio && this.ctx
      ? this.ctx.currentTime - this.audio0
      : (performance.now() - this.perf0) / 1000;
  }

  start(fromRow = 0): void {
    this.row = fromRow;
    this.perf0 = performance.now() - fromRow * ROW_DUR * 1000;
    if (this.useAudio && this.ctx) this.audio0 = this.ctx.currentTime - fromRow * ROW_DUR;
    this.events.length = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 32);
    this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  enableAudio(): boolean {
    if (!this.init() || !this.ctx) return false;
    const pos = this.clock();
    this.useAudio = true;
    this.silent = false;
    const anchor = () => {
      if (this.ctx) this.audio0 = this.ctx.currentTime - pos;
    };
    if (this.ctx.state === 'suspended') void this.ctx.resume().then(anchor, anchor);
    else anchor();
    this.master.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.05);
    return true;
  }

  disableAudio(): void {
    if (!this.ctx) {
      this.silent = true;
      return;
    }
    const pos = this.clock();
    this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
    this.silent = true;
    this.useAudio = false;
    this.perf0 = performance.now() - pos * 1000;
  }

  setVolume(v: number): void {
    this.vol = v;
    if (this.ctx && this.ready && !this.silent) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  dispose(): void {
    this.stop();
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        /* already closed */
      }
      this.ctx = null;
    }
    this.ready = false;
  }

  /** Schedule everything inside the look-ahead window. */
  private tick(): void {
    const now = this.clock();
    const horizon = now + 0.18;
    const live =
      this.useAudio && !this.silent && this.ctx !== null && this.ctx.state === 'running';

    let guard = 0;
    while (this.row * ROW_DUR < horizon && guard++ < 64) {
      const r = this.row % SONG.rows;
      const t = this.row * ROW_DUR;
      const at = live ? t + this.audio0 : 0;
      const sg = SONG.gain[(r / 16) | 0];
      const ch = SONG.ch;
      let n: number;

      n = ch.harp[r];
      if (n) {
        if (live) this.note('gut', this.freq[n], at, 1.15, 0.16 * sg, 3200, 420);
        this.events.push(t, CH_HARP, n);
      }
      n = ch.lead[r];
      if (n) {
        if (live) {
          this.note('steel', this.freq[n], at, 0.62, 0.115 * sg, 4200, 900);
          this.note('pulse', this.freq[n], at, 0.3, 0.045 * sg, 3000, 1400, 5);
        }
        this.events.push(t, CH_LEAD, n);
      }
      n = ch.bass[r];
      if (n) {
        if (live) this.note('tri', this.freq[n], at, 1.3, 0.3 * sg, 1100, 180);
        this.events.push(t, CH_BASS, n);
      }
      n = ch.arp[r];
      if (n) {
        if (live) this.note('pulse', this.freq[n], at, 0.115, 0.036 * sg, 3400, 1800);
        this.events.push(t, CH_ARP, n);
      }
      n = ch.perc[r];
      if (n) {
        if (live) this.drum(n, at, n === TICK ? 0.05 : n === SNARE ? 0.1 : 0.16);
        this.events.push(t, CH_PERC, n);
      }
      this.row++;
    }

    if (this.events.length > 900) this.events.splice(0, this.events.length - 900);
  }
}
