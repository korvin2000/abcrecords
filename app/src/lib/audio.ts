// ============================================================
//  AudioEngine — a quiet, procedural chamber-music sound palette built on
//  the Web Audio API. The levels, envelopes and voicings are intentionally
//  restrained so repeated interface cues never dominate the content.
//
//  • All SFX are synthesised at runtime — no audio files shipped.
//  • Soft sine/triangle voices evoke nylon strings without sharp transients.
//  • A short synthetic room tail (inspired by Copendum) adds natural space.
//  • Repetitive hover/type events are rate-limited.
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

const MASTER_LEVEL = 0.42;
const SFX_LEVEL = 0.46;
const SILENCE = 0.0001;
const HOVER_PHRASE = [329.63, 392, 493.88, 392] as const; // E4–G4–B4–G4

export function themeFromSeed(seed: string): ThemeSpec {
  const rng = mulberry32(fnv1a(seed) || 1);
  return {
    root: ROOTS[Math.floor(rng() * ROOTS.length)],
    scale: SCALES[Math.floor(rng() * SCALES.length)],
    tempo: 58 + Math.floor(rng() * 24),
    wave: rng() < 0.72 ? "sine" : "triangle",
    bass: "sine",
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
  room?: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private room: ConvolverNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];

  private themeTimer: ReturnType<typeof setInterval> | null = null;
  private themeGain: GainNode | null = null;
  private themeState: { spec: ThemeSpec; step: number; nextTime: number } | null = null;

  private _enabled = true;
  private _ambientOn = false;
  private _unlocked = false;
  private lastHoverAt = -Infinity;
  private hoverStep = 0;
  private lastTypeAt = -Infinity;
  private lastClickAt = -Infinity;
  private suppressOpenUntil = -Infinity;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._enabled ? MASTER_LEVEL : 0;

      // Gentle peak control protects against coincident notes without
      // flattening the dynamics of individual cues.
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -24;
      this.limiter.knee.value = 18;
      this.limiter.ratio.value = 4;
      this.limiter.attack.value = 0.012;
      this.limiter.release.value = 0.28;
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = SFX_LEVEL;
      this.sfxBus.connect(this.master);

      // Copendum's synthetic convolver idea, retuned as a much shorter and
      // quieter warm room rather than a prominent effect.
      this.room = this.createRoom(this.ctx);
      const roomTone = this.ctx.createBiquadFilter();
      roomTone.type = "lowpass";
      roomTone.frequency.value = 1800;
      roomTone.Q.value = 0.35;
      const roomReturn = this.ctx.createGain();
      roomReturn.gain.value = 0.11;
      this.room.connect(roomTone);
      roomTone.connect(roomReturn);
      roomReturn.connect(this.master);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private createRoom(ctx: AudioContext): ConvolverNode {
    const convolver = ctx.createConvolver();
    const length = Math.floor(ctx.sampleRate * 1.15);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 3.4);
        data[i] = (Math.random() * 2 - 1) * decay * (channel === 0 ? 0.85 : 0.78);
      }
    }
    convolver.buffer = impulse;
    return convolver;
  }

  /** Call on first interaction to unlock audio (autoplay policy). */
  unlock() {
    this._unlocked = true;
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
      this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(v ? MASTER_LEVEL : 0, ctx.currentTime + 0.25);
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
    osc.frequency.setValueAtTime(freq, start);
    if (o.detune) osc.detune.value = o.detune;

    const g = ctx.createGain();
    const peak = Math.min(o.gain ?? 0.025, 0.16);
    const attack = o.attack ?? 0.018;
    const release = o.release ?? 0.16;
    g.gain.setValueAtTime(SILENCE, start);
    g.gain.exponentialRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(SILENCE, start + dur + release);

    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.filter;
      f.Q.value = 0.45;
      osc.connect(f);
      f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(dest);
    if (o.room && this.room) {
      const send = ctx.createGain();
      send.gain.value = o.room;
      g.connect(send);
      send.connect(this.room);
    }
    osc.start(start);
    osc.stop(start + dur + release + 0.05);
  }

  /** Equal temperament: semitone offset → frequency. */
  static freq(root: number, semitones: number) {
    return root * Math.pow(2, semitones / 12);
  }

  // ---- SFX ----------------------------------------------------------
  hover() {
    if (!this._enabled || !this._unlocked) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (t - this.lastHoverAt < 0.28) return;
    this.lastHoverAt = t;
    const frequency = HOVER_PHRASE[this.hoverStep++ % HOVER_PHRASE.length];
    this.voice(frequency, t, 0.065, {
      type: "triangle",
      gain: 0.027,
      attack: 0.016,
      release: 0.16,
      detune: Math.random() * 4 - 2,
      filter: 1250,
      room: 0.075,
    });
    // A very quiet octave partial adds a nylon-string glint without sharpness.
    this.voice(frequency * 2, t + 0.012, 0.035, {
      type: "sine",
      gain: 0.005,
      attack: 0.014,
      release: 0.11,
      filter: 1750,
      room: 0.04,
    });
  }

  type() {
    if (!this._enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const pause = t - this.lastTypeAt;
    this.lastTypeAt = t;
    if (pause < 0.24) return;
    this.voice(246.94, t, 0.035, {
      type: "sine",
      gain: 0.006,
      attack: 0.012,
      release: 0.075,
      detune: Math.random() * 5 - 2.5,
      filter: 720,
    });
  }

  click() {
    if (!this._enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (t - this.lastClickAt < 0.09) return;
    this.lastClickAt = t;
    // A quiet B3–E4 dyad: the two upper open strings of a classical guitar.
    this.voice(246.94, t, 0.075, {
      type: "triangle",
      gain: 0.026,
      attack: 0.014,
      release: 0.21,
      filter: 1150,
      room: 0.12,
    });
    this.voice(329.63, t + 0.018, 0.065, {
      type: "sine",
      gain: 0.013,
      attack: 0.018,
      release: 0.2,
      filter: 1300,
      room: 0.14,
    });
  }

  /** Restrained E-major cadence — "match found". */
  found() {
    if (!this._enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 4, 7, 12].forEach((s, i) =>
      this.voice(AudioEngine.freq(329.63, s), t + i * 0.085, 0.11, {
        type: i === 0 ? "triangle" : "sine",
        gain: 0.024 - i * 0.002,
        attack: 0.02,
        release: 0.24,
        filter: 1450,
        room: 0.12,
      }),
    );
  }

  error() {
    if (!this._enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.voice(220, t, 0.1, {
      type: "triangle",
      gain: 0.022,
      attack: 0.028,
      release: 0.25,
      filter: 620,
      room: 0.06,
    });
    this.voice(196, t + 0.09, 0.1, {
      type: "sine",
      gain: 0.017,
      attack: 0.03,
      release: 0.28,
      filter: 560,
      room: 0.06,
    });
  }

  /** Codex open — a soft paper breath and an E-minor add-nine voicing. */
  open() {
    if (!this._enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (t < this.suppressOpenUntil) return;
    this.noiseSweep(t, 0.42, 420, 1550, 0.012);
    [0, 7, 12, 15, 19].forEach((s, i) =>
      this.voice(AudioEngine.freq(164.81, s), t + 0.04 + i * 0.038, 0.22, {
        type: i === 0 ? "triangle" : "sine",
        gain: 0.022 - i * 0.0025,
        attack: 0.045,
        filter: 1450,
        release: 0.62,
        room: 0.16,
      }),
    );
  }

  close() {
    if (!this._enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noiseSweep(t, 0.28, 1300, 380, 0.009);
    [12, 7, 0].forEach((s, i) =>
      this.voice(AudioEngine.freq(164.81, s), t + i * 0.055, 0.11, {
        type: "sine",
        gain: 0.017 - i * 0.002,
        attack: 0.025,
        release: 0.3,
        filter: 1050,
        room: 0.1,
      }),
    );
  }

  /** Page turn — a brief, low-level paper movement with no percussive tick. */
  pageTurn() {
    if (!this._enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.suppressOpenUntil = t + 0.5;
    this.noiseSweep(t, 0.24, 650, 2100, 0.015);
    this.voice(293.66, t + 0.035, 0.045, {
      type: "sine",
      gain: 0.007,
      attack: 0.02,
      release: 0.13,
      filter: 720,
    });
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
    f.Q.value = 0.55;
    f.frequency.setValueAtTime(fromHz, start);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENCE, start);
    g.gain.exponentialRampToValueAtTime(Math.min(gain, 0.025), start + Math.min(0.045, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(SILENCE, start + dur);
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
    g.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 3.2);
    g.connect(this.master);
    this.ambientGain = g;

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 620;
    tone.Q.value = 0.4;
    tone.connect(g);

    // E2–B2–E3–G3: a stable, open classical-guitar sonority.
    const freqs = [82.41, 123.47, 164.81, 196];
    const levels = [0.42, 0.22, 0.14, 0.09];
    const nodes: AudioNode[] = [];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.value = f;
      osc.detune.value = (i - 1.5) * 1.2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.025 + i * 0.012;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.7 + i * 0.25;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      const og = ctx.createGain();
      og.gain.value = levels[i];
      osc.connect(og);
      og.connect(tone);
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
    bus.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 1.4);
    bus.connect(this.master!);
    if (this.room) {
      const roomSend = ctx.createGain();
      roomSend.gain.value = 0.045;
      bus.connect(roomSend);
      roomSend.connect(this.room);
    }
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
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      setTimeout(() => {
        try {
          g.disconnect();
        } catch { /* already disconnected */ }
      }, 1000);
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
        gain: 0.1,
        dest: bus,
        filter: 430,
        attack: 0.045,
        release: 0.34,
      });
    }

    // Quiet nylon-like arpeggio — a measured walk through the mode.
    const deg = scale[(step * 3) % scale.length];
    this.voice(AudioEngine.freq(root, deg + 12), time, secPerBeat * 0.5, {
      type: spec.wave,
      gain: 0.042,
      dest: bus,
      filter: 1450,
      attack: 0.022,
      release: 0.24,
    });

    // Sparse mid-register echo, kept below the main line.
    if (bar % 8 === 6) {
      this.voice(AudioEngine.freq(root, scale[(step + 2) % scale.length] + 12), time, secPerBeat * 0.45, {
        type: "sine",
        gain: 0.014,
        dest: bus,
        filter: 1200,
        attack: 0.035,
        release: 0.3,
      });
    }

    // Low, slow pad at the start of each bar.
    if (bar % 8 === 0) {
      for (const s of scale.slice(0, 3)) {
        this.voice(AudioEngine.freq(root, s), time, secPerBeat * 3.2, {
          type: "sine",
          gain: 0.02,
          dest: bus,
          filter: 880,
          attack: 0.22,
          release: 1.1,
        });
      }
    }
  }
}

/** Singleton shared across the app. */
export const audio = new AudioEngine();
