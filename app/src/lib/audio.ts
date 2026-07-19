// ============================================================
//  AudioEngine — procedural sound built on the Web Audio API.
//  Ported from prototypes/CodexLegends (user-approved effects layer).
//
//  • All SFX are synthesised at runtime — no audio files shipped.
//  • Each entry's "theme" is generated live from the equal-temperament
//    formula f = root·2^(semitone/12), seeded deterministically from
//    the entry's name hash (same hero — same melody, every visit).
//  • Theme playback uses a look-ahead scheduler (classic game-audio
//    technique for sample-accurate timing).
// ============================================================

import { fnv1a } from "./metadata";

export interface ThemeSpec {
  root: number;
  scale: number[];
  tempo: number;
  wave: OscillatorType;
  bass: OscillatorType;
}

/** mulberry32 PRNG — tiny, deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Modes with a guitar-friendly flavour: natural minor, dorian, major,
// mixolydian, harmonic minor (Spanish tinge).
const SCALES: number[][] = [
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 4, 5, 7, 9, 10],
  [0, 2, 3, 5, 7, 8, 11],
];
// Open-string-ish guitar roots: E2·2, G3, A3, B3, D3, C3.
const ROOTS = [164.81, 196.0, 220.0, 246.94, 146.83, 130.81];

export function themeFromSeed(seed: string): ThemeSpec {
  const rng = mulberry32(fnv1a(seed) || 1);
  return {
    root: ROOTS[Math.floor(rng() * ROOTS.length)],
    scale: SCALES[Math.floor(rng() * SCALES.length)],
    tempo: 64 + Math.floor(rng() * 44),
    wave: rng() < 0.6 ? "triangle" : "sine",
    bass: rng() < 0.5 ? "sine" : "triangle",
  };
}

interface NoteOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  detune?: number;
  dest?: AudioNode;
  filter?: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];

  private themeTimer: ReturnType<typeof setInterval> | null = null;
  private themeGain: GainNode | null = null;
  private themeState: { spec: ThemeSpec; step: number; nextTime: number } | null = null;

  private _enabled = true;
  private _ambientOn = false;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._enabled ? 0.9 : 0;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.85;
      this.sfxBus.connect(this.master);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** Call on first interaction to unlock audio (autoplay policy). */
  unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  get enabled() {
    return this._enabled;
  }

  setEnabled(v: boolean) {
    this._enabled = v;
    const ctx = this.ensure();
    if (ctx && this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(v ? 0.9 : 0, ctx.currentTime + 0.12);
    }
    if (!v) {
      this.stopTheme();
      this.setAmbient(false);
    }
  }

  private voice(freq: number, start: number, dur: number, o: NoteOpts = {}) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || !this._enabled) return;
    const dest = o.dest ?? this.sfxBus;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.value = freq;
    if (o.detune) osc.detune.value = o.detune;

    const g = ctx.createGain();
    const peak = o.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + (o.attack ?? 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + (o.release ?? 0.05));

    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.filter;
      osc.connect(f);
      f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + (o.release ?? 0.05) + 0.05);
  }

  /** Equal temperament: semitone offset → frequency. */
  static freq(root: number, semitones: number) {
    return root * Math.pow(2, semitones / 12);
  }

  // ---- SFX ----------------------------------------------------------
  hover() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.voice(880 + Math.random() * 60, ctx.currentTime, 0.09, {
      type: "sine",
      gain: 0.04,
      filter: 2200,
    });
  }

  type() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.voice(1500 + Math.random() * 200, ctx.currentTime, 0.04, {
      type: "triangle",
      gain: 0.025,
    });
  }

  click() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.voice(660, ctx.currentTime, 0.06, { type: "square", gain: 0.05, filter: 1800 });
    this.voice(990, ctx.currentTime + 0.03, 0.08, { type: "sine", gain: 0.05 });
  }

  /** Ascending major arpeggio — "match found". */
  found() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 4, 7, 12].forEach((s, i) =>
      this.voice(AudioEngine.freq(523.25, s), t + i * 0.06, 0.18, {
        type: "triangle",
        gain: 0.08,
        filter: 4000,
      }),
    );
  }

  error() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.voice(180, ctx.currentTime, 0.18, { type: "sawtooth", gain: 0.06, filter: 800 });
  }

  /** Codex open — filtered-noise whoosh + soft chord. */
  open() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noiseSweep(t, 0.55, 400, 5000, 0.1);
    [0, 7, 12, 16].forEach((s, i) =>
      this.voice(AudioEngine.freq(392, s), t + 0.05 + i * 0.05, 0.7, {
        type: "sine",
        gain: 0.06,
        filter: 6000,
        release: 0.5,
      }),
    );
  }

  close() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noiseSweep(t, 0.3, 3000, 300, 0.07);
    [12, 7, 0].forEach((s, i) =>
      this.voice(AudioEngine.freq(392, s), t + i * 0.04, 0.25, { type: "sine", gain: 0.05 }),
    );
  }

  /** Page turn — a burst of filtered paper-noise + a soft tick. */
  pageTurn() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noiseSweep(t, 0.22, 1200, 6000, 0.05);
    this.voice(420, t, 0.05, { type: "square", gain: 0.03, filter: 1200 });
  }

  // ---- filtered noise -------------------------------------------------
  private noiseBuffer: AudioBuffer | null = null;
  private getNoise(ctx: AudioContext) {
    if (!this.noiseBuffer) {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  private noiseSweep(start: number, dur: number, fromHz: number, toHz: number, gain: number) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this._enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(fromHz, start);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  // ---- ambient drone ---------------------------------------------------
  setAmbient(on: boolean) {
    this._ambientOn = on;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (on) this.startAmbient();
    else this.stopAmbient();
  }

  get ambientOn() {
    return this._ambientOn;
  }

  private startAmbient() {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.ambientGain) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2);
    g.connect(this.master);
    this.ambientGain = g;

    const freqs = [55, 82.4, 110, 164.8];
    const nodes: AudioNode[] = [];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = f;
      osc.detune.value = (i - 1.5) * 4;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 2 + i;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      const og = ctx.createGain();
      og.gain.value = 0.5 / (i + 1);
      osc.connect(og);
      og.connect(g);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
    });
    this.ambientNodes = nodes;
  }

  private stopAmbient() {
    const ctx = this.ctx;
    if (!ctx || !this.ambientGain) return;
    const g = this.ambientGain;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    const nodes = this.ambientNodes;
    setTimeout(() => {
      for (const n of nodes) {
        try {
          (n as OscillatorNode).stop?.();
        } catch { /* already stopped */ }
        try {
          n.disconnect();
        } catch { /* already disconnected */ }
      }
      try {
        g.disconnect();
      } catch { /* already disconnected */ }
    }, 800);
    this.ambientGain = null;
    this.ambientNodes = [];
  }

  // ---- per-entry theme (look-ahead scheduler) ---------------------------
  startTheme(spec: ThemeSpec) {
    const ctx = this.ensure();
    if (!ctx || !this._enabled) return;
    if (this.themeIsPlaying(spec)) return;
    this.stopTheme();

    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.8);
    bus.connect(this.master!);
    this.themeGain = bus;

    this.themeState = { spec, step: 0, nextTime: ctx.currentTime + 0.1 };
    this.themeTimer = setInterval(() => this.scheduleTheme(), 25);
  }

  stopTheme() {
    const ctx = this.ctx;
    if (this.themeTimer) {
      clearInterval(this.themeTimer);
      this.themeTimer = null;
    }
    if (ctx && this.themeGain) {
      const g = this.themeGain;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      setTimeout(() => {
        try {
          g.disconnect();
        } catch { /* already disconnected */ }
      }, 600);
    }
    this.themeGain = null;
    this.themeState = null;
  }

  themeIsPlaying(spec: ThemeSpec) {
    return (
      !!this.themeState &&
      this.themeState.spec.root === spec.root &&
      this.themeState.spec.scale.join() === spec.scale.join() &&
      this.themeState.spec.tempo === spec.tempo
    );
  }

  private scheduleTheme() {
    const ctx = this.ctx;
    const state = this.themeState;
    const bus = this.themeGain;
    if (!ctx || !state || !bus) return;
    const secPerBeat = 60 / state.spec.tempo;
    const secPerStep = secPerBeat / 2; // eighth-note grid
    while (state.nextTime < ctx.currentTime + 0.15) {
      this.themeStep(state.step, state.nextTime, state.spec, bus, secPerBeat);
      state.step++;
      state.nextTime += secPerStep;
    }
  }

  private themeStep(step: number, time: number, spec: ThemeSpec, bus: GainNode, secPerBeat: number) {
    const bar = step % 16;
    const { root, scale } = spec;

    // Bass pulse on the down-beats
    if (bar % 4 === 0) {
      this.voice(AudioEngine.freq(root / 2, 0), time, secPerBeat * 0.9, {
        type: spec.bass,
        gain: 0.2,
        dest: bus,
        filter: 600,
        release: 0.1,
      });
    }

    // Arpeggio — walk the scale, octave up (plucked envelope)
    const deg = scale[(step * 3) % scale.length];
    this.voice(AudioEngine.freq(root, deg + 12), time, secPerBeat * 0.5, {
      type: spec.wave,
      gain: 0.08,
      dest: bus,
      filter: 3200,
      attack: 0.008,
    });

    // Shimmering high echo on off-beats
    if (bar % 8 === 5) {
      this.voice(AudioEngine.freq(root, scale[(step + 2) % scale.length] + 24), time, secPerBeat * 0.4, {
        type: "sine",
        gain: 0.04,
        dest: bus,
        filter: 5000,
      });
    }

    // Warm pad chord at the start of each bar
    if (bar % 8 === 0) {
      for (const s of scale.slice(0, 3)) {
        this.voice(AudioEngine.freq(root, s), time, secPerBeat * 3.2, {
          type: "sine",
          gain: 0.04,
          dest: bus,
          filter: 1600,
          release: 0.6,
        });
      }
    }
  }
}

/** Singleton shared across the app. */
export const audio = new AudioEngine();
