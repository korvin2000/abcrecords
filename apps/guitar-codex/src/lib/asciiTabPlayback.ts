import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TabDocument } from "./asciiTab";
import { audio } from "./audio";
import { claimPlayback, releasePlayback } from "./playback";

export type TabPlaybackStatus = "idle" | "playing" | "paused" | "ended" | "error";

export interface TabPlayback {
  readonly status: TabPlaybackStatus;
  readonly currentTime: number;
  readonly duration: number;
  readonly activeSystem: number | null;
  readonly hasNotes: boolean;
  readonly toggle: () => void;
  readonly stop: () => void;
}

interface SequenceEvent {
  readonly at: number;
  readonly frequency: number;
  readonly harmonic: boolean;
  readonly system: number;
}

interface Sequence {
  readonly events: readonly SequenceEvent[];
  readonly duration: number;
}

interface Runtime {
  readonly context: AudioContext;
  readonly bus: GainNode;
  readonly nodes: Set<OscillatorNode>;
  readonly startedAt: number;
  cursor: number;
  timer: ReturnType<typeof setInterval>;
  lastUiUpdate: number;
}

const STANDARD_OPEN_MIDI = [64, 59, 55, 50, 45, 40] as const;
const DROP_D_OPEN_MIDI = [64, 59, 55, 50, 45, 38] as const;
const SECONDS_PER_COLUMN = 0.085;
const LOOK_AHEAD = 0.16;

let sharedContext: AudioContext | null = null;

/**
 * Approximate source-column playback. ASCII tabs rarely provide authoritative
 * rhythm, so this intentionally previews pitch/fingering rather than claiming
 * to reconstruct a performance.
 */
export function useAsciiTabPlayback(tab: TabDocument | null): TabPlayback {
  const sequence = useMemo(() => buildSequence(tab), [tab]);
  const [status, setStatusState] = useState<TabPlaybackStatus>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSystem, setActiveSystem] = useState<number | null>(null);
  const statusRef = useRef<TabPlaybackStatus>("idle");
  const positionRef = useRef(0);
  const runtimeRef = useRef<Runtime | null>(null);

  const setStatus = useCallback((next: TabPlaybackStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const haltAudio = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    clearInterval(runtime.timer);
    for (const node of runtime.nodes) {
      try {
        node.stop();
      } catch {
        // Already ended.
      }
      node.disconnect();
    }
    runtime.nodes.clear();
    runtime.bus.disconnect();
    runtimeRef.current = null;
  }, []);

  const stop = useCallback(() => {
    haltAudio();
    positionRef.current = 0;
    setCurrentTime(0);
    setActiveSystem(null);
    setStatus("idle");
    releasePlayback(stop);
  }, [haltAudio, setStatus]);

  const pause = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime) positionRef.current = Math.min(sequence.duration, runtime.context.currentTime - runtime.startedAt);
    haltAudio();
    setCurrentTime(positionRef.current);
    setStatus("paused");
    releasePlayback(stop);
  }, [haltAudio, sequence.duration, setStatus, stop]);

  const finish = useCallback(() => {
    haltAudio();
    positionRef.current = sequence.duration;
    setCurrentTime(sequence.duration);
    setActiveSystem(null);
    setStatus("ended");
    releasePlayback(stop);
  }, [haltAudio, sequence.duration, setStatus, stop]);

  const play = useCallback(() => {
    if (!sequence.events.length) return;
    const context = getAudioContext();
    if (!context) {
      setStatus("error");
      return;
    }
    if (context.state === "suspended") void context.resume();
    audio.stopTheme();
    claimPlayback(stop);

    const restarting = statusRef.current === "idle" || statusRef.current === "ended";
    if (restarting) positionRef.current = 0;
    const offset = positionRef.current;
    const bus = context.createGain();
    bus.gain.value = 0.16;
    bus.connect(context.destination);
    const runtime: Runtime = {
      context,
      bus,
      nodes: new Set(),
      startedAt: context.currentTime - offset,
      cursor: firstEventAt(sequence.events, offset),
      timer: 0 as unknown as ReturnType<typeof setInterval>,
      lastUiUpdate: 0,
    };
    runtimeRef.current = runtime;
    setStatus("playing");

    const schedule = () => {
      if (runtimeRef.current !== runtime) return;
      const playhead = context.currentTime - runtime.startedAt;
      while (runtime.cursor < sequence.events.length && sequence.events[runtime.cursor].at <= playhead + LOOK_AHEAD) {
        const event = sequence.events[runtime.cursor++];
        scheduleNote(runtime, event, runtime.startedAt + event.at);
      }
      if (playhead - runtime.lastUiUpdate >= 0.08) {
        runtime.lastUiUpdate = playhead;
        const shown = Math.min(sequence.duration, Math.max(0, playhead));
        positionRef.current = shown;
        setCurrentTime(shown);
        const visible = sequence.events[Math.max(0, runtime.cursor - 1)];
        setActiveSystem(visible?.system ?? null);
      }
      if (runtime.cursor >= sequence.events.length && playhead >= sequence.duration) finish();
    };
    schedule();
    runtime.timer = setInterval(schedule, 40);
  }, [finish, sequence, setStatus, stop]);

  const toggle = useCallback(() => {
    if (statusRef.current === "playing") pause();
    else play();
  }, [pause, play]);

  useEffect(() => {
    stop();
    return () => {
      haltAudio();
      releasePlayback(stop);
    };
  }, [tab, haltAudio, stop]);

  return {
    status,
    currentTime,
    duration: sequence.duration,
    activeSystem,
    hasNotes: sequence.events.length > 0,
    toggle,
    stop,
  };
}

function buildSequence(tab: TabDocument | null): Sequence {
  if (!tab) return { events: [], duration: 0 };
  const openMidi = tab.tuning.kind === "drop-d" ? DROP_D_OPEN_MIDI : STANDARD_OPEN_MIDI;
  const events: SequenceEvent[] = [];
  let documentColumn = 0;
  for (const system of tab.systems) {
    for (const row of system.rows) {
      for (const event of row.events) {
        const midi = openMidi[event.string - 1] + event.fret;
        events.push({
          at: (documentColumn + event.onsetColumn) * SECONDS_PER_COLUMN,
          frequency: 440 * 2 ** ((midi - 69) / 12),
          harmonic: event.harmonic,
          system: system.index,
        });
      }
    }
    documentColumn += Math.max(16, system.widthColumns) + 6;
  }
  events.sort((a, b) => a.at - b.at || a.system - b.system);
  return { events, duration: events.length ? events[events.length - 1].at + 0.7 : 0 };
}

function getAudioContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new Context();
    return sharedContext;
  } catch {
    return null;
  }
}

function firstEventAt(events: readonly SequenceEvent[], seconds: number): number {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (events[middle].at < seconds) low = middle + 1;
    else high = middle;
  }
  return low;
}

function scheduleNote(runtime: Runtime, event: SequenceEvent, start: number): void {
  const oscillator = runtime.context.createOscillator();
  const envelope = runtime.context.createGain();
  oscillator.type = event.harmonic ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(event.frequency, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(event.harmonic ? 0.11 : 0.16, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + (event.harmonic ? 0.65 : 0.42));
  oscillator.connect(envelope);
  envelope.connect(runtime.bus);
  runtime.nodes.add(oscillator);
  oscillator.addEventListener("ended", () => {
    runtime.nodes.delete(oscillator);
    oscillator.disconnect();
    envelope.disconnect();
  });
  oscillator.start(Math.max(runtime.context.currentTime, start));
  oscillator.stop(Math.max(runtime.context.currentTime, start) + (event.harmonic ? 0.7 : 0.47));
}
