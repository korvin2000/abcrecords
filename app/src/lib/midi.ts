/**
 * MIDI file playback. Browsers can't play `.mid` natively, so we parse the
 * file with @tonejs/midi (lazily imported — it stays out of the initial
 * bundle) and render it through a small Web Audio synth in the same restrained,
 * nylon-string spirit as lib/audio.ts. No SoundFont downloads: every note is a
 * shaped oscillator, so playback stays self-contained and offline-friendly.
 */

export interface MidiNote {
  time: number; // seconds from start
  duration: number; // seconds
  freq: number; // Hz
  gain: number; // 0..1, from note velocity
}

export interface MidiClip {
  duration: number; // seconds
  notes: MidiNote[]; // sorted by start time
}

const clipCache = new Map<string, Promise<MidiClip | null>>();

/** Fetch + parse a `.mid` into a flat, time-sorted note list. Cached per URL;
 *  any failure (missing file, malformed data) resolves to null so callers
 *  fail soft into a download-only state. */
export function loadMidi(url: string): Promise<MidiClip | null> {
  let clip = clipCache.get(url);
  if (!clip) {
    clip = parseMidi(url).catch(() => null);
    clipCache.set(url, clip);
  }
  return clip;
}

async function parseMidi(url: string): Promise<MidiClip | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  const { Midi } = await import("@tonejs/midi");
  const midi = new Midi(buffer);
  const notes: MidiNote[] = [];
  for (const track of midi.tracks) {
    if (track.instrument?.percussion) continue; // tonal synth only — skip drums
    for (const n of track.notes) {
      notes.push({
        time: n.time,
        duration: Math.min(n.duration, 8), // clamp stuck/hanging notes
        freq: 440 * 2 ** ((n.midi - 69) / 12), // A4 = 440 Hz
        gain: n.velocity,
      });
    }
  }
  notes.sort((a, b) => a.time - b.time);
  return { duration: midi.duration, notes };
}

const LOOKAHEAD = 0.15; // seconds of notes scheduled ahead of the clock
const TICK_MS = 25;

let sharedCtx: AudioContext | null = null;
function context(): AudioContext {
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

/**
 * Plays one MidiClip through shaped oscillators, scheduled with a rolling
 * look-ahead window (the sample-accurate technique the ambient theme engine
 * uses). Position is derived from the audio clock, so `suspend()` doubles as a
 * frame-perfect pause. One player sounds at a time (see lib/playback.ts).
 */
export class MidiPlayer {
  private out: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private voices = new Set<Voice>();
  private base: number; // ctx-time that maps to clip time 0 of the current run
  private cursor = 0; // index of the next unscheduled note
  private _playing = false;

  constructor(private clip: MidiClip) {
    const ctx = context();
    this.base = ctx.currentTime; // → currentTime 0 before the first play
    this.out = ctx.createGain();
    this.out.gain.value = 0.5;

    // Warm the tone and tame coincident notes, like the SFX engine.
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3200;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 6;
    this.out.connect(tone);
    tone.connect(limiter);
    limiter.connect(ctx.destination);
  }

  get duration(): number {
    return this.clip.duration;
  }
  get playing(): boolean {
    return this._playing;
  }
  get currentTime(): number {
    return clamp(context().currentTime - this.base, 0, this.clip.duration);
  }

  /** Begin playback at `from` seconds (default: the start). */
  play(from = 0): void {
    const ctx = context();
    void ctx.resume();
    this.stopVoices();
    this.base = ctx.currentTime - from;
    this.cursor = firstNoteFrom(this.clip.notes, from);
    this._playing = true;
    this.startScheduler();
  }

  pause(): void {
    if (!this._playing) return;
    this._playing = false;
    this.stopScheduler();
    void context().suspend(); // freezes the clock → position holds
  }

  resume(): void {
    if (this._playing) return;
    void context().resume();
    this._playing = true;
    this.startScheduler();
  }

  seek(seconds: number): void {
    const target = clamp(seconds, 0, this.clip.duration);
    this.stopVoices();
    this.base = context().currentTime - target;
    this.cursor = firstNoteFrom(this.clip.notes, target);
    if (this._playing) this.startScheduler();
  }

  stop(): void {
    this._playing = false;
    this.stopScheduler();
    this.stopVoices();
    this.base = context().currentTime; // → currentTime 0
  }

  dispose(): void {
    this.stop();
    try {
      this.out.disconnect();
    } catch {
      /* already disconnected */
    }
  }

  private startScheduler(): void {
    if (this.timer) return;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  private stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    const ctx = context();
    const horizon = ctx.currentTime + LOOKAHEAD;
    const notes = this.clip.notes;
    while (this.cursor < notes.length && this.base + notes[this.cursor].time < horizon) {
      const n = notes[this.cursor++];
      this.playNote(n, Math.max(ctx.currentTime, this.base + n.time));
    }
    if (this.cursor >= notes.length) this.stopScheduler(); // all notes queued
  }

  private playNote(n: MidiNote, at: number): void {
    const ctx = context();
    const osc = ctx.createOscillator();
    osc.type = n.freq < 200 ? "triangle" : "sine";
    osc.frequency.value = n.freq;

    const g = ctx.createGain();
    const peak = Math.min(0.02 + n.gain * 0.12, 0.16);
    g.gain.setValueAtTime(SILENCE, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(SILENCE, at + n.duration + 0.18);

    osc.connect(g);
    g.connect(this.out);
    const voice: Voice = { osc, gain: g };
    this.voices.add(voice);
    osc.start(at);
    osc.stop(at + n.duration + 0.23);
    osc.onended = () => {
      try {
        g.disconnect();
      } catch {
        /* already gone */
      }
      this.voices.delete(voice);
    };
  }

  private stopVoices(): void {
    const t = context().currentTime;
    for (const { osc, gain } of this.voices) {
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(Math.max(SILENCE, gain.gain.value), t);
        gain.gain.exponentialRampToValueAtTime(SILENCE, t + 0.05);
        osc.stop(t + 0.06);
      } catch {
        /* already stopped */
      }
    }
    this.voices.clear();
  }
}

const SILENCE = 0.0001;

function firstNoteFrom(notes: MidiNote[], from: number): number {
  const i = notes.findIndex((n) => n.time >= from);
  return i < 0 ? notes.length : i;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
