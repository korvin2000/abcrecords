// Synthesized audio engine using the Web Audio API.
// Generates SFX and ambient music entirely in code — no external assets.

import { AppEvents, bus } from "./EventBus";

type SfxName =
  | "hover"
  | "click"
  | "pageTurn"
  | "pageClose"
  | "search"
  | "open"
  | "close";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private musicGain: GainNode | null = null;
  private musicPlaying = false;
  private muted = false;
  private initialized = false;
  private scheduledIds: number[] = [];

  // Lazy init — required by browsers that block auto-play.
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AC =
        (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);

      // Reverb via convolver with synthetic impulse
      this.reverb = this.createReverb();
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.25;
      this.reverbSend.connect(this.reverb);
      this.reverb.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private reverb: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;

  private createReverb(): ConvolverNode {
    const ctx = this.ctx!;
    const conv = ctx.createConvolver();
    const rate = ctx.sampleRate;
    const length = rate * 2.2;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2.2);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    conv.buffer = impulse;
    return conv;
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.ensureContext();
    bus.on(AppEvents.CARD_HOVER, () => this.play("hover"));
    bus.on(AppEvents.CARD_SELECT, () => this.play("click"));
    bus.on(AppEvents.PAGE_TURN, () => this.play("pageTurn"));
    bus.on(AppEvents.CARD_CLOSE, () => this.play("pageClose"));
    bus.on(AppEvents.SEARCH_CHANGE, () => this.play("search"));
    bus.on(AppEvents.MUSIC_TOGGLE, () => this.toggleMusic());
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
    }
  }

  // ---- SFX ----
  play(name: SfxName): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const out = this.master!;
    const send = this.reverbSend!;

    switch (name) {
      case "hover": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(880, t);
        o.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.14);
        break;
      }
      case "click": {
        // Plucked string — two detuned oscillators with quick decay
        const notes = [523.25, 659.25, 783.99]; // C E G
        const n = notes[Math.floor(Math.random() * notes.length)];
        for (const freq of [n, n * 2]) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
          o.connect(g);
          g.connect(out);
          g.connect(send);
          o.start(t);
          o.stop(t + 0.4);
        }
        break;
      }
      case "pageTurn": {
        // Filtered noise burst — whoosh
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
        filter.frequency.exponentialRampToValueAtTime(400, t + 0.6);
        filter.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.35, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        src.connect(filter).connect(g).connect(out);
        g.connect(send);
        src.start(t);
        src.stop(t + 0.6);
        break;
      }
      case "pageClose": {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 800;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        src.connect(filter).connect(g).connect(out);
        src.start(t);
        src.stop(t + 0.3);
        break;
      }
      case "search": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(660, t);
        o.frequency.exponentialRampToValueAtTime(880, t + 0.05);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.04, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.1);
        break;
      }
      case "open":
      case "close":
        this.play("click");
        break;
    }
  }

  // ---- Generative ambient music ----
  // Evolving pad based on slowly modulated sine oscillators + filtered noise bed.
  startMusic(): void {
    if (this.musicPlaying) return;
    const ctx = this.ensureContext();
    this.musicPlaying = true;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 3);
    this.musicGain.connect(this.master!);
    this.musicGain.connect(this.reverbSend!);

    // Drone chord — Am(9) ish: A2, C3, E3, G3, B3
    const rootFreqs = [110, 164.81, 196, 246.94, 293.66];
    rootFreqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o.type = "sine";
      o2.type = "triangle";
      o.frequency.value = f;
      o2.frequency.value = f * 1.002; // subtle detune
      const g = ctx.createGain();
      g.gain.value = 0.12 - i * 0.015;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 800;
      filter.Q.value = 1;
      o.connect(g);
      o2.connect(g);
      g.connect(filter);
      filter.connect(this.musicGain!);
      o.start();
      o2.start();
      this.musicNodes.push(o, o2, g, filter);

      // LFO on filter cutoff for motion
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08 + i * 0.02;
      lfoGain.gain.value = 400;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();
      this.musicNodes.push(lfo, lfoGain);
    });

    // High sparkle layer — sparse pluck-like events scheduled via setTimeout
    const sparkle = () => {
      if (!this.musicPlaying) return;
      const scale = [440, 523.25, 659.25, 783.99, 880, 1046.5, 1318.5];
      const freq = scale[Math.floor(Math.random() * scale.length)];
      const ctx2 = this.ctx!;
      const t = ctx2.currentTime;
      const o = ctx2.createOscillator();
      const g = ctx2.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      o.connect(g);
      g.connect(this.musicGain!);
      o.start(t);
      o.stop(t + 2.6);
      this.scheduledIds.push(
        window.setTimeout(sparkle, 2500 + Math.random() * 4500),
      );
    };
    this.scheduledIds.push(window.setTimeout(sparkle, 1000));
  }

  stopMusic(): void {
    if (!this.musicPlaying) return;
    this.musicPlaying = false;
    this.scheduledIds.forEach((id) => clearTimeout(id));
    this.scheduledIds = [];
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2);
    }
    // Stop oscillators after fade
    window.setTimeout(() => {
      this.musicNodes.forEach((n) => {
        try {
          (n as OscillatorNode).stop?.();
        } catch {
          /* noop */
        }
        try {
          n.disconnect();
        } catch {
          /* noop */
        }
      });
      this.musicNodes = [];
      this.musicGain?.disconnect();
      this.musicGain = null;
    }, 2200);
  }

  toggleMusic(): void {
    if (this.musicPlaying) this.stopMusic();
    else this.startMusic();
  }
}

export const audio = new AudioEngine();
