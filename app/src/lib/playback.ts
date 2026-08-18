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

const MIDI_RE = /\.(mid|midi|rmi|kar)$/i;

/**
 * Every audio container the archive links to, mapped to the MIME types worth
 * asking the browser about. Several spellings per format on purpose: engines
 * disagree about which name they answer to (`audio/mp4` vs `audio/x-m4a`,
 * `audio/flac` vs `audio/x-flac`), and one "maybe" is enough to play.
 *
 * The list is deliberately wider than what any one browser can decode — the
 * archive holds WMA and RealAudio from the 1990s site, and knowing that a file
 * *is* a recording, even an unplayable one, is what lets the interface offer it
 * as a download instead of a play button that only ever errors.
 */
const AUDIO_MIME: Readonly<Record<string, readonly string[]>> = {
  mp3: ["audio/mpeg", "audio/mp3"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/aac"],
  m4b: ["audio/mp4", "audio/x-m4a"],
  mp4: ["audio/mp4"],
  aac: ["audio/aac", "audio/aacp", "audio/mp4"],
  adts: ["audio/aac"],
  wav: ["audio/wav", "audio/wave", "audio/x-wav"],
  wave: ["audio/wav", "audio/x-wav"],
  ogg: ["audio/ogg", "audio/ogg; codecs=vorbis"],
  oga: ["audio/ogg", "audio/ogg; codecs=vorbis"],
  opus: ["audio/ogg; codecs=opus", "audio/opus"],
  weba: ["audio/webm"],
  webm: ["audio/webm"],
  flac: ["audio/flac", "audio/x-flac"],
  aif: ["audio/aiff", "audio/x-aiff"],
  aiff: ["audio/aiff", "audio/x-aiff"],
  aifc: ["audio/aiff", "audio/x-aiff"],
  caf: ["audio/x-caf"],
  amr: ["audio/amr"],
  mka: ["audio/x-matroska"],
  wma: ["audio/x-ms-wma"],
  asf: ["audio/x-ms-asf"],
  ra: ["audio/vnd.rn-realaudio", "audio/x-pn-realaudio"],
  ram: ["audio/x-pn-realaudio"],
  au: ["audio/basic"],
  snd: ["audio/basic"],
};

/** The file extension, lowercased, with query and hash ignored. */
function extensionOf(url: string): string {
  const path = url.split(/[?#]/, 1)[0];
  const dot = path.lastIndexOf(".");
  return dot < 0 ? "" : path.slice(dot + 1).toLowerCase();
}

/** True for any recording, whether or not this browser owns a decoder for it. */
export function isAudioUrl(url: string): boolean {
  const extension = extensionOf(url);
  return extension in AUDIO_MIME || MIDI_RE.test(`.${extension}`);
}

// One `<audio>` element answers for the whole session, and each answer is kept:
// `canPlayType` is cheap but it is called once per track per render.
const codecCache = new Map<string, boolean>();

/** Does this browser claim a decoder for the format? Unknown formats get the
 *  benefit of the doubt — the element may still recognise them by content. */
function browserCanPlay(extension: string): boolean {
  const types = AUDIO_MIME[extension];
  if (!types) return true;
  const cached = codecCache.get(extension);
  if (cached !== undefined) return cached;
  let playable = true; // no DOM to ask (SSR/tests): assume the player can try
  if (typeof document !== "undefined") {
    const probe = document.createElement("audio");
    playable = types.some((type) => probe.canPlayType(type) !== "");
  }
  codecCache.set(extension, playable);
  return playable;
}

/**
 * Which built-in backend can play this URL, if any (query/hash ignored).
 * `null` means the interface must not offer playback: either it is not a
 * recording at all, or it is one in a format this browser cannot decode —
 * WMA and RealAudio being the archive's two standing examples.
 */
export function audioKind(url: string): AudioKind | null {
  const extension = extensionOf(url);
  if (MIDI_RE.test(`.${extension}`)) return "midi";
  if (!(extension in AUDIO_MIME)) return null;
  return browserCanPlay(extension) ? "native" : null;
}

/** A recording this browser owns no decoder for — offer it, do not play it. */
export function isUnplayableAudioUrl(url: string): boolean {
  return isAudioUrl(url) && audioKind(url) === null;
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

/** Register any built-in player as the sole active source. */
export function claimPlayback(stop: () => void): void {
  if (stopActive && stopActive !== stop) stopActive();
  stopActive = stop;
  audio.stopTheme(); // the procedural hero theme yields to content playback
}
export function releasePlayback(stop: () => void): void {
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
  /** Kept so `dispose` can unbind them: an `HTMLAudioElement` with listeners
   *  still attached is reachable from the event system, and the closures hold
   *  the host — the element, its buffer and this backend all stay alive. */
  private off: Array<() => void> = [];

  constructor(src: string, host: BackendHost, onEnded: () => void) {
    this.el = new Audio(src);
    this.el.preload = "metadata";
    this.on("loadedmetadata", () => host.onMeta(this.el.duration || 0));
    this.on("ended", onEnded);
    this.on("error", host.onError);
  }

  private on(type: string, handler: EventListener) {
    this.el.addEventListener(type, handler);
    this.off.push(() => this.el.removeEventListener(type, handler));
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
    for (const off of this.off) off();
    this.off = [];
    this.el.pause();
    this.el.removeAttribute("src");
    // Without a reload the element keeps the connection open and goes on
    // buffering the file it no longer has a src for.
    this.el.load();
  }
}

class MidiBackend implements Backend {
  private player: MidiPlayer | null = null;
  private disposed = false;
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
      // The fetch outlives the backend whenever the source changes or the
      // player unmounts mid-load. Without this guard the clip arrives to a
      // dead backend, builds a `MidiPlayer` nobody holds and starts its
      // look-ahead interval — a leaked timer scheduling oscillators into a
      // context nobody can stop. That is the ghost-audio bug.
      if (this.disposed) return;
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
    this.disposed = true;
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
  /** Last time pushed into React state — see `tick`. */
  const shownRef = useRef(0);

  const stopRaf = useCallback(() => cancelAnimationFrame(rafRef.current), []);

  // Stable, so it can register with the solo coordinator and unmount cleanup.
  const pauseSelf = useCallback(() => {
    stopRaf();
    backendRef.current?.pause();
    setStatus((s) => (s === "playing" ? "paused" : s));
  }, [stopRaf]);

  const finish = useCallback(() => {
    stopRaf();
    releasePlayback(pauseSelf);
    setStatus("ended");
    shownRef.current = backendRef.current?.duration ?? 0;
    setCurrentTime(shownRef.current);
  }, [stopRaf, pauseSelf]);

  // MIDI has no "ended" event — the ticker watches the clock instead.
  //
  // The *watching* is per frame; the **publishing** is not. Pushing
  // `currentTime` into state every frame re-rendered the player sixty times a
  // second for a readout that counts in tenths — a whole track's worth of
  // React work for a bar the reader cannot see move that finely. The end
  // check stays on the frame clock, where its 50 ms tolerance belongs.
  const tick = useCallback(() => {
    const b = backendRef.current;
    if (!b) return;
    const now = b.currentTime;
    if (Math.abs(now - shownRef.current) >= 0.1) {
      shownRef.current = now;
      setCurrentTime(now);
    }
    if (kind === "midi" && b.duration && now >= b.duration - 0.05) {
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
    claimPlayback(pauseSelf);
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
      shownRef.current = seconds;
      setCurrentTime(seconds);
      setStatus((s) => (s === "ended" ? "paused" : s));
    },
    [],
  );

  // Rebuild + reset when the source changes; tear down on unmount.
  useEffect(() => {
    setStatus("idle");
    shownRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    return () => {
      stopRaf();
      releasePlayback(pauseSelf);
      backendRef.current?.dispose();
      backendRef.current = null;
    };
  }, [src, kind, pauseSelf, stopRaf]);

  return { status, currentTime, duration, toggle, seek };
}
