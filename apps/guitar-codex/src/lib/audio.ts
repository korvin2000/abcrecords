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
//  • Context startup is asynchronous in some browsers. The first hover is
//    retained until an autoplay-permitted context reaches "running"; a real
//    gesture cancels that transient cue before performing the normal unlock.
//  • Nothing is built before it is needed: the context waits for the first
//    gesture or cue (setEnabled/setAmbient only record state until then), the
//    room is built on its first send and skipped on a machine graded "low",
//    and the context is suspended after a stretch of silence or while the
//    tab is hidden, so the audio thread sleeps when there is nothing to hear.
// ============================================================

import { perfTier } from "@/lib/fx";
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

// Look-ahead scheduling (ambient bed and per-entry theme). The audio clock
// places every note sample-accurately; the timer only tops up the queue, so
// it can wake 10×/s instead of 40×/s as long as the horizon exceeds one tick
// plus timer jitter (here ~200 ms of slack).
const SCHED_TICK_MS = 100;
const SCHED_HORIZON = 0.3; // seconds

// Seconds of silence — no voice still ringing, no ambient bed, no theme —
// after which the context is suspended so the audio thread and the device's
// output path can sleep. The next cue resumes it.
const IDLE_SUSPEND_S = 10;

const isHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

// ---- Ambient background music -------------------------------------------
// A gentle I–V–vi–IV progression in C major, ported from
// prototypes/snippets/music/music.ts. Unlike the standalone snippet (which
// spins up its own AudioContext), this plays through the engine's shared
// master bus, so the sound toggle mutes it and it shares the warm room tail.
// It replaces the previous sustained four-note drone.
const AMB_STEP_DUR = 0.28; // seconds per eighth note (~107 BPM)
const AMB_STEPS_PER_BAR = 8;
const AMB_NOTE = {
  C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
} as const;
const AMB_CHORDS: { bass: number; tones: number[] }[] = [
  { bass: AMB_NOTE.C3, tones: [AMB_NOTE.C4, AMB_NOTE.E4, AMB_NOTE.G4, AMB_NOTE.E4] },
  { bass: AMB_NOTE.G3, tones: [AMB_NOTE.B3, AMB_NOTE.D4, AMB_NOTE.G4, AMB_NOTE.D4] },
  { bass: AMB_NOTE.A3, tones: [AMB_NOTE.A3, AMB_NOTE.C4, AMB_NOTE.E4, AMB_NOTE.C4] },
  { bass: AMB_NOTE.F3, tones: [AMB_NOTE.F3, AMB_NOTE.A3, AMB_NOTE.C4, AMB_NOTE.A3] },
];
const AMB_TOTAL_STEPS = AMB_CHORDS.length * AMB_STEPS_PER_BAR;
const AMBIENT_LEVEL = 0.34; // fade target for the ambient sub-bus (kept gentle)

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
  private ambientTimer: ReturnType<typeof setInterval> | null = null;
  private ambientStep = 0;
  private ambientNextTime = 0;

  private themeTimer: ReturnType<typeof setInterval> | null = null;
  private themeGain: GainNode | null = null;
  private themeState: { spec: ThemeSpec; step: number; nextTime: number } | null = null;

  /** A user gesture has reached `unlock()`. Until then no cue may build the
   *  context. */
  private unlocked = false;
  private _enabled = true;
  private _ambientOn = false;
  private pendingHover = false;
  private lastHoverAt = -Infinity;
  private hoverStep = 0;
  private lastTypeAt = -Infinity;
  private lastClickAt = -Infinity;
  private suppressOpenUntil = -Infinity;

  // ---- power state ----------------------------------------------------
  /** The context has reached "running" at least once, so a later suspension
   *  is ours (idle or hidden tab) and may be resumed without a new gesture.
   *  Before that, "suspended" means the autoplay policy and only unlock()
   *  resumes. */
  private hasRun = false;
  /** ctx.suspend() is in flight: the state still reads "running", but
   *  anything scheduled now would freeze half-way, so cues are deferred. */
  private suspending = false;
  private wakeAfterSuspend = false;
  /** Context time at which the last scheduled voice has fully decayed. */
  private lastVoiceEnd = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Cues requested while our own suspension is being undone, replayed once
   *  the clock runs again. A Set of the cue methods themselves, so a burst of
   *  hovers during the resume replays as one hover, never as a pile-up. */
  private deferred = new Set<() => void>();

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.ctx.addEventListener("statechange", this.onContextStateChange);
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      if (this.ctx.state === "running") this.hasRun = true;
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
    } catch {
      this.ctx = null;
    }
    // Setting changes made before the context existed were only recorded
    // (the master gain above already honours `_enabled`); the ambient bed is
    // the other one. Starting it on a still-suspended clock is harmless — its
    // scheduler idles until the clock runs.
    if (this.ctx && this._ambientOn) this.startAmbient();
    return this.ctx;
  }

  /**
   * The room, built on its first send, or null when the machine is graded
   * low: a 1.15 s stereo convolution is real work on a weak ARM core, and the
   * dry signal alone is fine. The grade is read at every send because it can
   * settle once shortly after load.
   */
  private roomFor(ctx: AudioContext): ConvolverNode | null {
    if (perfTier() === "low" || !this.master) return null;
    if (!this.room) {
      // Copendum's synthetic convolver idea, retuned as a much shorter and
      // quieter warm room rather than a prominent effect.
      this.room = this.createRoom(ctx);
      const roomTone = ctx.createBiquadFilter();
      roomTone.type = "lowpass";
      roomTone.frequency.value = 1800;
      roomTone.Q.value = 0.35;
      const roomReturn = ctx.createGain();
      roomReturn.gain.value = 0.11;
      this.room.connect(roomTone);
      roomTone.connect(roomReturn);
      roomReturn.connect(this.master);
    }
    return this.room;
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
    // A gesture-triggered cue supersedes any hover retained during cold start.
    this.pendingHover = false;
    this.unlocked = true;
    const ctx = this.ensure();
    if (!ctx) return;
    // Mid-suspend, resuming now would race the pending suspend(); let its
    // completion resume instead.
    if (this.suspending) this.wakeAfterSuspend = true;
    else if (ctx.state === "suspended") void ctx.resume();
  }

  /**
   * Undo our own suspension (idle or hidden tab) outside a gesture. Only
   * after the context has run once — before that, "suspended" is the
   * autoplay policy, and resume() without a gesture would only be refused.
   */
  private wake(ctx: AudioContext) {
    if (!this.hasRun || isHidden()) return;
    if (this.suspending) {
      this.wakeAfterSuspend = true;
      return;
    }
    if (ctx.state !== "running") ctx.resume().catch(() => { /* retried by the next cue */ });
  }

  /** Something that must keep the clock running: the bed or a theme. */
  private get sounding() {
    return !!this.ambientGain || !!this.themeState;
  }

  private sleep(ctx: AudioContext) {
    if (this.suspending || ctx.state !== "running") return;
    this.suspending = true;
    this.wakeAfterSuspend = false;
    const settled = () => {
      this.suspending = false;
      // A cue, a theme or the bed may have arrived while suspend() was in
      // flight; they were held back rather than scheduled on a clock about to
      // stop, so bring the clock back for them now.
      if (this.wakeAfterSuspend || this.deferred.size || this.sounding) {
        this.wakeAfterSuspend = false;
        this.wake(ctx);
      }
    };
    ctx.suspend().then(settled, settled);
  }

  /** Arm the silence watch; cheap to call on every voice. */
  private armIdle() {
    if (this.ctx && this.idleTimer === null) {
      this.idleTimer = setTimeout(this.checkIdle, IDLE_SUSPEND_S * 1000);
    }
  }

  private checkIdle = () => {
    this.idleTimer = null;
    const ctx = this.ctx;
    // The bed and the theme re-arm the watch when they stop.
    if (!ctx || ctx.state !== "running" || this.suspending || this.sounding || this.deferred.size) return;
    const quiet = ctx.currentTime - this.lastVoiceEnd;
    if (quiet < IDLE_SUSPEND_S) {
      this.idleTimer = setTimeout(this.checkIdle, Math.ceil((IDLE_SUSPEND_S - quiet) * 1000));
      return;
    }
    this.sleep(ctx);
  };

  private onVisibilityChange = () => {
    const ctx = this.ctx;
    if (!ctx) return;
    if (isHidden()) {
      // A cue queued for a hidden tab would be stale by the time it returns.
      this.deferred.clear();
      this.sleep(ctx);
    } else if (this.sounding) {
      // Only the bed or a theme comes back by itself; one-shot cues wake the
      // context when they are next asked for.
      this.wake(ctx);
    }
  };

  get enabled() {
    return this._enabled;
  }

  setEnabled(v: boolean) {
    this._enabled = v;
    // Before the first gesture or cue there is no context to update: the value
    // is only recorded, and ensure() applies it when it builds the master bus.
    const ctx = this.ctx;
    if (ctx && this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(v ? MASTER_LEVEL : 0, ctx.currentTime + 0.25);
    }
    if (!v) {
      this.pendingHover = false;
      this.deferred.clear();
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
    const room = o.room ? this.roomFor(ctx) : null;
    if (room) {
      const send = ctx.createGain();
      send.gain.value = o.room!;
      g.connect(send);
      send.connect(room);
    }
    const end = start + dur + release + 0.05;
    osc.start(start);
    osc.stop(end);
    this.noteEnd(end);
  }

  /** Record how long the graph must keep running, and watch for silence. */
  private noteEnd(end: number) {
    // The room tail (≤1.15 s) is well inside the idle window, so voice ends
    // alone decide when the context may sleep.
    if (end > this.lastVoiceEnd) this.lastVoiceEnd = end;
    this.armIdle();
  }

  /** Equal temperament: semitone offset → frequency. */
  static freq(root: number, semitones: number) {
    return root * Math.pow(2, semitones / 12);
  }

  /**
   * Shared preamble for one-shot cues: null when muted, hidden or the audio
   * context is unavailable, otherwise the live context and its current time.
   *
   * `self` is the calling cue method. When the context is asleep by our own
   * hand (idle or hidden), the cue is not scheduled now: currentTime is frozen
   * and resume() settles asynchronously, so a note placed "now" would land at
   * whatever instant the clock happened to stop on. Instead the method is
   * held and re-run from the "running" statechange, against a live clock —
   * the first cue after a silence is a few ms late, never lost or doubled.
   * Before the context has ever run, the original cold-start path applies.
   */
  private cue(self: () => void): { ctx: AudioContext; t: number } | null {
    if (!this._enabled || isHidden()) return null;
    // Nothing is built before the first gesture. A pointer merely crossing a
    // card used to create the context, the compressor and — with the bed
    // remembered — the whole ambient graph, for a sound the autoplay policy
    // would not have let out anyway.
    if (!this.ctx && !this.unlocked) return null;
    const ctx = this.ensure();
    if (!ctx) return null;
    if (this.hasRun && (this.suspending || ctx.state !== "running")) {
      this.deferred.add(self);
      this.wake(ctx);
      return null;
    }
    return { ctx, t: ctx.currentTime };
  }

  // ---- SFX ----------------------------------------------------------
  hover() {
    const c = this.cue(this.hover);
    if (!c) return;
    if (c.ctx.state !== "running") {
      this.pendingHover = true;
      return;
    }
    this.playHover(c.ctx);
  }

  private onContextStateChange = () => {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    this.hasRun = true;
    // A context that is running with nothing to play (an unlock alone, or the
    // bed just switched off) must still find its way back to sleep.
    this.armIdle();
    if (this.pendingHover) {
      this.pendingHover = false;
      if (this._enabled) this.playHover(ctx);
    }
    if (this.deferred.size) {
      const replay = [...this.deferred];
      this.deferred.clear();
      for (const cue of replay) cue.call(this);
    }
  };

  private playHover(ctx: AudioContext) {
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
    const c = this.cue(this.type);
    if (!c) return;
    const { t } = c;
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
    const c = this.cue(this.click);
    if (!c) return;
    const { t } = c;
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
    const c = this.cue(this.found);
    if (!c) return;
    const { t } = c;
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
    const c = this.cue(this.error);
    if (!c) return;
    const { t } = c;
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
    const c = this.cue(this.open);
    if (!c) return;
    const { t } = c;
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
    const c = this.cue(this.close);
    if (!c) return;
    const { t } = c;
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
    const c = this.cue(this.pageTurn);
    if (!c) return;
    const { t } = c;
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
    this.noteEnd(start + dur + 0.05);
  }

  // ---- ambient drone ---------------------------------------------------
  setAmbient(on: boolean) {
    this._ambientOn = on;
    // Recorded only until a gesture or cue builds the context; ensure() then
    // starts the bed. This runs from a mount effect, so it must not be the
    // thing that constructs the AudioContext.
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (on) {
      this.startAmbient();
      this.wake(ctx);
    } else {
      this.stopAmbient();
    }
  }

  get ambientOn() {
    return this._ambientOn;
  }

  private startAmbient() {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.ambientGain) return;

    // Ambient sub-bus → master (so the sound toggle mutes it too).
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(AMBIENT_LEVEL, ctx.currentTime + 2.4); // slow fade-in
    g.connect(this.master);
    // A touch of the shared room tail for a little space.
    const room = this.roomFor(ctx);
    if (room) {
      const send = ctx.createGain();
      send.gain.value = 0.05;
      g.connect(send);
      send.connect(room);
    }
    this.ambientGain = g;

    // Look-ahead scheduler (same technique as the per-entry theme).
    this.ambientStep = 0;
    this.ambientNextTime = ctx.currentTime + 0.12;
    this.scheduleAmbient(); // first notes now, not one tick late
    this.ambientTimer = setInterval(() => this.scheduleAmbient(), SCHED_TICK_MS);
  }

  private scheduleAmbient() {
    const ctx = this.ctx;
    const bus = this.ambientGain;
    if (!ctx || !bus) return;
    while (this.ambientNextTime < ctx.currentTime + SCHED_HORIZON) {
      this.ambientStep = this.ambientStepVoices(this.ambientStep, this.ambientNextTime, bus);
      this.ambientNextTime += AMB_STEP_DUR;
    }
  }

  /** One eighth-note step of the progression (bass, arpeggio, sparkle). */
  private ambientStepVoices(step: number, time: number, dest: AudioNode): number {
    const s = step % AMB_TOTAL_STEPS;
    const bar = Math.floor(s / AMB_STEPS_PER_BAR);
    const within = s % AMB_STEPS_PER_BAR;
    const chord = AMB_CHORDS[bar];

    // Bass note on beats 1 and 3.
    if (within === 0 || within === 4) {
      this.voice(chord.bass, time, 1.3, {
        type: "triangle", gain: 0.08, dest, attack: 0.014, release: 0.3, filter: 900,
      });
    }
    // Arpeggiated chord tone every eighth note.
    const tone = chord.tones[within % chord.tones.length];
    this.voice(tone, time, 0.55, {
      type: "triangle", gain: 0.055, dest, attack: 0.012, release: 0.18, filter: 2600,
    });
    // Soft sparkle an octave up on the off-beats.
    if (within === 2 || within === 6) {
      this.voice(tone * 2, time, 0.4, {
        type: "sine", gain: 0.022, dest, attack: 0.012, release: 0.14, filter: 3200,
      });
    }
    return step + 1;
  }

  private stopAmbient() {
    const ctx = this.ctx;
    if (this.ambientTimer) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    if (!ctx || !this.ambientGain) return;
    const g = this.ambientGain;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8); // let the last notes ring out
    setTimeout(() => {
      try {
        g.disconnect();
      } catch { /* already disconnected */ }
    }, 1100);
    this.ambientGain = null;
    this.ambientStep = 0;
    this.armIdle();
  }

  // ---- per-entry theme (look-ahead scheduler) ---------------------------
  startTheme(spec: ThemeSpec) {
    const ctx = this.ensure();
    if (!ctx || !this._enabled) return;
    if (this.themeIsPlaying(spec)) return;
    this.stopTheme();
    this.wake(ctx);

    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 1.4);
    bus.connect(this.master!);
    const room = this.roomFor(ctx);
    if (room) {
      const roomSend = ctx.createGain();
      roomSend.gain.value = 0.045;
      bus.connect(roomSend);
      roomSend.connect(room);
    }
    this.themeGain = bus;

    this.themeState = { spec, step: 0, nextTime: ctx.currentTime + 0.1 };
    this.scheduleTheme(); // first notes now, not one tick late
    this.themeTimer = setInterval(() => this.scheduleTheme(), SCHED_TICK_MS);
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
    this.armIdle();
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
    while (state.nextTime < ctx.currentTime + SCHED_HORIZON) {
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
