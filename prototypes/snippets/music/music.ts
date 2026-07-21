// Lightweight, fully-synthesized background music engine.
// No audio files — everything is generated with the Web Audio API using a
// look-ahead scheduler so the main thread stays idle and CPU usage is minimal.

const NOTE: Record<string, number> = {
  C3: 130.81,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
};

// A gentle I–V–vi–IV progression in C major (very pleasant / "classic" feel).
interface Chord {
  bass: number;
  tones: number[];
}

const CHORDS: Chord[] = [
  { bass: NOTE.C3, tones: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.E4] },
  { bass: NOTE.G3, tones: [NOTE.B3, NOTE.D4, NOTE.G4, NOTE.D4] },
  { bass: NOTE.A3, tones: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.C4] },
  { bass: NOTE.F3, tones: [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.A3] },
];

const STEPS_PER_BAR = 8; // eighth notes
const TOTAL_STEPS = CHORDS.length * STEPS_PER_BAR;
const STEP_DUR = 0.28; // seconds per step (~107 BPM in eighths)

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private lowpass!: BiquadFilterNode;
  private compressor!: DynamicsCompressorNode;
  private delay!: DelayNode;
  private delayGain!: GainNode;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private currentStep = 0;
  private volume = 0.5;
  private running = false;

  private ensureContext() {
    if (this.ctx) return;
    const Ctx: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;

    // Master volume
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;

    // Soft low-pass to keep the tone warm and guitar-like
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = "lowpass";
    this.lowpass.frequency.value = 3200;
    this.lowpass.Q.value = 0.4;

    // Gentle limiter so layered notes never clip
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.25;

    // Subtle stereo-ish delay for a touch of space (very cheap)
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.26;
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = 0.2;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;

    // Wiring
    this.master.connect(this.lowpass);
    this.lowpass.connect(this.compressor);
    this.compressor.connect(ctx.destination);

    this.master.connect(this.delay);
    this.delay.connect(feedback);
    feedback.connect(this.delay);
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.compressor);
  }

  async start() {
    this.ensureContext();
    if (this.ctx!.state === "suspended") {
      await this.ctx!.resume();
    }
    if (this.running) return;
    this.running = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.1;
    this.scheduler();
  }

  stop() {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
    }
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  // The look-ahead scheduler: wakes up frequently but does almost no work,
  // scheduling notes slightly into the future for sample-accurate timing.
  private scheduler = () => {
    if (!this.running || !this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += STEP_DUR;
      this.currentStep = (this.currentStep + 1) % TOTAL_STEPS;
    }
    this.timer = window.setTimeout(this.scheduler, 25);
  };

  private scheduleStep(step: number, time: number) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const within = step % STEPS_PER_BAR;
    const chord = CHORDS[bar];

    // Bass note on beats 1 and 3
    if (within === 0 || within === 4) {
      this.pluck(chord.bass, time, 1.3, 0.5, "triangle");
    }

    // Arpeggiated chord tone every eighth note
    const tone = chord.tones[within % chord.tones.length];
    this.pluck(tone, time, 0.55, 0.3, "triangle");

    // Soft sparkle an octave up on the off-beats
    if (within === 2 || within === 6) {
      this.pluck(tone * 2, time, 0.4, 0.1, "sine");
    }
  }

  // A short plucked-envelope voice — cheap and pleasant.
  private pluck(freq: number, time: number, dur: number, level: number, type: OscillatorType) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(level, time + 0.012); // fast attack
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur); // natural decay

    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }
}
