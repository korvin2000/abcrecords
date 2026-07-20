import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadMidi, MidiPlayer } from "./midi";
import { audio } from "./audio";

/**
 * Unified playback for the built-in audio player. Two backends — native
 * (`HTMLAudioElement`, for mp3/wav/ogg/…) and MIDI (the oscillator synth in
 * lib/midi.ts) — sit behind one `useAudioPlayback` hook so the UI never cares
 * which is in use. A module-level coordinator keeps a single source sounding
 * at a time across the whole app.
 */

export type AudioKind = "native" | "midi";

const MIDI_RE = /\.(mid|midi)$/i;
const NATIVE_RE = /\.(mp3|wav|ogg|oga|m4a|aac|flac)$/i;

/** Which built-in backend can play this URL, if any (query/hash ignored). */
export function audioKind(url: string): AudioKind | null {
  const path = url.split(/[?#]/, 1)[0];
  if (MIDI_RE.test(path)) return "midi";
  if (NATIVE_RE.test(path)) return "native";
  return null;
}

export type PlaybackStatus = "idle" | "playing" | "paused" | "ended" | "error";

export interface Playback {
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  toggle: () => void;
  seek: (seconds: number) => void;
}

// ---- single-active coordinator --------------------------------------------
let stopActive: (() => void) | null = null;

function goSolo(stop: () => void): void {
  if (stopActive && stopActive !== stop) stopActive();
  stopActive = stop;
  audio.stopTheme(); // the procedural hero theme yields to a real recording
}
function releaseSolo(stop: () => void): void {
  if (stopActive === stop) stopActive = null;
}
/** Pause whatever is currently playing (used when the hero theme starts). */
export function stopAllPlayback(): void {
  stopActive?.();
}

// ---- backends -------------------------------------------------------------
interface BackendHost {
  onMeta: (duration: number) => void;
  onError: () => void;
}

interface Backend {
  readonly currentTime: number;
  readonly duration: number;
  start: (from: number) => void;
  resume: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  dispose: () => void;
}

class NativeBackend implements Backend {
  private el: HTMLAudioElement;
  constructor(src: string, host: BackendHost, onEnded: () => void) {
    this.el = new Audio(src);
    this.el.preload = "metadata";
    this.el.addEventListener("loadedmetadata", () => host.onMeta(this.el.duration || 0));
    this.el.addEventListener("ended", onEnded);
    this.el.addEventListener("error", host.onError);
  }
  get currentTime() {
    return this.el.currentTime;
  }
  get duration() {
    return Number.isFinite(this.el.duration) ? this.el.duration : 0;
  }
  start(from: number) {
    this.el.currentTime = from;
    void this.el.play().catch(() => undefined); // gesture-driven; ignore aborts
  }
  resume() {
    void this.el.play().catch(() => undefined);
  }
  pause() {
    this.el.pause();
  }
  seek(seconds: number) {
    this.el.currentTime = seconds;
  }
  dispose() {
    this.el.pause();
    this.el.removeAttribute("src");
  }
}

class MidiBackend implements Backend {
  private player: MidiPlayer | null = null;
  constructor(
    private src: string,
    private host: BackendHost,
  ) {}
  get currentTime() {
    return this.player?.currentTime ?? 0;
  }
  get duration() {
    return this.player?.duration ?? 0;
  }
  start(from: number) {
    if (this.player) {
      this.player.play(from);
      return;
    }
    void loadMidi(this.src).then((clip) => {
      if (!clip) return this.host.onError();
      this.player = new MidiPlayer(clip);
      this.host.onMeta(clip.duration);
      this.player.play(from);
    });
  }
  resume() {
    this.player?.resume();
  }
  pause() {
    this.player?.pause();
  }
  seek(seconds: number) {
    this.player?.seek(seconds);
  }
  dispose() {
    this.player?.dispose();
    this.player = null;
  }
}

// ---- hook -----------------------------------------------------------------
export function useAudioPlayback(src: string, kind: AudioKind): Playback {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const backendRef = useRef<Backend | null>(null);
  const rafRef = useRef(0);

  const stopRaf = useCallback(() => cancelAnimationFrame(rafRef.current), []);

  // Stable, so it can register with the solo coordinator and unmount cleanup.
  const pauseSelf = useCallback(() => {
    stopRaf();
    backendRef.current?.pause();
    setStatus((s) => (s === "playing" ? "paused" : s));
  }, [stopRaf]);

  const finish = useCallback(() => {
    stopRaf();
    releaseSolo(pauseSelf);
    setStatus("ended");
    setCurrentTime(backendRef.current?.duration ?? 0);
  }, [stopRaf, pauseSelf]);

  // MIDI has no "ended" event — the ticker watches the clock instead.
  const tick = useCallback(() => {
    const b = backendRef.current;
    if (!b) return;
    setCurrentTime(b.currentTime);
    if (kind === "midi" && b.duration && b.currentTime >= b.duration - 0.05) {
      finish();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [kind, finish]);

  // A stable host object that always calls the latest state setters.
  const host = useMemo<BackendHost>(
    () => ({ onMeta: setDuration, onError: () => setStatus("error") }),
    [],
  );

  const ensureBackend = useCallback((): Backend => {
    if (!backendRef.current) {
      backendRef.current =
        kind === "midi"
          ? new MidiBackend(src, host)
          : new NativeBackend(src, host, finish);
    }
    return backendRef.current;
  }, [kind, src, host, finish]);

  const toggle = useCallback(() => {
    audio.unlock();
    const b = ensureBackend();
    if (status === "playing") {
      pauseSelf();
      return;
    }
    goSolo(pauseSelf);
    if (status === "idle" || status === "ended") b.start(0);
    else b.resume();
    setStatus("playing");
    stopRaf();
    rafRef.current = requestAnimationFrame(tick);
  }, [ensureBackend, status, pauseSelf, stopRaf, tick]);

  const seek = useCallback(
    (seconds: number) => {
      const b = backendRef.current;
      if (!b) return;
      b.seek(seconds);
      setCurrentTime(seconds);
      setStatus((s) => (s === "ended" ? "paused" : s));
    },
    [],
  );

  // Rebuild + reset when the source changes; tear down on unmount.
  useEffect(() => {
    setStatus("idle");
    setCurrentTime(0);
    setDuration(0);
    return () => {
      stopRaf();
      releaseSolo(pauseSelf);
      backendRef.current?.dispose();
      backendRef.current = null;
    };
  }, [src, kind, pauseSelf, stopRaf]);

  return { status, currentTime, duration, toggle, seek };
}
